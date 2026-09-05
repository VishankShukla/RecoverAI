function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    { label: 'Processed', value: summary.totalProcessed, accent: 'ink' },
    { label: 'At risk', value: formatINR(summary.totalAtRiskAmount), accent: 'ink' },
    { label: 'Recovered', value: formatINR(summary.totalRecoveredAmount), accent: 'teal' },
    { label: 'Recovery rate', value: `${summary.recoveryRatePct}%`, accent: 'teal' },
    { label: 'Escalated to human', value: summary.escalatedCount, accent: 'rust' },
    { label: 'Exceptions', value: summary.exceptionsCount, accent: 'rust' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-ledger-line border border-ledger-line">
      {cards.map((c) => (
        <div key={c.label} className="bg-paper px-5 py-4">
          <div className="text-xs text-slate uppercase tracking-wide mb-1">{c.label}</div>
          <div
            className={`font-mono text-2xl tabular ${
              c.accent === 'teal' ? 'text-teal-dark' : c.accent === 'rust' ? 'text-rust' : 'text-ink'
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
