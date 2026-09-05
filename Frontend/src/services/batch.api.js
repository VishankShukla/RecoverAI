import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL: API_BASE });

export const runBatch = () => client.post('/batch/run').then((res) => res.data);
export const getSummary = () => client.get('/batch/summary').then((res) => res.data);
export const getTransactions = () => client.get('/batch/transactions').then((res) => res.data);
export const resetBatch = () => client.post('/batch/reset').then((res) => res.data);
