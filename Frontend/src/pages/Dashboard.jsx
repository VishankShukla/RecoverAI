import { useEffect, useState } from 'react';
import { runBatch, getSummary, getTransactions, resetBatch } from '../services/batch.api';
import SummaryCards from '../components/SummaryCards';
import TransactionTable from '../components/TransactionTable';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadAll() {
    try {
      const [summaryRes, txnRes] = await Promise.all([getSummary(), getTransactions()]);
      setSummary(summaryRes.summary);
      setTransactions(txnRes.transactions);
    } catch (err) {
      setError('Could not reach the backend. Is the server running on port 5000?');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleRunBatch() {
    setLoading(true);
    setError(null);
    try {
      await runBatch();
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Batch run failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setLoading(true);
    try {
      await resetBatch();
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = transactions.filter((t) => t.batchStatus === 'pending').length;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ledger-line px-8 py-6 flex items-baseline justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink">RecoverAI</h1>
          <p className="text-slate text-sm mt-1">Checkout & payment failure recovery agent — Track 03, AI Revenue Recovery</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate border border-ledger-line hover:bg-ledger-panel transition-colors disabled:opacity-50"
          >
            Reset batch
          </button>
          <button
            onClick={handleRunBatch}
            disabled={loading || pendingCount === 0}
            className="px-5 py-2 text-sm bg-teal text-paper hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Running…' : `Run batch (${pendingCount} pending)`}
          </button>
        </div>
      </header>

      <main className="px-8 py-8 space-y-8 max-w-6xl mx-auto">
        {error && (
          <div className="border border-rust/40 bg-rust-light text-rust px-4 py-3 text-sm">{error}</div>
        )}

        <SummaryCards summary={summary} />

        <div>
          <h2 className="text-sm text-slate uppercase tracking-wide mb-3">Transactions</h2>
          <TransactionTable transactions={transactions} />
        </div>
      </main>
    </div>
  );
}
