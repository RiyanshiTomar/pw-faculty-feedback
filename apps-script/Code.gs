/**
 * ══════════════════════════════════════════════════════════════
 *  PW Faculty Feedback — Google Apps Script Webhook
 *
 *  HOW IT WORKS:
 *  - The web app POSTs feedback JSON to this Web App URL
 *  - This script writes one row per submission to Results Sheet
 *  - Headers are auto-created on first submission
 *
 *  DUPLICATE / COOLDOWN HANDLING (15-day window):
 *  - Before writing, checks the Results Sheet for the most recent
 *    submission by this regno
 *  - If that submission was made LESS than COOLDOWN_DAYS ago,
 *    the new submission is REJECTED with reason "cooldown" and
 *    the date the student can submit again (nextEligibleDate)
 *  - If 15+ days have passed (or no prior submission exists),
 *    the new feedback is accepted and written as a new row
 *  - This means each student can submit once every 15 days —
 *    the cycle automatically "rolls back" / resets after that
 *
 *  SETUP: See SETUP_GUIDE.md Step 6
 * ══════════════════════════════════════════════════════════════
 */

// ── CHANGE THIS to your Results Sheet ID ─────────────────────
const RESULTS_SHEET_ID = 'YOUR_RESULTS_SHEET_ID_HERE';
const TAB_NAME         = 'Responses';

// ── Cooldown period — how often a student can submit feedback ─
const COOLDOWN_DAYS = 15;

// ── Receive POST from web app ─────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // Validate required fields exist
    if (!payload.regno || !payload.student_name) {
      Logger.log('Invalid payload — missing regno or student_name');
      return jsonOk({ success: false, error: 'Invalid payload' });
    }

    // Check 15-day cooldown for this regno
    const cooldownCheck = checkCooldown(payload.regno);
    if (cooldownCheck.blocked) {
      Logger.log('Cooldown active for ' + payload.regno + ' — next eligible: ' + cooldownCheck.nextEligibleDate);
      return jsonOk({
        success: false,
        reason: 'cooldown',
        lastSubmittedAt:   cooldownCheck.lastSubmittedAt,
        nextEligibleDate:  cooldownCheck.nextEligibleDate,
      });
    }

    writeRow(payload);
    Logger.log('Feedback saved: ' + payload.regno + ' | ' + payload.student_name);
    return jsonOk({ success: true });

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonOk({ success: false, error: err.message });
  }
}

// Health check — paste webhook URL in browser to verify it works
function doGet() {
  return jsonOk({ status: 'PW Faculty Feedback webhook live ✓', timestamp: new Date().toISOString() });
}

function jsonOk(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 15-day cooldown check ──────────────────────────────────────
// Looks at the Results Sheet for this regno's most recent
// submission. If it was within COOLDOWN_DAYS, blocks the new one.
function checkCooldown(regno) {
  const ss    = SpreadsheetApp.openById(RESULTS_SHEET_ID);
  const sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) return { blocked: false }; // No data yet — allow

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { blocked: false }; // Header only — allow

  // Column A = Timestamp, Column B = Reg No
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

  // Find the MOST RECENT submission timestamp for this regno
  let lastSubmission = null;
  data.forEach(row => {
    const rowRegno = row[1].toString().trim();
    if (rowRegno === regno.toString().trim()) {
      const ts = parseSheetTimestamp(row[0]);
      if (ts && (!lastSubmission || ts > lastSubmission)) {
        lastSubmission = ts;
      }
    }
  });

  if (!lastSubmission) return { blocked: false }; // Never submitted — allow

  const now            = new Date();
  const msSinceLast    = now.getTime() - lastSubmission.getTime();
  const daysSinceLast  = msSinceLast / (1000 * 60 * 60 * 24);

  if (daysSinceLast < COOLDOWN_DAYS) {
    const nextEligible = new Date(lastSubmission.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    return {
      blocked: true,
      lastSubmittedAt:  formatDate(lastSubmission),
      nextEligibleDate: formatDate(nextEligible),
    };
  }

  return { blocked: false }; // 15+ days passed — allow new submission
}

// Parse the timestamp string we wrote (IST locale string) back into a Date
function parseSheetTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Format a Date as "DD Mon YYYY" for display to students
function formatDate(d) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

// ── Write feedback row ────────────────────────────────────────
function writeRow(p) {
  const ss    = SpreadsheetApp.openById(RESULTS_SHEET_ID);
  let   sheet = ss.getSheetByName(TAB_NAME);

  // First submission ever — create tab and write headers
  if (!sheet) {
    sheet = ss.insertSheet(TAB_NAME);
    writeHeaders(sheet, p);
  }

  sheet.appendRow(buildRow(p));

  // Auto-resize columns for readability
  sheet.autoResizeColumns(1, 7);
}

// ── Build header row (runs once on very first submission) ─────
function writeHeaders(sheet, p) {
  const base = [
    'Timestamp',
    'Reg No',
    'Student Name',
    'Course',
    'Batch',
    'Center',
    'Scheme',
  ];

  // One group of 4 columns per faculty member
  const facultyCols = [];
  (p.faculty_feedback || []).forEach(f => {
    const n = f.faculty_name || 'Faculty';
    facultyCols.push(n + ' — Subject');
    facultyCols.push(n + ' — Rating (1-5)');
    facultyCols.push(n + ' — Rating Label');
    facultyCols.push(n + ' — Remark');
  });

  const headers = [...base, ...facultyCols, 'Overall Batch Remark'];

  // Write headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Style headers — PW theme
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0a0a0a');
  headerRange.setFontColor('#F97316');
  headerRange.setFontSize(10);

  // Freeze header row so it stays visible while scrolling
  sheet.setFrozenRows(1);

  // Set column widths for readability
  sheet.setColumnWidth(1, 180); // Timestamp
  sheet.setColumnWidth(2, 100); // Reg No
  sheet.setColumnWidth(3, 160); // Student Name
  sheet.setColumnWidth(4, 180); // Course
  sheet.setColumnWidth(5, 200); // Batch
  sheet.setColumnWidth(6, 180); // Center
}

// ── Build data row ────────────────────────────────────────────
function buildRow(p) {
  // Format timestamp as readable Indian time
  const ts = new Date(p.timestamp || new Date());
  const istTime = ts.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const base = [
    istTime,
    p.regno        || '',
    p.student_name || '',
    p.course       || '',
    p.batch        || '',
    p.center       || '',
    p.scheme       || '',
  ];

  const facultyCols = [];
  (p.faculty_feedback || []).forEach(f => {
    facultyCols.push(f.subject       || '');
    facultyCols.push(f.rating        || '');
    facultyCols.push(f.rating_label  || '');
    facultyCols.push(f.remark        || '');
  });

  return [...base, ...facultyCols, p.batch_remark || ''];
}
