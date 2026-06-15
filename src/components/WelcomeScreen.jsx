import PWLogo from './PWLogo';

export default function WelcomeScreen({ student, faculties, onStart, onBack }) {
  const name      = student.student_name || 'Student';
  const batch     = student.batch || student.class || '—';
  const course    = student.course || '—';
  const center    = student.center || '—';
  const scheme    = student.scheme || '—';
  const initials  = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="welcome-root">
      <div className="topbar">
        <div className="topbar-brand">
          <PWLogo height={34} />
        </div>
        <div className="topbar-right">
          <span className="topbar-batch-tag">{batch}</span>
        </div>
      </div>

      <div className="welcome-body">
        {/* Hero */}
        <div className="welcome-hero">
          <div className="welcome-avatar">{initials}</div>
          <div className="welcome-hero-text">
            <h1 className="welcome-greeting">
              Hello, <span>{name}</span>! 👋
            </h1>
            <div className="welcome-verified">
              <span className="verified-dot" />
              Identity Verified
            </div>
          </div>
        </div>

        {/* Batch */}
        <div className="batch-banner">
          <span className="batch-banner-label">Your Batch</span>
          <span className="batch-banner-name">{batch}</span>
        </div>

        {/* Info chips */}
        <div className="info-grid">
          {[
            { icon: '🎓', label: 'Reg. No.',  value: student.regno },
            { icon: '📚', label: 'Course',    value: course },
            { icon: '🏫', label: 'Center',    value: center },
            { icon: '📋', label: 'Scheme',    value: scheme },
          ].filter(i => i.value && i.value !== '—').map(({ icon, label, value }) => (
            <div className="info-chip" key={label}>
              <span className="info-chip-icon">{icon}</span>
              <div>
                <div className="info-chip-label">{label}</div>
                <div className="info-chip-value">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Faculty count */}
        <div className="faculty-notice">
          <div className="faculty-notice-count">{faculties.length}</div>
          <div className="faculty-notice-text">
            <strong>Faculty members</strong> are assigned to your batch.<br />
            Share your ratings and remarks for each assigned faculty member and help improve the learning experience.
          </div>
        </div>

        {faculties.length === 0 && (
          <div className="warn-box">⚠ No faculty found for your course. Please contact your batch coordinator.</div>
        )}

        <button className="btn-primary btn-large btn-green" onClick={onStart} disabled={faculties.length === 0}>
          Start Feedback →
        </button>

        <button className="btn-back" onClick={onBack}>
          ← Back to Login
        </button>
      </div>
    </div>
  );
}
