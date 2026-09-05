const express = require('express');
const router = express.Router();
const {
    runBatchController,
    getSummaryController,
    getTransactionsController,
    resetBatchController,
} = require('../controllers/batch.controllers');

router.post('/run', runBatchController);
router.get('/summary', getSummaryController);
router.get('/transactions', getTransactionsController);
router.post('/reset', resetBatchController);

module.exports = router;
