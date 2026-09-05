function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

const OUTCOME_STYLES = {
  recovered: 'text-teal-dark',
  no_recovery: 'text-slate',
  escalated: 'text-rust',
  exception: 'text-rust',
  skipped: 'text-slate',
  pending: 'text-slate',
};

export default function TransactionDetail({ txn }) {
  return (
    <div className="bg-ledger-panel border-t border-ledger-line px-6 py-5 text-sm">
      {txn.isMalformed || txn.outcome === 'exception' ? (
        <div className="mb-4 border border-rust/40 bg-rust-light px-4 py-3">
          <div className="font-medium text-rust mb-1">Handled without crashing the batch</div>
          <div className="text-ink/80">{txn.malformedReason || 'Unresolved — flagged for manual review.'}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <div className="text-xs text-slate uppercase tracking-wide mb-1">Model classification</div>
            <div className="text-ink">
              {txn.agentDecision?.failureCategory} · confidence {txn.agentDecision?.confidence}
            </div>
            <div className="text-ink/70 mt-1 italic">&ldquo;{txn.agentDecision?.reasoning}&rdquo;</div>
          </div>
          <div>
            <div className="text-xs text-slate uppercase tracking-wide mb-1">Guardrail</div>
            <div className="text-ink/80">
              {txn.guardrailOverride || 'Model suggestion accepted as-is — no override triggered.'}
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-slate uppercase tracking-wide mb-2">Audit trail</div>
      <ol className="space-y-1.5 font-mono text-xs">
        {txn.auditTrail?.map((entry, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-slate w-32 shrink-0">{entry.step}</span>
            <span className="text-ink/80">{entry.detail}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex gap-6 text-xs text-slate">
        <span>
          Final action: <span className="text-ink font-medium">{txn.finalAction || '—'}</span>
        </span>
        <span>
          Outcome: <span className={`font-medium ${OUTCOME_STYLES[txn.outcome] || 'text-ink'}`}>{txn.outcome}</span>
        </span>
        {txn.recoveredAmount > 0 && (
          <span>
            Recovered: <span className="text-teal-dark font-medium tabular">{formatINR(txn.recoveredAmount)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
