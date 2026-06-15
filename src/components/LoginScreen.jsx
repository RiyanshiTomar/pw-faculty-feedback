import { useState } from 'react';
import PWLogo from './PWLogo';
import { validateStudent, getFacultyForStudent } from '../services/sheets';

const ERROR_MESSAGES = {
  not_found:         { regno:  'Registration number not found. Please check and try again.' },
  wrong_phone:       { phone4: 'Last 4 digits do not match our records.' },
  mobile_not_found:  { phone4: 'Mobile record not found. Contact your coordinator.' },
  invalid_regno:     { regno:  'Please enter a valid registration number.' },
  invalid_phone:     { phone4: 'Enter exactly 4 digits (numbers only).' },
  inactive:          { regno:  'Your enrollment is inactive. Contact your coordinator.' },
};

export default function LoginScreen({ onValidated, onBatchExpired, onCooldown }) {
  const [regno,   setRegno]   = useState('');
  const [phone4,  setPhone4]  = useState('');
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  function clearErr(f) { setErrors(e => { const c = {...e}; delete c[f]; return c; }); }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const errs = {};
    if (!regno.trim())                       errs.regno  = 'Please enter your registration number.';
    if (!phone4.trim())                      errs.phone4 = 'Please enter the last 4 digits of your mobile.';
    else if (!/^\d{4}$/.test(phone4.trim())) errs.phone4 = 'Enter exactly 4 digits (numbers only).';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true); setErrors({});
    try {
      const result = await validateStudent(regno.trim(), phone4.trim());
      if (!result.valid) {
        if (result.reason === 'batch_expired' || result.reason === 'batch_not_started') {
          onBatchExpired(result.student, result.reason);
        } else if (result.reason === 'cooldown') {
          onCooldown(result.student, {
            lastSubmittedAt:  result.lastSubmittedAt,
            nextEligibleDate: result.nextEligibleDate,
          });
        } else {
          setErrors(ERROR_MESSAGES[result.reason] || { regno: 'Validation failed. Try again.' });
        }
        setLoading(false); return;
      }
      const faculties = await getFacultyForStudent(result.student);
      onValidated(result.student, faculties);
    } catch (err) {
      console.error(err);
      setErrors({ regno: 'Connection error. Check your internet and try again.' });
    }
    setLoading(false);
  }

  return (
    <div className="login-root">
      {/* Left branding panel */}
      <div className="login-left">
        <div className="login-left-brand">
          <PWLogo height={56} />
        </div>

        <div className="login-left-hero">
          <h1 className="login-left-title">
            Faculty<br /><span>Feedback</span><br />Portal
          </h1>
          <p className="login-left-desc">
            Share your honest feedback about your faculty members. Your responses help us improve the quality of education for all students.
          </p>
        </div>

        <div className="login-left-footer">
          <div>© {new Date().getFullYear()} Physics Wallah · All rights reserved</div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-right">
        <div className="login-form-box">
          <div style={{ marginBottom: '1.75rem' }}>
            <PWLogo height={48} />
          </div>

          <h1 className="login-form-heading">Student Login</h1>
          <p className="login-form-sub">
            Enter your registration number and the last 4 digits of your registered mobile number to continue.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="regno">Registration Number</label>
              <input
                id="regno" type="text"
                className={`field-input${errors.regno ? ' field-input--err' : ''}`}
                placeholder="e.g. 23411184"
                value={regno}
                onChange={e => { setRegno(e.target.value); clearErr('regno'); }}
                disabled={loading}
                autoComplete="off" spellCheck="false"
              />
              {errors.regno && <div className="field-error">⚠ {errors.regno}</div>}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="phone4">Last 4 digits of ERP registered mobile number</label>
              <input
                id="phone4" type="text" inputMode="numeric" maxLength={4}
                className={`field-input field-input--pin${errors.phone4 ? ' field-input--err' : ''}`}
                placeholder="_ _ _ _"
                value={phone4}
                onChange={e => { setPhone4(e.target.value.replace(/\D/g, '')); clearErr('phone4'); }}
                disabled={loading} autoComplete="off"
              />
              {errors.phone4 && <div className="field-error">⚠ {errors.phone4}</div>}
            </div>

            <button type="submit" className="btn-primary btn-green" disabled={loading}>
              {loading
                ? <span className="btn-loader"><span className="spin" />Verifying…</span>
                : 'Continue →'}
            </button>
          </form>

          <p className="login-help">Having trouble? Contact your batch coordinator.</p>
        </div>
      </div>
    </div>
  );
}
