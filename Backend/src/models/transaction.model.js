const mongoose = require('mongoose');


const auditEntrySchema = new mongoose.Schema({
    step: { type: String, required: true }, 
    detail: { type: String, required: true },  
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    customerName: { type: String },
    customerEmail: { type: String },
    amount: { type: Number },                     // can be invalid/negative on purpose for malformed test cases
    currency: { type: String, default: "INR" },
    method: { type: String },                      // upi | card | netbanking | wallet
    failureReasonRaw: { type: String },             // raw gateway-style message, e.g. "BAD_REQUEST_ERROR: payment failed due to..."
    eventType: { type: String, enum: ["payment_failed", "checkout_abandoned"], default: "payment_failed" },
    occurredAt: { type: Date, default: Date.now },
    retryCount: { type: Number, default: 0 },

    // Filled in by the pipeline
    isMalformed: { type: Boolean, default: false },
    malformedReason: { type: String },

    agentDecision: {
        failureCategory: { type: String },
        confidence: { type: Number },
        recommendedAction: { type: String },
        reasoning: { type: String },
    },

    guardrailOverride: { type: String },   // set when code overrides the LLM's suggested action, and why

    finalAction: { type: String },         // action actually executed after guardrails
    outcome: { type: String, enum: ["recovered", "no_recovery", "escalated", "skipped", "exception", "pending"], default: "pending" },
    recoveredAmount: { type: Number, default: 0 },

    auditTrail: [auditEntrySchema],

    batchStatus: { type: String, enum: ["pending", "processed"], default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
