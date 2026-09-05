# RecoverAI — Checkout & Payment Failure Recovery Agent

**Razorpay AI Buildathon · Track 03: AI Revenue Recovery**

RecoverAI processes a batch of failed payments and abandoned checkouts, uses an LLM
to classify *why* each one likely failed, decides a bounded recovery action under
hard business guardrails, executes it, and reports exactly how much money was
recovered — with a full per-transaction audit trail.

## Why this exists

Revenue loss from checkout doesn't happen in one clean step — a card gets declined,
a bank server times out, a customer abandons checkout at OTP. Each needs a different
response, and blindly retrying or discounting everything either annoys customers or
burns margin. RecoverAI reads the actual failure signal per transaction and picks
the response that fits it, while a code-level guardrail layer keeps every action
capped, explainable, and safe to run unattended.

## Architecture

```
Backend/
  src/
    models/transaction.model.js     Mongoose schema incl. embedded audit trail
    services/recoveryAgent.service.js   Gemini call — Zod schema forces structured JSON output
    services/batch.service.js       Validation → guardrails → execution → audit (the actual "agent")
    controllers/, routes/           REST API
    seed/generateTransactions.js    Generates 50 synthetic transactions, 8 deliberately malformed
Frontend/
  src/pages/Dashboard.jsx           Run batch, see recovery summary
  src/components/                   Summary cards, transaction table, expandable audit trail
```

**Design decision worth calling out:** the LLM only classifies and *suggests* an
action — it never has final say on what actually happens with money. Every
suggestion passes through `applyGuardrails()` in `batch.service.js`, which is
plain, auditable code that can:
- cap retries per transaction (`MAX_RETRIES_PER_TRANSACTION`)
- cap total discount spend across the whole batch (`MAX_TOTAL_DISCOUNT_BUDGET`)
- force escalation to a human for low-confidence classifications or high-value
  transactions, regardless of what the model suggested
- skip transactions that are too old to chase

This is what keeps every money action bounded and explainable, not just "the AI
decided."

## Handling failure gracefully

Two layers of protection, both visible in the demo:
1. **Malformed input never reaches the LLM.** `validate()` in `batch.service.js`
   catches missing fields, negative/zero amounts, etc. before any API call —
   these are logged as clean exceptions, not crashes. The seed data includes 8
   such records on purpose.
2. **LLM/API failure is retried once, then degrades to an exception.** If Gemini
   returns malformed JSON or the request errors out, `processOne()` retries once
   with the same transaction; if it still fails, the transaction is marked as an
   honest exception instead of taking down the batch. One `try/catch` per
   transaction in `runBatch()` also guarantees a single unexpected error never
   stops the rest of the batch from processing.

## Setup

### Backend
```bash
cd Backend
npm install
cp .env.example .env   # fill in MONGO_URI and GOOGLE_GENAI_API_KEY
npm run seed            # generates 50 synthetic transactions
npm run dev
```

### Frontend
```bash
cd Frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

Click **"Run batch"** on the dashboard to process all pending transactions, see
the recovery summary, and expand any row to view its full reasoning + audit trail.
**"Reset batch"** puts every transaction back to `pending` so you can re-run and
demo repeatedly.

## What "the bar" looks like here

- **Money recovered, measured**: dashboard shows total at-risk ₹, total
  recovered ₹, and recovery rate % across the whole batch — not a cherry-picked
  example.
- **Compliant escalation & stopping rules**: high-value and low-confidence cases
  always go to `escalate_manual`; retries are capped; discount spend is capped.
- **Audit trail**: every transaction has a step-by-step log — received →
  validated → classified → guardrail check → executed — visible in the UI.
- **Extending to real Razorpay test-mode APIs**: `executeAction()`'s
  `retry_payment_link` case is the integration point — swap the simulated
  outcome for a real call to Razorpay's Payment Links API
  (`POST /v1/payment_links`) in test mode, and track the real callback status
  instead of the weighted random roll.

## limitations 

- Recovery *outcomes* (did the retry actually succeed) are simulated with
  weighted probabilities, since this is a test-mode/synthetic demo. The
  classification and guardrail decisions are real.
- Notifications (discount nudge, reminder) are logged, not actually sent —
  swapping in an email/SMS provider is a small addition, not a redesign.
