const express = require('express');
const cors = require('cors');

const batchRouter = require('./routes/batch.routes');

const app = express();

app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));

app.get('/api/health', (req, res) => res.json({ status: "ok" }));
app.use('/api/batch', batchRouter);

module.exports = app;
