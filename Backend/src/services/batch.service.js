const Transaction = require('../models/transaction.model');
const { classifyTransaction } = require('./recoveryAgent.service');

const MAX_RETRIES = Number(process.env.MAX_RETRIES_PER_TRANSACTION || 1);
const MAX_DISCOUNT_BUDGET = Number(process.env.MAX_TOTAL_DISCOUNT_BUDGET || 5000);
const MIN_CONFIDENCE = Number(process.env.MIN_CONFIDENCE_FOR_AUTO_ACTION || 0.5);
const MAX_AGE_DAYS = Number(process.env.MAX_TRANSACTION_AGE_DAYS || 30);
const HIGH_VALUE_THRESHOLD = 50000;

function addAudit(txn, step, detail) {
    txn.auditTrail.push({ step, detail, timestamp: new Date() });
}

// Basic sanity checks BEFORE we ever call the LLM. Garbage in should never
// reach the model — it should be caught and logged as an exception instead.
function validate(txn) {
    if (!txn.amount || txn.amount <= 0) return "amount is missing, zero, or negative";
    if (!txn.customerName || !txn.customerEmail) return "missing customer name or email";
    if (!txn.method) return "missing payment method";
    if (!txn.failureReasonRaw || txn.failureReasonRaw.trim().length === 0) return "missing failure reason text";
    return null;
}

function ageInDays(date) {
    return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

// This is where the LLM's *suggestion* gets checked against hard business
// rules written in plain code. The LLM never has the final word on money.
function applyGuardrails(txn, decision) {
    let action = decision.suggestedAction;
    let override = null;

    if (ageInDays(txn.occurredAt) > MAX_AGE_DAYS) {
        override = `transaction is ${Math.round(ageInDays(txn.occurredAt))} days old (limit ${MAX_AGE_DAYS}) — too stale to chase`;
        action = "no_action_low_value";
    } else if (txn.amount > HIGH_VALUE_THRESHOLD) {
        override = `amount ₹${txn.amount} exceeds high-value threshold ₹${HIGH_VALUE_THRESHOLD} — routed to human regardless of model suggestion`;
        action = "escalate_manual";
    } else if (decision.confidence < MIN_CONFIDENCE) {
        override = `model confidence ${decision.confidence} below minimum ${MIN_CONFIDENCE} — not safe to automate`;
        action = "escalate_manual";
    } else if (action === "retry_payment_link" && txn.retryCount >= MAX_RETRIES) {
        override = `retry limit (${MAX_RETRIES}) already used for this transaction — no further retries`;
        action = "send_reminder";
    }

    return { action, override };
}

// "Executes" the action. In test-mode this simulates the outcome with a
// realistic weighted probability per action type; in a production build,
// retry_payment_link would call Razorpay's Payment Links API directly.
function executeAction(txn, action) {
    const roll = Math.random();
    switch (action) {
        case "retry_payment_link":
            txn.retryCount += 1;
            if (roll < 0.55) return { outcome: "recovered", recoveredAmount: txn.amount };
            return { outcome: "no_recovery", recoveredAmount: 0 };
        case "send_discount_nudge":
            if (roll < 0.35) return { outcome: "recovered", recoveredAmount: Math.round(txn.amount * 0.9) };
            return { outcome: "no_recovery", recoveredAmount: 0 };
        case "send_reminder":
            if (roll < 0.20) return { outcome: "recovered", recoveredAmount: txn.amount };
            return { outcome: "no_recovery", recoveredAmount: 0 };
        case "escalate_manual":
            return { outcome: "escalated", recoveredAmount: 0 };
        case "no_action_low_value":
        default:
            return { outcome: "skipped", recoveredAmount: 0 };
    }
}

async function processOne(txn, discountBudgetState) {
    addAudit(txn, "received", `batch pipeline picked up ${txn.transactionId}`);

    const validationError = validate(txn);
    if (validationError) {
        txn.isMalformed = true;
        txn.malformedReason = validationError;
        txn.outcome = "exception";
        txn.finalAction = "none";
        addAudit(txn, "validation_failed", `skipped LLM call — ${validationError}`);
        txn.batchStatus = "processed";
        await txn.save();
        return;
    }
    addAudit(txn, "validated", "passed basic sanity checks");

    // Call the model, with one retry on failure (malformed response / timeout / API error)
    // before giving up and marking this as an honest exception rather than crashing the batch.
    let decision = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            decision = await classifyTransaction({
                amount: txn.amount,
                method: txn.method,
                failureReasonRaw: txn.failureReasonRaw,
                eventType: txn.eventType,
            });
            addAudit(txn, "classified", `attempt ${attempt}: category=${decision.failureCategory}, confidence=${decision.confidence}, model suggested "${decision.suggestedAction}" — ${decision.reasoning}`);
            break;
        } catch (err) {
            addAudit(txn, "classification_error", `attempt ${attempt} failed: ${err.message}`);
            if (attempt === 2) {
                txn.outcome = "exception";
                txn.finalAction = "none";
                txn.malformedReason = "Gemini classification failed twice — needs manual review";
                txn.batchStatus = "processed";
                await txn.save();
                return;
            }
        }
    }

    txn.agentDecision = {
        failureCategory: decision.failureCategory,
        confidence: decision.confidence,
        recommendedAction: decision.suggestedAction,
        reasoning: decision.reasoning,
    };

    const { action, override } = applyGuardrails(txn, decision);
    if (override) {
        txn.guardrailOverride = override;
        addAudit(txn, "guardrail_applied", override);
    } else {
        addAudit(txn, "guardrail_check", "model suggestion accepted — no override needed");
    }

    // Enforce the shared discount budget across the whole batch, not just per-transaction.
    if (action === "send_discount_nudge") {
        const estimatedDiscount = Math.round(txn.amount * 0.1);
        if (discountBudgetState.spent + estimatedDiscount > MAX_DISCOUNT_BUDGET) {
            addAudit(txn, "guardrail_applied", `discount budget (₹${MAX_DISCOUNT_BUDGET}) would be exceeded — downgraded to reminder`);
            const result = executeAction(txn, "send_reminder");
            txn.finalAction = "send_reminder";
            txn.outcome = result.outcome;
            txn.recoveredAmount = result.recoveredAmount;
        } else {
            discountBudgetState.spent += estimatedDiscount;
            const result = executeAction(txn, action);
            txn.finalAction = action;
            txn.outcome = result.outcome;
            txn.recoveredAmount = result.recoveredAmount;
        }
    } else {
        const result = executeAction(txn, action);
        txn.finalAction = action;
        txn.outcome = result.outcome;
        txn.recoveredAmount = result.recoveredAmount;
    }

    addAudit(txn, "executed", `final action "${txn.finalAction}" → outcome "${txn.outcome}"${txn.recoveredAmount ? `, recovered ₹${txn.recoveredAmount}` : ""}`);
    txn.batchStatus = "processed";
    await txn.save();
}

async function runBatch() {
    const pending = await Transaction.find({ batchStatus: "pending" });
    const discountBudgetState = { spent: 0 };


    for (const txn of pending) {
        try {
            await processOne(txn, discountBudgetState);
        } catch (err) {
            // Final safety net: one transaction's unexpected crash never kills the batch.
            txn.outcome = "exception";
            txn.malformedReason = `unexpected error: ${err.message}`;
            txn.batchStatus = "processed";
            await txn.save();
        }
    }

    return getSummary();
}

async function getSummary() {
    const all = await Transaction.find({ batchStatus: "processed" });
    const atRisk = all.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
    const recovered = all.reduce((sum, t) => sum + (t.recoveredAmount || 0), 0);
    const exceptions = all.filter((t) => t.outcome === "exception");
    const escalated = all.filter((t) => t.outcome === "escalated");

    return {
        totalProcessed: all.length,
        totalAtRiskAmount: atRisk,
        totalRecoveredAmount: recovered,
        recoveryRatePct: atRisk > 0 ? Number(((recovered / atRisk) * 100).toFixed(1)) : 0,
        exceptionsCount: exceptions.length,
        escalatedCount: escalated.length,
        exceptions: exceptions.map((t) => ({ transactionId: t.transactionId, reason: t.malformedReason })),
    };
}

module.exports = { runBatch, getSummary };
