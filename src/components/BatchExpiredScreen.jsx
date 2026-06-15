import PWLogo from './PWLogo';

export default function BatchExpiredScreen({ student, reason, onBack }) {
  const batch     = student?.batch || student?.class || '—';
  const endDate   = student?.batch_end_date   || '';
  const startDate = student?.batch_start_date || '';

  return (
    <div className="expired-root">
      <div className="expired-card">
        <div className="expired-brand">
          <PWLogo height={48} />
        </div>
        <span className="expired-icon">📅</span>
        <h1 className="expired-heading">
          {reason === 'batch_not_started' ? 'Batch Not Started' : 'Batch Expired'}
        </h1>
        <p className="expired-sub">
          {reason === 'batch_expired'
            ? <>Your batch <strong>{batch}</strong> ended on <strong>{endDate}</strong>. The feedback window is now closed.</>
            : <>Your batch <strong>{batch}</strong> starts on <strong>{startDate}</strong>. Feedback opens once the batch is active.</>}
        </p>
        <div className="expired-divider" />
        <p className="expired-note">If you believe this is an error, please contact your batch coordinator.</p>
        <button className="btn-secondary" onClick={onBack}>← Back to Login</button>
      </div>
    </div>
  );
}
