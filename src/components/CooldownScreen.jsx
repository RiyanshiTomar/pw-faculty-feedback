import PWLogo from './PWLogo';

// Shown when a student tries to submit feedback again before the
// 15-day cooldown period has elapsed since their last submission.
export default function CooldownScreen({ student, lastSubmittedAt, nextEligibleDate, onBack }) {
  return (
    <div className="expired-root">
      <div className="expired-card">
        <div className="expired-brand"><PWLogo height={48} /></div>
        <span className="expired-icon">✅</span>
        <h1 className="expired-heading">Already Submitted</h1>
        <p className="expired-sub">
          {student?.student_name && <>Hi <strong>{student.student_name}</strong>, </>}
          you've already submitted your feedback for this cycle on <strong>{lastSubmittedAt}</strong>.
        </p>
        <div className="cooldown-banner">
          <div className="cooldown-banner-label">Next feedback window opens</div>
          <div className="cooldown-banner-date">{nextEligibleDate}</div>
        </div>
        <div className="expired-divider" />
        <p className="expired-note">
          The feedback form rolls over every 15 days. Please come back after the date above to submit again.
        </p>
        <button className="btn-secondary" onClick={onBack}>← Back to Login</button>
      </div>
    </div>
  );
}
