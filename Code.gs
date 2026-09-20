/**
 * Backend for the Colchester Japanese Community website, running on Google Sheets.
 * One web app serves three things, each stored on its own tab of the Sheet:
 *
 *   Orders   Time | Name | Section | Item | Qty | Collection | Note     (Orders + Logs pages)
 *   Notices  Time | Name | Message                                      (notices on the Home page)
 *   Haircut  Date | Time | Name | Booked at                             (Haircut page)
 *
 * The tabs are created automatically the first time they are needed.
 * To remove or fix anything, edit or delete its row in the Sheet.
 *
 * Setup: in your Sheet choose Extensions > Apps Script, paste this file,
 * SET YOUR REAL PASSCODE BELOW, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Copy the web app URL into assets/site.js.
 *
 * Updating an existing deployment: paste this file over the old one, put your real
 * passcode back in PASSCODE, then Deploy > Manage deployments > Edit > New version.
 * (The web app URL stays the same, and existing orders are untouched.)
 *
 * Access: every request needs the passcode. Without it the sheet returns nothing,
 * so orders, notices and haircut bookings are private to people who know it.
 */

const PASSCODE = 'tofu';   // shared with your group; don't reuse a real password
const SHEET_NAME = 'Orders';
const NOTICES_SHEET = 'Notices';
const HAIRCUT_SHEET = 'Haircut';
const MAX_ITEMS_PER_ORDER = 40;
const MAX_NOTICES_SHOWN = 30;
// Slot start times. 09:00 means the 09:00 to 10:00 slot; the last slot ends at 17:00.
const HAIRCUT_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

// ---- Reading ---------------------------------------------------------------
function doGet(e) {
  const params = (e && e.parameter) || {};

  // Nothing is readable without the passcode.
  if (params.code !== PASSCODE) return json_({ ok: false, error: 'bad_code' });

  if (params.action === 'check') return json_({ ok: true });   // just checks the passcode
  if (params.action === 'notices') return json_({ ok: true, notices: getNotices_() });
  if (params.action === 'haircut') return json_({ ok: true, bookings: getBookings_() });

  // Default: every order, as before.
  const rows = getSheet_().getDataRange().getValues();
  rows.shift(); // drop the header row

  const orders = rows
    .filter(function (r) { return r[1] && r[3]; })
    .map(function (r) {
      return {
        time: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
        name: String(r[1]),
        section: String(r[2]),
        item: String(r[3]),
        qty: Number(r[4]) || 0,
        collection: String(r[5] || ''),
        note: String(r[6] || '')
      };
    });

  return json_({ ok: true, orders: orders });
}

// ---- Writing ---------------------------------------------------------------
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (data.code !== PASSCODE) return json_({ ok: false, error: 'bad_code' });

  switch (data.action) {
    case 'addNotice':     return addNotice_(data);
    case 'bookHaircut':   return bookHaircut_(data);
    case 'cancelHaircut': return cancelHaircut_(data);
    default:              return addOrder_(data);   // no action = an order, as before
  }
}

// Adds one order (one row per item) after checking the input.
function addOrder_(data) {
  const name = clean_(data.name, 40);
  const collection = clean_(data.collection, 30);
  const items = Array.isArray(data.items) ? data.items.slice(0, MAX_ITEMS_PER_ORDER) : [];
  const now = new Date();
  const rows = [];

  items.forEach(function (it) {
    const section = clean_(it && it.section, 30);
    const item = clean_(it && it.item, 60);
    const note = clean_(it && it.note, 200);
    const qty = Math.floor(Number(it && it.qty));
    if (section && item && qty >= 1 && qty <= 99) {
      rows.push([now, name, section, item, qty, collection, note]);
    }
  });

  if (!name || !collection || rows.length === 0) return json_({ ok: false, error: 'bad_request' });

  withLock_(function () {
    const sheet = getSheet_();
    const start = sheet.getLastRow() + 1;
    // Plain-text format so anything typed in the form can never run as a formula.
    sheet.getRange(start, 2, rows.length, 3).setNumberFormat('@');  // Name, Section, Item
    sheet.getRange(start, 6, rows.length, 2).setNumberFormat('@');  // Collection, Note
    sheet.getRange(start, 1, rows.length, 7).setValues(rows);
  });

  return json_({ ok: true, added: rows.length });
}

// ---- Notices -----------------------------------------------------------------
function getNotices_() {
  const rows = getTab_(NOTICES_SHEET, ['Time', 'Name', 'Message']).getDataRange().getValues();
  rows.shift();
  return rows
    .filter(function (r) { return r[1] && r[2]; })
    .map(function (r) {
      return {
        time: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
        name: String(r[1]),
        message: String(r[2])
      };
    })
    .reverse()                        // newest first
    .slice(0, MAX_NOTICES_SHOWN);
}

function addNotice_(data) {
  const name = clean_(data.name, 40);
  const message = clean_(data.message, 500);
  if (!name || !message) return json_({ ok: false, error: 'bad_request' });

  withLock_(function () {
    const sheet = getTab_(NOTICES_SHEET, ['Time', 'Name', 'Message']);
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 2, 1, 2).setNumberFormat('@');   // text only, never a formula
    sheet.getRange(row, 1, 1, 3).setValues([[new Date(), name, message]]);
  });
  return json_({ ok: true });
}

// ---- Haircut -----------------------------------------------------------------
const HAIRCUT_HEADER = ['Date', 'Time', 'Name', 'Booked at'];

// Every booking as {row, date: 'yyyy-MM-dd', time: 'HH:mm', name}.
function readBookings_() {
  const sheet = getTab_(HAIRCUT_SHEET, HAIRCUT_HEADER);
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[1] || !r[2]) continue;
    // If someone typed a date or time by hand, Sheets may have turned it into a real date/time.
    const date = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).trim();
    const time = r[1] instanceof Date ? Utilities.formatDate(r[1], tz, 'HH:mm') : String(r[1]).trim();
    out.push({ row: i + 1, date: date, time: time, name: String(r[2]) });
  }
  return out;
}

function getBookings_() {
  return readBookings_().map(function (b) {
    return { date: b.date, time: b.time, name: b.name };
  });
}

function bookHaircut_(data) {
  const date = clean_(data.date, 10);
  const time = clean_(data.time, 5);
  const name = clean_(data.name, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || HAIRCUT_TIMES.indexOf(time) === -1 || !name) {
    return json_({ ok: false, error: 'bad_request' });
  }

  let taken = false;
  withLock_(function () {
    taken = readBookings_().some(function (b) { return b.date === date && b.time === time; });
    if (taken) return;
    const sheet = getTab_(HAIRCUT_SHEET, HAIRCUT_HEADER);
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 3).setNumberFormat('@');   // keep date and time as plain text
    sheet.getRange(row, 1, 1, 4).setValues([[date, time, name, new Date()]]);
  });

  return taken ? json_({ ok: false, error: 'taken' }) : json_({ ok: true });
}

// Only the person who booked (matched by name) can cancel their slot from the website.
function cancelHaircut_(data) {
  const date = clean_(data.date, 10);
  const time = clean_(data.time, 5);
  const name = clean_(data.name, 40);
  if (!date || !time || !name) return json_({ ok: false, error: 'bad_request' });

  let notYours = false;
  withLock_(function () {
    const match = readBookings_().filter(function (b) { return b.date === date && b.time === time; })[0];
    if (!match) return;                                       // already free
    if (match.name.trim().toLowerCase() !== name.toLowerCase()) { notYours = true; return; }
    getTab_(HAIRCUT_SHEET, HAIRCUT_HEADER).deleteRow(match.row);
  });

  return notYours ? json_({ ok: false, error: 'not_yours' }) : json_({ ok: true });
}

// ---- Helpers ----------------------------------------------------------------
function getSheet_() {
  return getTab_(SHEET_NAME, ['Time', 'Name', 'Section', 'Item', 'Qty', 'Collection', 'Note']);
}

// Finds a tab by name, creating it (with a header row) if it does not exist yet.
function getTab_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(header);
  return sheet;
}

// Stops two simultaneous writes overwriting each other.
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    fn();
  } finally {
    lock.releaseLock();
  }
}

function clean_(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
