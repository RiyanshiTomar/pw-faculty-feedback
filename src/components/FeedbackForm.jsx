import { useState, useRef } from 'react';
import PWLogo from './PWLogo';
import { submitFeedback } from '../services/sheets';

const LABELS = { 1:'Poor', 2:'Below Average', 3:'Average', 4:'Good', 5:'Excellent' };
const COLORS  = { 1:'#ef4444', 2:'#f97316', 3:'#eab308', 4:'#22c55e', 5:'#00D094' };

function RatingCircles({ value, onChange }) {
  return (
    <div className="rating-circles">
      {[1,2,3,4,5].map(n => (
        <button
          key={n} type="button"
          className={['rating-circle', value===n ? 'rating-circle--sel' : '', value>0 && n>value ? 'rating-circle--dim' : ''].filter(Boolean).join(' ')}
          style={value===n ? { background: COLORS[n], borderColor: COLORS[n] } : {}}
          onClick={() => onChange(n)}
          title={LABELS[n]} aria-label={`${n} — ${LABELS[n]}`} aria-pressed={value===n}
        >{n}</button>
      ))}
      {value > 0 && (
        <span className="rating-text-label" style={{ color: COLORS[value] }}>{LABELS[value]}</span>
      )}
    </div>
  );
}

export default function FeedbackForm({ student, faculties, onSubmitted, onBack, onCooldown }) {
  const [ratings,     setRatings]     = useState(() => Object.fromEntries(faculties.map((_,i) => [i,0])));
  const [remarks,     setRemarks]     = useState(() => Object.fromEntries(faculties.map((_,i) => [i,''])));
  const [batchRemark, setBatchRemark] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors,      setErrors]      = useState({});
  const formRef = useRef(null);

  const ratedCount = Object.values(ratings).filter(r => r > 0).length;
  const progress   = faculties.length ? Math.round((ratedCount / faculties.length) * 100) : 0;
  const batch      = student.batch || student.class || '—';

  function setRating(idx, val) {
    setRatings(r => ({...r, [idx]: val}));
    setErrors(e => { const c={...e}; delete c[idx]; return c; });
  }

  function validate() {
    const errs = {};
    faculties.forEach((_, i) => { if (!ratings[i]) errs[i] = true; });
    setErrors(errs);
    return !Object.keys(errs).length;
  }

  async function handleSubmit(ev) {
    ev.preventDefault(); setSubmitError('');
    if (!validate()) {
      formRef.current?.querySelector('.faculty-card--error')?.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    setSubmitting(true);
    const payload = {
      timestamp: new Date().toISOString(),
      regno: student.regno, student_name: student.student_name,
      course: student.course, batch: student.batch || student.class,
      center: student.center, scheme: student.scheme,
      faculty_feedback: faculties.map((f,i) => ({
        faculty_name: f.faculty_name, subject: f.subject,
        rating: ratings[i], rating_label: LABELS[ratings[i]] || '',
        remark: remarks[i] || '',
      })),
      batch_remark: batchRemark,
    };
    try {
      const result = await submitFeedback(payload, (cooldownInfo) => {
        // submitFeedback found cooldown BEFORE calling webhook
        // Navigate to "Already Submitted" screen with dates
        onCooldown(student, cooldownInfo);
      });

      if (result?.reason === 'cooldown') {
        // Screen transition already handled by callback above
        setSubmitting(false);
        return;
      }

      onSubmitted();
    } catch(err) {
      setSubmitError('Submission failed. Please check your connection and try again.');
    }
    setSubmitting(false);
  }

  return (
    <div className="form-root">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-brand">
          <button className="back-btn-topbar" onClick={onBack} title="Back">
            ← Back
          </button>
          <PWLogo height={34} />
        </div>
        <div className="topbar-right">
          <span className="topbar-progress">{ratedCount}/{faculties.length} rated</span>
          <span className="topbar-batch-tag">{batch}</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Student mini bar */}
      <div className="student-mini-bar">
        <span className="mini-bar-item">👤 <strong>{student.student_name}</strong></span>
        <span className="mini-bar-sep">·</span>
        <span className="mini-bar-item">🏫 <strong>{student.center}</strong></span>
        <span className="mini-bar-sep">·</span>
        <span className="mini-bar-item">📚 <strong>{student.course}</strong></span>
      </div>

      <form onSubmit={handleSubmit} noValidate ref={formRef}>
        <div className="form-content">

          {/* Faculty section */}
          <p className="form-section-title" style={{marginBottom:'12px'}}>Rate Your Faculty Members</p>

          <div className="faculty-cards">
            {faculties.length === 0 && (
              <div className="no-faculty">⚠ No faculty found for your course. Contact your coordinator.</div>
            )}
            {faculties.map((f, idx) => (
              <div
                key={idx}
                className={['faculty-card', errors[idx] ? 'faculty-card--error' : '', ratings[idx]>0 ? 'faculty-card--rated' : ''].filter(Boolean).join(' ')}
              >
                {/* Identity */}
                <div className="fac-identity">
                  <div className="fac-avatar">
                    {(f.faculty_name||'F').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="fac-name">{f.faculty_name}</div>
                    <div className="fac-subject">{f.subject || '—'}</div>
                    {ratings[idx] > 0 && (
                      <span className="fac-rated-pill" style={{ background: COLORS[ratings[idx]]+'18', color: COLORS[ratings[idx]], border: `1px solid ${COLORS[ratings[idx]]}44` }}>
                        ✓ {LABELS[ratings[idx]]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="rating-area">
                  <div className="rating-prompt">Your Rating</div>
                  <RatingCircles value={ratings[idx]} onChange={v => setRating(idx, v)} />
                  {errors[idx] && <div className="row-error">⚠ Please select a rating</div>}
                </div>

                {/* Remark */}
                <div className="remark-area">
                  <div className="remark-label">Remarks <span className="optional">(optional)</span></div>
                  <textarea
                    className="remark-input" rows={2}
                    placeholder="Any specific feedback…"
                    value={remarks[idx]}
                    onChange={e => setRemarks(r => ({...r, [idx]: e.target.value}))}
                    maxLength={500}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Batch overall */}
          <div className="batch-feedback-box">
            <div className="bfb-header">
              <span className="bfb-icon">💬</span>
              <span className="bfb-title">Overall Batch Feedback <span className="optional">(optional)</span></span>
            </div>
            <textarea
              className="remark-input remark-input--tall" rows={4}
              placeholder="General comments — facilities, scheduling, teaching quality, suggestions for improvement…"
              value={batchRemark}
              onChange={e => setBatchRemark(e.target.value.slice(0,1000))}
            />
            <div className="char-count">{batchRemark.length} / 1000</div>
          </div>

          {/* Submit */}
          <div className="submit-zone">
            {Object.keys(errors).length > 0 && (
              <div className="submit-err-banner">⚠ Please rate all {faculties.length} faculty members before submitting.</div>
            )}
            {submitError && <div className="submit-err-banner">{submitError}</div>}
            <button type="submit" className="btn-primary btn-large btn-green btn-submit" disabled={submitting}>
              {submitting
                ? <span className="btn-loader"><span className="spin" />Submitting…</span>
                : '✓ Submit Feedback'}
            </button>
            <p className="submit-note">Your feedback is confidential and used only to improve teaching quality and your overall experience.</p>
          </div>

        </div>
      </form>
    </div>
  );
}
