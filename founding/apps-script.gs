/**
 * Hydratonics — Founding Members backend.
 *
 * NOT executed by the website. This file is a reference copy of the
 * Google Apps Script that founding/index.html talks to. The live copy
 * lives in a container-bound Apps Script project attached to a Google
 * Sheet in the owner's Google account (Extensions → Apps Script from
 * inside the sheet) — deploy it there, not from this repo.
 *
 * ── SHEET SETUP (do this first, by hand) ──────────────────────────────
 * 1. New Google Sheet, named e.g. "Hydratonics — Founding Members".
 * 2. Rename the default tab to exactly "Codes". Header row:
 *      code | status | invitee_note | date_created | member_number |
 *      redeemed_at | redeemed_first_name | redeemed_last_name | redeemed_contact
 *    - "status" is "unredeemed" or "redeemed".
 *    - "invitee_note" is your own private reference (who this code is
 *      for) — never read by the script, purely your bookkeeping.
 *    - Everything from member_number onward stays blank until redeemed.
 * 3. Add a second tab named exactly "Counter", put 0 in cell A1.
 * 4. Extensions → Apps Script, delete the placeholder code, paste this
 *    whole file, save.
 * 5. Reload the spreadsheet — a "Founding Members" menu appears (from
 *    onOpen() below) with "Generate new code". Use that to create every
 *    code — never hand-type one, it needs to be genuinely random.
 *
 * ── DEPLOYMENT ─────────────────────────────────────────────────────────
 * Deploy → New deployment → type "Web app".
 *   Execute as: Me
 *   Who has access: Anyone
 * Deploy, copy the /exec URL, paste it as SCRIPT_URL in
 * founding/index.html (near the top of its last <script> block).
 *
 * GOTCHA: editing this script later and hitting Save does NOT update
 * the live /exec URL's behavior. You must go Deploy → Manage
 * deployments → edit (pencil icon) → Version: New version → Deploy.
 * Forgetting this step is the most common way this silently breaks.
 */

var SHEET_CODES = 'Codes';
var SHEET_COUNTER = 'Counter';

var COL = {
  CODE: 1, STATUS: 2, NOTE: 3, DATE_CREATED: 4,
  MEMBER_NUMBER: 5, REDEEMED_AT: 6, FIRST_NAME: 7, LAST_NAME: 8, CONTACT: 9
};

var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — avoids visual ambiguity
var CODE_LENGTH = 10;

var MAX_FAILED_PER_CODE = 5;           // lock a specific guessed code after this many bad tries
var FAILED_WINDOW_SECONDS = 600;       // ...within a 10-minute rolling window
var MAX_FAILED_GLOBAL_PER_WINDOW = 30; // defense against spraying many different codes fast
var GLOBAL_LOCKOUT_SECONDS = 60;

function doGet(e) {
  var action = (e.parameter.action || '').toString();
  var out;
  try {
    if (action === 'check') {
      out = handleCheck(e.parameter.code);
    } else if (action === 'redeem') {
      out = handleRedeem(e.parameter.code, e.parameter.firstName, e.parameter.lastName, e.parameter.contact);
    } else {
      out = { ok: false, status: 'server_error' };
    }
  } catch (err) {
    out = { ok: false, status: 'server_error' };
  }
  return jsonOut(out, e);
}

function jsonOut(obj, e) {
  var json = JSON.stringify(obj);
  var callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(callback)) {
    // JSONP fallback path — only exercised if founding/index.html is
    // switched to the <script>-tag fallback. Callback name is
    // whitelisted above to avoid reflecting arbitrary script content.
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function normalizeCode(raw) {
  return (raw || '').toString().trim().toUpperCase();
}

function handleCheck(rawCode) {
  var code = normalizeCode(rawCode);
  if (!code) return { ok: true, status: 'invalid' };

  var throttled = checkRateLimit(code);
  if (throttled) return throttled;

  var row = findCodeRow(code);
  if (!row) { recordFailure(code); return { ok: true, status: 'invalid' }; }
  if (row.status === 'redeemed') return { ok: true, status: 'already_redeemed' };
  return { ok: true, status: 'valid' };
}

function handleRedeem(rawCode, rawFirst, rawLast, rawContact) {
  var code = normalizeCode(rawCode);
  var firstName = (rawFirst || '').toString().trim().slice(0, 60);
  var lastName = (rawLast || '').toString().trim().slice(0, 60);
  var contact = (rawContact || '').toString().trim().slice(0, 120);

  if (!code) return { ok: true, status: 'invalid' };
  if (!firstName || !lastName || !contact) return { ok: true, status: 'missing_name' };

  var throttled = checkRateLimit(code);
  if (throttled) return throttled;

  var lock = LockService.getScriptLock();
  var gotLock = lock.tryLock(10000);
  if (!gotLock) return { ok: false, status: 'server_error' };

  try {
    // Real security boundary: re-validate independently of any earlier
    // "check" call, then mark redeemed in the same locked operation so
    // two near-simultaneous submits of the same code can't both succeed.
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_CODES);
    var row = findCodeRowInSheet(sheet, code);

    if (!row) { recordFailure(code); return { ok: true, status: 'invalid' }; }
    if (row.status === 'redeemed') return { ok: true, status: 'already_redeemed' };

    var memberNumber = nextMemberNumber();

    sheet.getRange(row.rowIndex, COL.STATUS).setValue('redeemed');
    sheet.getRange(row.rowIndex, COL.MEMBER_NUMBER).setValue(memberNumber);
    sheet.getRange(row.rowIndex, COL.REDEEMED_AT).setValue(new Date());
    sheet.getRange(row.rowIndex, COL.FIRST_NAME).setValue(firstName);
    sheet.getRange(row.rowIndex, COL.LAST_NAME).setValue(lastName);
    sheet.getRange(row.rowIndex, COL.CONTACT).setValue(contact);
    SpreadsheetApp.flush();

    return { ok: true, status: 'success', memberNumber: memberNumber };
  } finally {
    lock.releaseLock();
  }
}

function findCodeRow(code) {
  return findCodeRowInSheet(SpreadsheetApp.getActive().getSheetByName(SHEET_CODES), code);
}

function findCodeRowInSheet(sheet, code) {
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var values = sheet.getRange(2, COL.CODE, last - 1, COL.STATUS).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeCode(values[i][0]) === code) {
      return { rowIndex: i + 2, status: (values[i][1] || '').toString().trim().toLowerCase() };
    }
  }
  return null;
}

function nextMemberNumber() {
  // Only ever called while holding the script lock.
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_COUNTER);
  var next = (Number(sheet.getRange('A1').getValue()) || 0) + 1;
  sheet.getRange('A1').setValue(next);
  return next;
}

/* ── RATE LIMITING (CacheService — no sheet writes, no per-request IP) ── */

function checkRateLimit(code) {
  var cache = CacheService.getScriptCache();

  var globalKey = 'gfail_' + Math.floor(Date.now() / 1000 / GLOBAL_LOCKOUT_SECONDS);
  if ((Number(cache.get(globalKey)) || 0) >= MAX_FAILED_GLOBAL_PER_WINDOW) {
    return { ok: true, status: 'locked_out' };
  }
  var codeKey = 'fail_' + code;
  if ((Number(cache.get(codeKey)) || 0) >= MAX_FAILED_PER_CODE) {
    return { ok: true, status: 'locked_out' };
  }
  return null;
}

function recordFailure(code) {
  var cache = CacheService.getScriptCache();
  var codeKey = 'fail_' + code;
  cache.put(codeKey, String((Number(cache.get(codeKey)) || 0) + 1), FAILED_WINDOW_SECONDS);

  var globalKey = 'gfail_' + Math.floor(Date.now() / 1000 / GLOBAL_LOCKOUT_SECONDS);
  cache.put(globalKey, String((Number(cache.get(globalKey)) || 0) + 1), GLOBAL_LOCKOUT_SECONDS * 2);
}

/* ── OWNER TOOLING: generate a code from the Sheet UI ────────────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Founding Members')
    .addItem('Generate new code', 'generateNewCodeFromMenu')
    .addToUi();
}

function generateNewCodeFromMenu() {
  var code = generateCode();
  SpreadsheetApp.getActive().getSheetByName(SHEET_CODES)
    .appendRow([code, 'unredeemed', '', new Date(), '', '', '', '', '']);
  SpreadsheetApp.getUi().alert('New code: ' + code);
}

function generateCode() {
  var out = '';
  for (var i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return out;
}
