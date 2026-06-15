import PWLogo from './PWLogo';

export default function ThankYouScreen({ onReset }) {
  return (
    <div className="thankyou-root">
      <div className="thankyou-card">
        <div className="pw-brand">
          <PWLogo height={48} />
        </div>
        <span className="thankyou-icon">🎉</span>
        <h1 className="thankyou-heading">Feedback Submitted!</h1>
        <p className="thankyou-sub">
          Thank you for your valuable feedback. Your responses have been recorded and will help improve the quality of education for future batches.
        </p>
        <div className="thankyou-divider" />
        <p className="thankyou-note">You may close this window, or tap below to allow the next student.</p>
        <button className="btn-secondary" onClick={onReset}>← Back to Login</button>
      </div>
    </div>
  );
}
