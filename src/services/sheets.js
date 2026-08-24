// ─────────────────────────────────────────────────────────────
//  sheets.js — Google Sheets Service
//
//  Reads by COLUMN HEADER NAME only — position doesn't matter.
//
//  Sheet 1 (Student enrollment):
//    regno, student_name, course, center, scheme, batch,
//    class, batch_start_date, batch_end_date, student_status
//    NOTE: No phone number here (security)
//
//  Sheet 3 (Mobile unmask — "Raw Data" tab):
//    col A = regno, col B = hashed mobile, col C = Phone_number
//    Used ONLY for phone verification — nothing else stored
//
//  Sheet 2 (Faculty mapping):
//    centre, course, scheme_name, subject, faculty_name
//
//  Results Sheet ("Responses" tab):
//    Timestamp | Reg No | Student Name | ... (written by Apps Script)
//    Used here ONLY to check the 15-day cooldown before submitting.
//
//  Validation flow:
//    1. Find student in Sheet 1 by regno
//    2. Find phone in Sheet 3 by regno → check last 4 digits
//    3. Check batch_start_date ≤ today ≤ batch_end_date
//    4. Check student_status is active
//    5. (on submit) Check Results Sheet for cooldown — 15 days
// ─────────────────────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const WEBHOOK = import.meta.env.VITE_APPS_SCRIPT_WEBHOOK;
const BASE    = 'https://sheets.googleapis.com/v4/spreadsheets';

// Sheet 1 — Student data (no phone)
const S1_ID  = import.meta.env.VITE_STUDENT_SHEET_ID;
const S1_TAB = import.meta.env.VITE_STUDENT_SHEET_TAB || 'Sheet1';

// Sheet 2 — Faculty mapping
const S2_ID  = import.meta.env.VITE_FACULTY_SHEET_ID;
const S2_TAB = import.meta.env.VITE_FACULTY_SHEET_TAB || 'Sheet3';

// Sheet 3 — Mobile unmask (regno | hash | Phone_number)
const S3_ID  = import.meta.env.VITE_MOBILE_SHEET_ID;
const S3_TAB = import.meta.env.VITE_MOBILE_SHEET_TAB || 'Raw Data';

// Results Sheet — used to check cooldown before submitting
const RESULTS_ID      = import.meta.env.VITE_RESULTS_SHEET_ID;
const SUBMISSIONS_TAB = 'Submissions'; // lightweight tab: col A=Timestamp, col B=Reg No
                                       // DO NOT use Responses tab — it has many columns per student

// How many days a student must wait before submitting again.
// Keep this in sync with COOLDOWN_DAYS in apps-script/Code.gs
export const COOLDOWN_DAYS = 7;

// ── In-memory cache per session ───────────────────────────────
const _cache = {};

async function fetchSheet(id, tab, { skipCache = false } = {}) {
  const key = `${id}::${tab}`;
  if (!skipCache && _cache[key]) return _cache[key];

  const url = `${BASE}/${id}/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
  const res  = await fetch(url);

  if (!res.ok) {
    // Results sheet may not exist yet (no submissions so far) — treat as empty
    if (res.status === 400) return [];
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Sheet fetch failed (${res.status})`);
  }

  const data  = await res.json();
  const rows  = data.values || [];
  if (!skipCache) _cache[key] = rows;
  return rows;
}

// Converts rows → objects keyed by header name (case-insensitive,
// spaces → underscores). Column ORDER does not matter.
function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  );
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
}
// PW dump US-locale => month/date/year (M/D/YYYY).
// Handles: "9/30/2027" | "2 Nov, 2026" | ISO
function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const mdy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (mdy) {
    const month = +mdy[1], day = +mdy[2], year = +mdy[3];
    return new Date(year, month - 1, day);   // month-1: JS month 0-indexed
  }
  const mon = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (mon) return new Date(`${mon[2]} ${mon[1]}, ${mon[3]}`);
  return new Date(s);
}

// Parses the timestamp string written by Apps Script
// (en-IN locale string, e.g. "13/6/2026, 10:30:00 am")
function parseResultTimestamp(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Fallback: "DD/MM/YYYY, HH:MM:SS am/pm"
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    let [, day, month, year, hour, min, sec, ampm] = m;
    hour = parseInt(hour, 10);
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
    }
    return new Date(+year, +month - 1, +day, hour, +min, +sec);
  }
  return null;
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── PUBLIC: Validate student ──────────────────────────────────
export async function validateStudent(regnoRaw, last4Raw) {
  const regno = regnoRaw.trim().toUpperCase();
  const last4 = last4Raw.trim();

  // Input sanity checks
  if (!regno || regno.length < 3)
    return { valid: false, reason: 'invalid_regno' };
  if (!/^\d{4}$/.test(last4))
    return { valid: false, reason: 'invalid_phone' };

  // Fetch Sheet 1 and Sheet 3 in parallel for speed
  const [s1rows, s3rows] = await Promise.all([
    fetchSheet(S1_ID, S1_TAB),
    fetchSheet(S3_ID, S3_TAB),
  ]);

  // 1. Find student in Sheet 1
  const students = rowsToObjects(s1rows);
  const student  = students.find(
    s => (s.regno || '').toUpperCase() === regno
  );
  if (!student) return { valid: false, reason: 'not_found' };

  // 2. Find phone in Sheet 3
  // Sheet 3 headers: regno | mobile_no | Phone_number
  // Read by header name — "phone_number" after normalisation
  const phoneData = rowsToObjects(s3rows);
  const phoneRow  = phoneData.find(
    r => (r.regno || '').toUpperCase() === regno
  );
  if (!phoneRow) return { valid: false, reason: 'mobile_not_found' };

  // "Phone_number" normalises to "phone_number"
  const plainMobile = (phoneRow.phone_number || '').replace(/\D/g, '');
  if (!plainMobile) return { valid: false, reason: 'mobile_not_found' };
  if (!plainMobile.endsWith(last4))
    return { valid: false, reason: 'wrong_phone' };
  // NEW: student not yet allotted a batch (e.g. new joinee)
if (!student.batch || !student.batch.trim()) {
  return { valid: false, reason: 'no_batch', student };
}

  // 3. Batch date check
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (student.batch_start_date) {
    const start = parseDate(student.batch_start_date);
    if (start && !isNaN(start) && today < start)
      return { valid: false, reason: 'batch_not_started', student };
  }
  if (student.batch_end_date) {
    const end = parseDate(student.batch_end_date);
    if (end && !isNaN(end) && today > end)
      return { valid: false, reason: 'batch_expired', student };
  }

  // 4. Student status check
  const status = (student.student_status || '').toLowerCase();
  if (['inactive', 'dropped', 'expelled'].includes(status))
    return { valid: false, reason: 'inactive', student };

  // 5. Cooldown check — has this student submitted in the last
  //    COOLDOWN_DAYS days? If so, block before showing the form.
  const cooldown = await checkCooldown(regno);
  if (cooldown.blocked) {
    return {
      valid: false,
      reason: 'cooldown',
      student,
      lastSubmittedAt:  cooldown.lastSubmittedAt,
      nextEligibleDate: cooldown.nextEligibleDate,
    };
  }

  return { valid: true, student };
}

// ── Cooldown check (15-day rolling window) ────────────────────
// Reads ONLY "Submissions" tab — col A=Timestamp, col B=Reg No
// One row per student = very fast scan even at 2000+ entries
async function checkCooldown(regno) {
  if (!RESULTS_ID) return { blocked: false };

  try {
    // Always skip cache — need fresh data every time
    const rows = await fetchSheet(RESULTS_ID, SUBMISSIONS_TAB, { skipCache: true });
    if (!rows || rows.length < 2) return { blocked: false };

    // Submissions tab structure: col 0 = Timestamp, col 1 = Reg No
    // Find the MOST RECENT submission for this regno
    let lastSubmission = null;
    for (let i = 1; i < rows.length; i++) {
      const row      = rows[i];
      const rowRegno = (row[1] || '').toString().trim().toUpperCase();
      if (rowRegno === regno.toUpperCase()) {
        const ts = parseResultTimestamp(row[0]);
        if (ts && (!lastSubmission || ts > lastSubmission)) {
          lastSubmission = ts;
        }
      }
    }

    if (!lastSubmission) return { blocked: false };

    const daysSinceLast = (Date.now() - lastSubmission.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLast < COOLDOWN_DAYS) {
      const nextEligible = new Date(lastSubmission.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      return {
        blocked:          true,
        lastSubmittedAt:  formatDate(lastSubmission),
        nextEligibleDate: formatDate(nextEligible),
      };
    }

    return { blocked: false };

  } catch (err) {
    // Fail OPEN — never block genuine students due to a network error
    console.warn('Cooldown check failed, allowing submission:', err.message);
    return { blocked: false };
  }
}

// Faculty tab columns: Centre | Batch Name | Subject | Faculty Name | Email
// Matching is Centre + Batch ONLY (course/scheme no longer used).
export async function getFacultyForStudent(student) {
  const rows      = await fetchSheet(S2_ID, S2_TAB);
  const faculties = rowsToObjects(rows);

  const sCentre = (student.center || '').toLowerCase().trim();
  const sBatch  = (student.batch  || '').toLowerCase().trim();

  const matched = faculties.filter(f => {
    const fCentre = (f.centre     || '').toLowerCase().trim();
    const fBatch  = (f.batch_name || '').toLowerCase().trim();
    const centreMatch = !fCentre || fCentre === sCentre;
    const batchMatch  = !!fBatch && fBatch === sBatch;
    return centreMatch && batchMatch;
  });

  const seen = new Set();
  return matched.filter(f => {
    if (!f.faculty_name) return false;
    const key = `${f.faculty_name.toLowerCase()}||${(f.subject || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
// ── PUBLIC: Submit feedback ───────────────────────────────────
// Runs a SECOND cooldown check right before webhook call.
// This is the KEY fix — because no-cors means we can't read
// the webhook response, so we must check cooldown CLIENT-SIDE
// before calling the webhook, not rely on webhook response.
export async function submitFeedback(payload, onCooldown) {

  // ── Second cooldown check right before submit ─────────────
  // Catches edge case: student logged in (not blocked), filled form
  // slowly, but another device submitted in between.
  const cooldown = await checkCooldown(payload.regno);
  if (cooldown.blocked) {
    // Tell the caller to show the "Already Submitted" screen
    if (typeof onCooldown === 'function') {
      onCooldown({
        lastSubmittedAt:  cooldown.lastSubmittedAt,
        nextEligibleDate: cooldown.nextEligibleDate,
      });
    }
    return { success: false, reason: 'cooldown' };
  }

if (!WEBHOOK) {
  console.log('📋 [DEV] Payload:', JSON.stringify(payload, null, 2));
  await new Promise(r => setTimeout(r, 800));
  return { success: true, dev: true };
}

try {
  const response = await fetch(WEBHOOK, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify(payload),
  });

  const result = await response.json();

  if (result.reason === 'cooldown') {
    if (typeof onCooldown === 'function') {
      onCooldown({
        lastSubmittedAt:  result.lastSubmittedAt,
        nextEligibleDate: result.nextEligibleDate,
      });
    }
    return { success: false, reason: 'cooldown' };
  }

  return { success: !!result.success };

} catch (err) {
  console.warn('Webhook response could not be read, assuming success:', err.message);
  return { success: true };
}
}
