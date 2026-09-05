const Transaction = require('../models/transaction.model');
const { runBatch, getSummary } = require('../services/batch.service');

async function runBatchController(req, res) {
    try {
        const summary = await runBatch();
        res.status(200).json({ success: true, summary });
    } catch (err) {
        console.error("Batch run failed:", err);
        res.status(500).json({ success: false, message: "Batch run failed", error: err.message });
    }
}

async function getSummaryController(req, res) {
    try {
        const summary = await getSummary();
        res.status(200).json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

async function getTransactionsController(req, res) {
    try {
        const transactions = await Transaction.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

async function resetBatchController(req, res) {
    try {
        await Transaction.updateMany({}, {
            $set: {
                batchStatus: "pending",
                outcome: "pending",
                finalAction: null,
                recoveredAmount: 0,
                agentDecision: {},
                guardrailOverride: null,
                auditTrail: [],
                isMalformed: false,
                malformedReason: null,
            },
        });
        res.status(200).json({ success: true, message: "Batch reset — all transactions marked pending again" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { runBatchController, getSummaryController, getTransactionsController, resetBatchController };
