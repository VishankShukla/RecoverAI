import { useState } from 'react';
import TransactionDetail from './TransactionDetail';

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

const OUTCOME_DOT = {
  recovered: 'bg-teal',
  no_recovery: 'bg-slate/50',
  escalated: 'bg-rust',
  exception: 'bg-rust',
  skipped: 'bg-slate/30',
  pending: 'bg-slate/30',
};

export default function TransactionTable({ transactions }) {
  const [openId, setOpenId] = useState(null);

  if (!transactions?.length) {
    return <div className="text-slate text-sm py-8 text-center">No transactions yet — seed the database, then run a batch.</div>;
  }

  return (
    <div className="border border-ledger-line">
      <div className="grid grid-cols-[1fr_1.4fr_0.8fr_1fr_1fr_auto] gap-4 px-5 py-2.5 bg-ledger-panel text-xs uppercase tracking-wide text-slate border-b border-ledger-line">
        <span>ID</span>
        <span>Customer</span>
        <span className="text-right">Amount</span>
        <span>Action taken</span>
        <span>Outcome</span>
        <span></span>
      </div>
      {transactions.map((t) => (
        <div key={t.transactionId} className="border-b border-ledger-line last:border-b-0">
          <button
            onClick={() => setOpenId(openId === t.transactionId ? null : t.transactionId)}
            className="w-full grid grid-cols-[1fr_1.4fr_0.8fr_1fr_1fr_auto] gap-4 px-5 py-3 text-sm text-left hover:bg-ledger-panel/60 transition-colors items-center"
          >
            <span className="font-mono text-xs text-slate">{t.transactionId}</span>
            <span className="text-ink truncate">{t.customerName || <em className="text-rust not-italic">missing</em>}</span>
            <span className="text-right font-mono tabular text-ink">{formatINR(t.amount)}</span>
            <span className="text-ink/80 text-xs">{t.finalAction || '—'}</span>
            <span className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${OUTCOME_DOT[t.outcome] || 'bg-slate/30'}`} />
              {t.outcome}
            </span>
            <span className="text-slate text-xs">{openId === t.transactionId ? '▲' : '▼'}</span>
          </button>
          {openId === t.transactionId && <TransactionDetail txn={t} />}
        </div>
      ))}
    </div>
  );
}
