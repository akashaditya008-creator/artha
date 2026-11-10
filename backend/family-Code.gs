// Artha for Parents — backend v1 (Nov 2026). One copy of this script serves ONE family.
// Built from Artha backend v5, with: people, roles, platforms and features read from Script Properties (nothing
// about the family is in this code), roles checked on every action, a durable "never write twice" check,
// sessions that renew while in use, an unchanged-data short answer, and its own Drive names so it can never
// touch the files of Aditya & Spardha's Artha (both scripts run under the same Google account).
//
// SETUP (once): Project Settings → Script properties → add FAMILY (see the handoff for the exact JSON),
// then run setupFamily() from the editor, then Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
const TZ = 'Asia/Kolkata';
const INR = '[$₹]#,##0.00;[Red]-[$₹]#,##0.00';
const DATEF = 'dd mmm yyyy';
const LEDGER = 'Ledger', REC = 'Records', AUDIT = 'Audit';
const L_COLS = ['ID', 'Date', 'Whose money', 'Account', 'Asset', 'Type', 'Name', 'Code', 'Qty', 'Price (₹)', 'Amount (₹)', 'Paid via', 'Note'];
const L_W = [70, 100, 100, 160, 110, 105, 300, 110, 90, 100, 120, 90, 380];
const REC_COLS = ['ID', 'Kind', 'Title', 'Updated', 'Data (JSON, written by the app)'];
const A_COLS = ['When', 'Who', 'Action', 'ID', 'Before', 'After', 'Request'];
const TYPES = ['Add money', 'Withdraw', 'Buy', 'Sell', 'Bonus', 'Redeem', 'Payout', 'Dividend', 'Other income', 'Charges', 'F&O result', 'Premium', 'Value'];
const CLIENT_ID = '816088287548-9r600bocno2f00uf2p319cdg0f8bcov7.apps.googleusercontent.com';
const SESSION_DAYS = 180;      // a session unused for this long is signed out
const RENEW_AFTER_DAYS = 7;    // a session in use is renewed at most once a week (one property write)
const MAX_SESSIONS = 5;        // phones/browsers per person
const ROLES = { admin: 3, editor: 2, viewer: 1 };
// The lowest role each action needs. Anything not listed here is refused.
const NEED = { get: 1, logout: 1, add: 2, edit: 2, del: 2, rec: 2, cal: 2, upload: 2 };
let USER_ = null, FAM_ = null;

/* ---------------- family configuration (Script property FAMILY, JSON) ----------------
   { "id": "parents",                         short id, letters only; also used in Drive file names
     "label": "Mom & Dad",
     "people": ["Mom", "Dad"],                 the choices for "Whose money"
     "users": { "akashaditya008@gmail.com": { "name": "Aditya", "role": "admin" },
                "<mom's gmail>":            { "name": "Mom",    "role": "editor" },
                "<dad's gmail>":            { "name": "Dad",    "role": "editor" } },
     "acct0": ["Groww · Mom", "Groww · Dad", "SBI · Mom", "SBI · Dad"],
     "banks": { "Mom": [["SBI", "Primary", "#2D9CDB"]], "Dad": [["SBI", "Primary", "#2D9CDB"]] },
     "features": { "simple": true, "assets": ["Stocks", "Mutual Funds", "Bonds", "FD"], "insurance": false, "nps": false,
                   "balance": false, "charges": false, "corporate": false, "fno": false, "tds": true, "inbox": true,
                   "viewerUpload": false, "lang": "en" },
     "project": "https://claude.ai/project/…" } */
function fam_() {
  if (FAM_) return FAM_;
  const raw = PropertiesService.getScriptProperties().getProperty('FAMILY');
  if (!raw) throw new Error('This Artha is not set up yet.');
  let f = null; try { f = JSON.parse(raw); } catch (x) { }
  if (!f || !/^[a-z]{3,20}$/.test(String(f.id || '')) || !Array.isArray(f.people) || !f.people.length || !f.users) throw new Error('The FAMILY setting is not valid JSON.');
  const users = {};
  Object.keys(f.users).forEach(k => { const u = f.users[k] || {}; if (ROLES[u.role] && u.name) users[String(k).toLowerCase().trim()] = { name: String(u.name).slice(0, 30), role: u.role }; });
  f.users = users; f.features = f.features || {};
  FAM_ = f; return f;
}
// What the phone is told about the family. Emails of other members are never sent.
function cfg_() {
  const f = fam_();
  return { fam: f.id, label: String(f.label || f.id), people: f.people, acct0: f.acct0 || [], banks: f.banks || {}, features: f.features,
    project: f.project || '', inboxPrefix: 'artha-' + f.id, role: USER_ ? USER_.role : '' };
}

/* ---------------- access ---------------- */
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function auth_(tok) {
  if (!/^[0-9a-f]{64}$/.test(String(tok || ''))) throw new Error('SIGNIN: Please sign in with Google.');
  const props = PropertiesService.getScriptProperties(), key = 's_' + hash_(tok), raw = props.getProperty(key);
  if (!raw) throw new Error('SIGNIN: Please sign in with Google.');
  let s = null; try { s = JSON.parse(raw); } catch (x) { }
  const u = s && fam_().users[s.email], now = Date.now();
  if (!s || !u || now - (s.seen || s.at) > SESSION_DAYS * 864e5) { props.deleteProperty(key); throw new Error('SIGNIN: Please sign in with Google again.'); }
  if (now - (s.seen || s.at) > RENEW_AFTER_DAYS * 864e5) { s.seen = now; props.setProperty(key, JSON.stringify(s)); }
  return { email: s.email, name: u.name, role: u.role };
}
// Every action goes through here: signed in, and allowed for this person's role (checked on the server, not only in the app).
function allow_(action, tok) {
  const need = NEED[action]; if (!need) throw new Error('Unknown action');
  USER_ = auth_(tok);
  let have = ROLES[USER_.role] || 0;
  if (action === 'upload' && have === 1 && fam_().features.viewerUpload) have = 2;   // viewers may send documents to the inbox, if switched on
  if (have < need) throw new Error('VIEWONLY: ' + USER_.name + ' can look but not change things in ' + (fam_().label || 'this Artha') + '.');
  return USER_;
}
function login_(idToken) {
  const jwt = String(idToken || '').trim();
  if (jwt.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(jwt)) throw new Error('Google sign-in failed. Please try again.');
  const cache = CacheService.getScriptCache(), tries = Number(cache.get('login_tries') || 0);
  if (tries >= 20) throw new Error('Too many sign-in attempts. Please wait a minute and try again.');
  cache.put('login_tries', String(tries + 1), 60);
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(jwt), { muteHttpExceptions: true });
  let t = {}; if (r.getResponseCode() === 200) { try { t = JSON.parse(r.getContentText()); } catch (x) { } }
  const email = String(t.email || '').toLowerCase();
  const issOk = t.iss === 'https://accounts.google.com' || t.iss === 'accounts.google.com';
  if (!issOk || !(Number(t.exp || 0) * 1000 > Date.now()) || t.aud !== CLIENT_ID || String(t.email_verified) !== 'true') throw new Error('Google sign-in failed. Please try again.');
  const f = fam_(), u = f.users[email];
  if (!u) throw new Error('This Google account is not allowed in ' + (f.label || 'this Artha') + '.');
  const props = PropertiesService.getScriptProperties(), all = props.getProperties(), mine = [];
  Object.keys(all).forEach(k => {
    if (!/^s_/.test(k)) return;
    let s = null; try { s = JSON.parse(all[k]); } catch (x) { }
    if (!s || !f.users[s.email] || Date.now() - (s.seen || s.at) > SESSION_DAYS * 864e5) props.deleteProperty(k);
    else if (s.email === email) mine.push({ k: k, at: s.seen || s.at });
  });
  mine.sort((a, b) => a.at - b.at);
  while (mine.length >= MAX_SESSIONS) props.deleteProperty(mine.shift().k);
  const tok = hash_(Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + Date.now() + ':' + Math.random());
  props.setProperty('s_' + hash_(tok), JSON.stringify({ email: email, at: Date.now() }));
  USER_ = { email: email, name: u.name, role: u.role };
  try { audit_(book_(), 'sign-in', [['', null, null]], ''); } catch (x) { }
  return { tok: tok, name: u.name, email: email, role: u.role, fam: f.id, label: String(f.label || f.id) };
}
function logout_(tok) { if (/^[0-9a-f]{64}$/.test(String(tok || ''))) PropertiesService.getScriptProperties().deleteProperty('s_' + hash_(tok)); return true; }

/* ---------------- web app ---------------- */
function book_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('This Artha is not set up yet.');
  return SpreadsheetApp.openById(id);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({ ok: true, m: 'Artha family API v1' }); }   // no data and no page is ever served over GET
function doPost(ev) {
  try {
    const b = JSON.parse(ev.postData.contents), a = String(b.action || '');
    if (a === 'login') return json_({ ok: true, d: login_(b.e && b.e.idToken) });
    allow_(a, b.pass);
    const e = b.e || {};
    const d = a === 'get' ? getData_(e) : a === 'add' ? addRows_(e) : a === 'edit' ? editRow_(e) : a === 'del' ? delRow_(e) : a === 'rec' ? saveRecords_(e)
      : a === 'cal' ? syncCalendar_(e) : a === 'upload' ? uploadFile_(e) : logout_(b.pass);
    return json_({ ok: true, d: d });
  } catch (x) { return json_({ ok: false, m: String(x && x.message || x) }); }
}

/* ---------------- helpers ---------------- */
function num_(x) { if (typeof x === 'number') return x; if (x === '' || x == null) return NaN; const n = Number(String(x).replace(/[^\d.\-]/g, '')); return String(x).trim() === '' ? NaN : n; }
function str_(x) { return x == null ? '' : String(x).replace(/\s+/g, ' ').trim(); }
function day_(x, tz) {
  if (x instanceof Date) return Utilities.formatDate(x, tz, 'yyyy-MM-dd');
  const s = String(x == null ? '' : x).trim(); return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : '';
}
function toDate_(iso) { return iso ? Utilities.parseDate(iso, TZ, 'yyyy-MM-dd') : ''; }
function plain_(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 300); }
// Text bound for a sheet cell: a leading = + - @ is stored as plain text so Sheets never runs it as a formula.
function txt_(s, n) { const t = plain_(s, n); return /^[=+\-@]/.test(t) ? "'" + t : t; }
// A retried save carries the same request id and is never written twice. Checked in the 6-hour cache first, then in the
// Audit tab (which keeps every request id), so a phone that was offline for days cannot double-save either.
function once_(ss, rid, fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const key = rid ? String(rid).replace(/[^\w-]/g, '').slice(0, 40) : '', cache = CacheService.getScriptCache();
    if (key && (cache.get('rid:' + key) || seenRid_(ss, key))) return false;
    fn(key); SpreadsheetApp.flush(); if (key) cache.put('rid:' + key, '1', 21600);
    return true;
  } finally { lock.releaseLock(); }
}
function seenRid_(ss, key) {
  const sh = ss.getSheetByName(AUDIT); if (!sh || sh.getLastRow() < 2) return false;
  const n = Math.min(400, sh.getLastRow() - 1), v = sh.getRange(sh.getLastRow() - n + 1, 7, n, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === key) return true;
  return false;
}
function head_(sh, h, w) {
  sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#EEF1EF').setVerticalAlignment('middle');
  w.forEach((x, i) => sh.setColumnWidth(i + 1, x));
  if (sh.getMaxColumns() > h.length) sh.deleteColumns(h.length + 1, sh.getMaxColumns() - h.length);
  sh.setRowHeight(1, 28); sh.setFrozenRows(1);
}
function tab_(ss, name, cols, widths) {
  let sh = ss.getSheetByName(name); if (sh) return sh;
  sh = ss.insertSheet(name); head_(sh, cols, widths);
  if (name === LEDGER) { sh.getRange('B2:B').setNumberFormat(DATEF); sh.getRange('J2:K').setNumberFormat(INR); sh.getRange('I2:I').setNumberFormat('0.####'); }
  if (name === AUDIT) { sh.getRange('A2:A').setNumberFormat('dd mmm yyyy hh:mm'); sh.getRange(1, 1).setNote('Written by the Artha app on every change and sign-in. Do not edit.'); }
  return sh;
}
const ledTab_ = ss => tab_(ss, LEDGER, L_COLS, L_W);
const recTab_ = ss => tab_(ss, REC, REC_COLS, [190, 80, 260, 140, 600]);
const audTab_ = ss => tab_(ss, AUDIT, A_COLS, [150, 200, 80, 80, 520, 520, 120]);

/* ---------------- read ---------------- */
function readLed_(ss) {
  const tz = ss.getSpreadsheetTimeZone(), sh = ledTab_(ss), led = [], last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, L_COLS.length).getValues().forEach((r, i) => {
    const id = str_(r[0]); if (!id) return;
    const n = k => { const x = num_(r[k]); return isFinite(x) ? x : ''; };
    led.push([id, day_(r[1], tz), str_(r[2]), str_(r[3]), str_(r[4]), str_(r[5]), str_(r[6]), str_(r[7]), n(8), n(9), n(10), str_(r[11]), str_(r[12]), i + 2]);
  });
  return led;
}
function readRec_(ss) {
  const sh = ss.getSheetByName(REC); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().filter(r => str_(r[0])).map(r => {
    let d = {}; try { d = JSON.parse(r[4] || '{}'); } catch (x) { }
    return [str_(r[0]), str_(r[1]), d, str_(r[3])]; });
}
// The whole family's data. `stamp` changes whenever anything the phone shows changes; a phone that sends the stamp it
// already holds gets a ten-byte "same" answer instead of the whole ledger (faster opens, less mobile data).
function read_(ss, knownStamp) {
  const sh = ledTab_(ss), led = readLed_(ss), rec = readRec_(ss), fp = fp_(led), aud = auditTail_(ss);
  const stamp = hash_(fp.h + '|' + JSON.stringify(rec) + '|' + (aud.length ? aud[aud.length - 1].join('|') : '') + '|' + JSON.stringify(cfg_())).slice(0, 20);
  if (knownStamp && knownStamp === stamp) return { v: 3, same: true, stamp: stamp, at: new Date().toISOString() };
  return { v: 3, stamp: stamp, at: new Date().toISOString(), url: USER_ && USER_.role === 'admin' ? ss.getUrl() : '', gid: sh.getSheetId(), led: led,
    rec: rec.map(r => r.slice(0, 3)), files: USER_ && USER_.role === 'admin' ? filesUrl_() : '', fp: fp, chk: chk2_(led), audit: aud,
    me: USER_ ? USER_.name : '', cfg: cfg_() };
}
function getData_(e) { const ss = book_(); try { pullResults_(ss); } catch (x) { } return read_(ss, str_(e && e.stamp)); }

/* ---------------- write: ledger ---------------- */
function rowOf_(o) {
  o = o || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) throw new Error('Pick a date.');
  if (TYPES.indexOf(o.type) < 0) throw new Error('Unknown entry type: ' + plain_(o.type, 30));
  if (!str_(o.acct)) throw new Error('Pick an account.');
  if (fam_().people.indexOf(str_(o.who)) < 0) throw new Error('Choose whose money this is.');
  const n = x => { const v = num_(x); return isFinite(v) ? v : ''; };
  if (n(o.amt) === '') throw new Error('Enter an amount.');
  return [toDate_(o.date), txt_(o.who, 20), txt_(o.acct, 60), txt_(o.asset, 30), o.type, txt_(o.name, 120), txt_(o.code, 40),
    n(o.qty), n(o.price), n(o.amt), txt_(o.via, 20), txt_(o.note, 500)];
}
function nextIds_(sh, k) {
  const last = sh.getLastRow(); let mx = 0;
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(r => { const m = /^L(\d+)$/.exec(str_(r[0])); if (m) mx = Math.max(mx, +m[1]); });
  const ids = []; for (let i = 1; i <= k; i++) { const s = String(mx + i); ids.push('L' + (s.length < 4 ? ('000' + s).slice(-4) : s)); }   // L0001 … L9999, L10000 …
  return ids;
}
function sortLed_(sh) { if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, L_COLS.length).sort([{ column: 2, ascending: true }, { column: 1, ascending: true }]); }
function findRow_(sh, id) {
  const last = sh.getLastRow(); if (last < 2) return 0;
  const v = sh.getRange(2, 1, last - 1, 1).getValues(); for (let i = 0; i < v.length; i++) if (str_(v[i][0]) === id) return i + 2; return 0;
}
// e: {rows:[{date, who, acct, asset, type, name, code, qty, price, amt, via, note}], rid} → the data plus "added" (the new IDs)
function addRows_(e) {
  const ss = book_(), sh = ledTab_(ss);
  const rows = (e.rows || []).slice(0, 200).map(rowOf_); if (!rows.length) throw new Error('Nothing to add.');
  const ck = e.rid ? 'ids:' + String(e.rid).replace(/[^\w-]/g, '').slice(0, 40) : '', cache = CacheService.getScriptCache(); let added = null;
  once_(ss, e.rid, key => { const ids = nextIds_(sh, rows.length);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, L_COLS.length).setValues(rows.map((r, i) => [ids[i]].concat(r))); sortLed_(sh);
    audit_(ss, 'add', ids.map((id, i) => [id, null, [id].concat(rows[i])]), key);   // carries the request id: this is what stops a late retry adding it again
    added = ids; if (ck) cache.put(ck, JSON.stringify(ids), 21600); });
  if (!added && ck) { try { added = JSON.parse(cache.get(ck) || 'null'); } catch (x) { } }
  const out = read_(ss); out.added = added; return out;
}
function editRow_(e) {
  const ss = book_(), sh = ledTab_(ss), nv = rowOf_(e.row);
  once_(ss, e.rid, key => { const id = str_(e.id), r = findRow_(sh, id); if (!r) throw new Error('That entry is no longer in the sheet.');
    const before = sh.getRange(r, 1, 1, L_COLS.length).getValues()[0];
    audit_(ss, 'edit', [[id, before, [id].concat(nv)]], '');   // an edit repeated is harmless, so its request id is not kept
    sh.getRange(r, 2, 1, L_COLS.length - 1).setValues([nv]); sortLed_(sh); });
  return read_(ss);
}
function delRow_(e) {
  const ss = book_(), sh = ledTab_(ss);
  once_(ss, e.rid, key => { const id = str_(e.id), r = findRow_(sh, id); if (!r) return;
    audit_(ss, 'delete', [[id, sh.getRange(r, 1, 1, L_COLS.length).getValues()[0], null]], ''); sh.deleteRow(r); });   // copied to Audit before it is removed
  return read_(ss);
}

/* ---------------- records (bond / FD schedules, inbox items, calendar links, policies if switched on) ---------------- */
const REC_KINDS = ['bond', 'pol', 'pterm', 'inbox', 'cal', 'oth', 'chg', 'tds', 'lbl', 'goal'];
function saveRecords_(e) { const ss = book_(); recOps_(ss, (e.ops || []).slice(0, 100), e.rid, true); return read_(ss); }
function recOps_(ss, ops, rid, log) {
  const sh = recTab_(ss);
  once_(ss, rid, key => {
    if (log) audit_(ss, 'record', ops.slice(0, 40).map(o => [str_(o.id).slice(0, 80), null, [o.del ? 'deleted' : plain_(o.kind, 20), plain_(o.title, 80)]]), '');
    const last = sh.getLastRow(), ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => str_(r[0])) : [];
    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), dels = [], add = [];
    ops.forEach(o => {
      const id = str_(o.id).slice(0, 120); if (!id) return;
      const at = ids.indexOf(id);
      if (o.del) { if (at >= 0) dels.push(at + 2); return; }
      if (REC_KINDS.indexOf(o.kind) < 0) throw new Error('Unknown record kind.');
      const json = JSON.stringify(o.data || {});
      if (json.length > 49000) throw new Error('That record is too large to save.');
      const row = [txt_(id, 120), o.kind, txt_(o.title), now, json];
      if (at >= 0) sh.getRange(at + 2, 1, 1, 5).setValues([row]); else { add.push(row); ids.push(id); }
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 5).setValues(add);
    dels.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
  });
}
function recGet_(ss, id) { return readRec_(ss).filter(r => r[0] === id)[0] || null; }

/* ---------------- files in Drive: this family's own folder ---------------- */
function root_() {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('FILES_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) { } }
  const f = DriveApp.createFolder('Artha files – ' + (fam_().label || fam_().id)); p.setProperty('FILES_ID', f.getId()); return f;
}
function filesUrl_() { const id = PropertiesService.getScriptProperties().getProperty('FILES_ID'); return id ? 'https://drive.google.com/drive/folders/' + id : ''; }
const UPLOAD_ROOTS = ['Inbox', 'Insurance'];
function folder_(path) {
  let f = root_();
  const parts = String(path || '').split('/').map(s => s.replace(/[\\:*?"<>|]/g, '').replace(/^\.+/, '').trim().slice(0, 60)).filter(Boolean);
  if (parts.length && UPLOAD_ROOTS.indexOf(parts[0]) < 0) throw new Error('Files can only be saved in Inbox or Insurance.');
  if (parts.length > 4) throw new Error('Folder path too deep.');
  parts.forEach(name => { const it = f.getFoldersByName(name); f = it.hasNext() ? it.next() : f.createFolder(name); });
  return f;
}
const UPLOAD_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  csv: 'text/csv', txt: 'text/plain' };
const UPLOAD_MIME_EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };
// e: {name, mime, b64, path, desc}. File names that start with "artha-" are forced to this family's prefix, so a phone
// in this family can never write a file that the other family's Artha would pick up.
function uploadFile_(e) {
  if (!e.b64) throw new Error('No file received.');
  if (String(e.b64).length > 28 * 1024 * 1024) throw new Error('Files up to 20 MB only.');
  const bytes = Utilities.base64Decode(e.b64);
  if (bytes.length > 20 * 1024 * 1024) throw new Error('Files up to 20 MB only.');
  let name = String(e.name || 'file').replace(/[\\/]/g, '-').replace(/^\.+/, '').slice(0, 120) || 'file';
  const pre = 'artha-' + fam_().id + '-';
  if (/^artha-/i.test(name) && name.toLowerCase().indexOf(pre) !== 0) name = pre + name.replace(/^artha-/i, '');
  if (/-result-/i.test(name)) throw new Error('That file name is reserved.');   // results are written only by Claude, straight into Drive
  let ext = ((/\.([a-z0-9]{2,5})$/i.exec(name) || [])[1] || '').toLowerCase();
  if (!UPLOAD_TYPES[ext]) {
    const guess = UPLOAD_MIME_EXT[String(e.mime || '').toLowerCase()];
    if (!guess) throw new Error('Only PDFs, photos and spreadsheets can be uploaded.');
    ext = guess; name = name.slice(0, 114) + '.' + ext;
  }
  const mime = UPLOAD_TYPES[ext];
  const f = folder_(USER_.role === 'viewer' ? 'Inbox' : (e.path || 'Inbox')).createFile(Utilities.newBlob(bytes, mime, name));
  if (e.desc) f.setDescription(String(e.desc).slice(0, 2000));
  try { audit_(book_(), 'upload', [[f.getId().slice(0, 12), null, [name, bytes.length]]], ''); } catch (x) { }
  return { file: { id: f.getId(), name: name, url: f.getUrl(), mime: mime, size: bytes.length } };
}

/* ---------------- Claude inbox: "artha-<family id>-result-<ID>.json", written to Drive by Claude ---------------- */
function pullResults_(ss) {
  if (!readRec_(ss).some(r => r[1] === 'inbox' && r[2].status === 'new')) return;
  const pre = 'artha-' + fam_().id + '-result-';
  const it = DriveApp.searchFiles("'me' in owners and title contains '" + pre + "' and trashed = false"), ops = [];
  let n = 0;
  while (it.hasNext() && n < 20) {
    const f = it.next(); n++;
    const nm = f.getName(); if (nm.indexOf(pre) !== 0) continue;                // some other family's file: left alone
    const m = /^([\w-]+)\.json$/.exec(nm.slice(pre.length)); if (!m) continue;
    if (f.getSize() > 400000) continue;
    let res; try { res = JSON.parse(f.getBlob().getDataAsString()); } catch (x) { continue; }
    const cur = recGet_(ss, m[1]);
    if (!cur || cur[1] !== 'inbox') { try { f.setTrashed(true); } catch (x) { } continue; }
    const d = cur[2]; d.status = 'ready'; d.res = res; d.readyAt = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    ops.push({ id: m[1], kind: 'inbox', title: d.title || 'Inbox', data: d });
    try { f.setTrashed(true); } catch (x) { }
  }
  if (ops.length) recOps_(ss, ops, '', false);
}

/* ---------------- Google Calendar reminders (in the calendar of the account that owns this script) ---------------- */
function syncCalendar_(e) {
  const ss = book_(), cal = CalendarApp.getDefaultCalendar(), ops = [];
  (e.ops || []).slice(0, 60).forEach(o => {
    const key = 'cal:' + str_(o.key).slice(0, 110); if (key === 'cal:') return;
    const cur = recGet_(ss, key), old = cur && cur[2].ev;
    if (old) { try { const ev = cal.getEventById(old); if (ev) ev.deleteEvent(); } catch (x) { } }
    if (o.del || !/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) { if (cur) ops.push({ id: key, del: true }); return; }
    const start = Utilities.parseDate(o.date + ' 09:00', TZ, 'yyyy-MM-dd HH:mm'), end = new Date(start.getTime() + 15 * 60000);
    const ev = cal.createEvent((fam_().label || '') + ' · ' + (plain_(o.title) || 'Artha reminder'), start, end, { description: String(o.desc || '').slice(0, 1000) + '\n\nOpen Artha to confirm.' });
    ev.removeAllReminders(); ev.addPopupReminder(0); ev.addPopupReminder(1440);
    ops.push({ id: key, kind: 'cal', title: plain_(o.title), data: { ev: ev.getId(), date: o.date } });
  });
  if (ops.length) recOps_(ss, ops, e.rid, false);
  return read_(ss);
}

/* ---------------- audit, fingerprints, integrity ---------------- */
function audit_(ss, act, items, rid) {
  if (!items.length) return;
  const sh = audTab_(ss), now = new Date(), who = USER_ ? USER_.name + ' · ' + USER_.email : 'Unknown';
  const fmt = r => r ? JSON.stringify(r.map(v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : v)).slice(0, 49000) : '';
  sh.getRange(sh.getLastRow() + 1, 1, items.length, 7).setValues(items.map(x => [now, who, act, txt_(x[0], 80), fmt(x[1]), fmt(x[2]), rid || '']));
}
function auditTail_(ss) {
  const sh = ss.getSheetByName(AUDIT); if (!sh || sh.getLastRow() < 2) return [];
  const n = Math.min(300, sh.getLastRow() - 1);
  return sh.getRange(sh.getLastRow() - n + 1, 1, n, 4).getValues()
    .map(r => [r[0] instanceof Date ? r[0].toISOString() : String(r[0]), str_(r[1]).replace(/ · .*/, ''), str_(r[2]), str_(r[3])]);
}
// Same canonical form and hashes as Artha backend v5, so the phone's fingerprint check and tools/check.py work unchanged.
function canon_(r) { return r.slice(0, 13).map(v => v === '' || v == null ? '' : String(v)).join('\u001f'); }
function fp_(led) {
  const units = {}, all = [];
  led.slice().sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).forEach(r => {
    const k = r[3] + '|' + r[2], c = canon_(r); all.push(c);
    const u = units[k] || (units[k] = { n: 0, s: 0, c: [] }); u.n++; u.s += Number(r[10]) || 0; u.c.push(c);
  });
  const out = { n: all.length, s: 0, h: hash_(all.join('\u001e')).slice(0, 16), u: {} };
  Object.keys(units).forEach(k => { const u = units[k]; out.s += u.s; out.u[k] = { n: u.n, s: Math.round(u.s * 100) / 100, h: hash_(u.c.join('\u001e')).slice(0, 16) }; });
  out.s = Math.round(out.s * 100) / 100;
  return out;
}
function chk2_(led) {
  const seen = {}, bad = [], people = fam_().people;
  led.forEach(r => {
    const id = r[0], p = [];
    if (seen[id]) p.push('duplicate ID'); seen[id] = 1;
    if (!/^L\d+$/.test(id)) p.push('ID not in L0001 form');
    if (!r[1]) p.push('no valid date');
    if (TYPES.indexOf(r[5]) < 0) p.push('unknown type "' + r[5] + '"');
    if (!r[3]) p.push('no account');
    if (r[10] === '') p.push('amount missing or not a number');
    if (people.indexOf(r[2]) < 0) p.push('whose money "' + r[2] + '"');
    if (p.length) bad.push([id, r[13], p.join(', ')]);
  });
  return bad.slice(0, 60);
}

/* ---------------- run from the editor (none of these can be reached from the web: the web app serves no page) ---------------- */
// 1. Once, after setting the FAMILY script property. Creates the sheet (or uses SHEET_ID if you set one), tabs and Drive folder.
function setupFamily() {
  const f = fam_(), p = PropertiesService.getScriptProperties();
  let ss; const id = p.getProperty('SHEET_ID');
  if (id) ss = SpreadsheetApp.openById(id); else { ss = SpreadsheetApp.create('Artha – ' + (f.label || f.id)); p.setProperty('SHEET_ID', ss.getId()); }
  ss.setSpreadsheetTimeZone(TZ);
  ledTab_(ss); recTab_(ss); audTab_(ss);
  const first = ss.getSheetByName('Sheet1'); if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  root_(); folder_('Inbox'); CalendarApp.getDefaultCalendar();
  UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo', { muteHttpExceptions: true });   // asks for the sign-in check permission now
  Logger.log('Ready: ' + ss.getUrl() + '\nPeople: ' + f.people.join(', ') + '\nAllowed accounts: ' + Object.keys(f.users).map(k => k + ' (' + f.users[k].role + ')').join(', '));
}
// 2. After you change the FAMILY property (a new platform, a role, a parent's Gmail): run this to check it reads correctly.
function checkFamily() { FAM_ = null; const f = fam_(); Logger.log(JSON.stringify({ id: f.id, people: f.people, users: Object.keys(f.users).map(k => k.replace(/^(.{3}).*(@.*)$/, '$1…$2') + ' = ' + f.users[k].name + ' / ' + f.users[k].role), features: f.features }, null, 1)); }
// 3. Lost phone: signs out every phone of ONE person (pass their Gmail), or everyone when called with no argument from signOutEveryone().
function signOutOne(email) {
  email = String(email || '').toLowerCase(); if (!email) throw new Error('Edit the line below this function: signOutOne("their@gmail.com")');
  const p = PropertiesService.getScriptProperties(), all = p.getProperties(); let n = 0;
  Object.keys(all).forEach(k => { if (!/^s_/.test(k)) return; let s = null; try { s = JSON.parse(all[k]); } catch (x) { } if (!s || s.email === email) { p.deleteProperty(k); n++; } });
  Logger.log(n + ' session(s) signed out for ' + email);
}
function signOutEveryone() { const p = PropertiesService.getScriptProperties(); let n = 0; Object.keys(p.getProperties()).filter(k => /^s_/.test(k)).forEach(k => { p.deleteProperty(k); n++; }); Logger.log(n + ' phone(s) signed out.'); }
