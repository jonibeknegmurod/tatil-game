/**
 * TA'TIL QUEST — server qismi (Google Apps Script)
 * Baza: shu skript ulangan Google Sheets fayli. Barcha ma'lumot (missiyalar, yo'nalishlar, sozlamalar)
 * faqat jadvalda yashaydi — kod ichida shaxsiy ro'yxatlar yo'q.
 * Varaqlar: Missiyalar, Kategoriyalar, Qadamlar, Faollik, Xarajatlar, Kundalik, Sozlamalar, Hisobot
 */

var APP_NAME = 'Ta’til Quest';
var TZ = 'Asia/Tashkent';
var REPORT_VERSION = '2';

var SCHEMA = {
  Missiyalar: {
    key: 'id',
    cols: ['id', 'kategoriya', 'nomi', 'tur', 'holat', 'xp', 'maqsad_kun', 'reja_boshi', 'reja_oxiri', 'bajarilgan_sana', 'izoh', 'tartib'],
    dates: ['reja_boshi', 'reja_oxiri', 'bajarilgan_sana'], nums: ['xp', 'maqsad_kun', 'tartib']
  },
  Kategoriyalar: {
    key: 'id',
    cols: ['id', 'nomi', 'emoji', 'rang', 'xp', 'tartib'],
    nums: ['xp', 'tartib']
  },
  Qadamlar: {
    key: 'id',
    cols: ['id', 'missiya_id', 'nomi', 'bajarildi', 'sana', 'tartib'],
    dates: ['sana'], bools: ['bajarildi'], nums: ['tartib']
  },
  Faollik: {
    key: 'id',
    cols: ['id', 'missiya_id', 'sana', 'izoh'],
    dates: ['sana']
  },
  Xarajatlar: {
    key: 'id',
    cols: ['id', 'sana', 'summa', 'kategoriya', 'missiya_id', 'izoh'],
    dates: ['sana'], nums: ['summa']
  },
  Kundalik: {
    key: 'sana',
    cols: ['sana', 'kayfiyat', 'matn'],
    dates: ['sana'], nums: ['kayfiyat']
  },
  Sozlamalar: {
    key: 'kalit',
    cols: ['kalit', 'qiymat']
  }
};

// Missiya holatlari — ilova mantig'i (XP, foiz) shularga bog'liq, shuning uchun o'zgarmas.
var STATUSES = ['Rejada', 'Jarayonda', 'Bajarildi', 'O‘tkazib yuborildi'];

// Faqat BO'SH jadval uchun boshlang'ich yo'nalishlar. Keyin ular Kategoriyalar varag'ida yoki ilovada tahrirlanadi.
var STARTER_CATEGORIES = [
  ['Kino', '🎬', '#ff6b6b', 30], ['Sport', '🏋️', '#3ddc97', 40], ['Sayohat', '🧭', '#ffc857', 60],
  ['Sog‘liq', '🩺', '#ff8fab', 50], ['Kitob', '📚', '#d4a373', 60], ['Ibodat', '🕌', '#a78bfa', 50],
  ['Podcast', '🎧', '#5aa9ff', 30], ['O‘rganish', '🧠', '#ff9f1c', 50], ['Boshqa', '✨', '#9aa3c7', 30]
];

/* ---------- Web app ---------- */

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return api_(e.parameter);
  ensureSetup_();
  try {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle(APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  } catch (err) {
    return ContentService.createTextOutput(APP_NAME + ' API ishlayapti. Ilovani PWA havolasi orqali oching.');
  }
}

/** PWA (tashqi sayt) uchun JSON API. Body: {"key":"...","action":"getData|batch|ver|ping","args":[...]} */
function doPost(e) {
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'JSON noto‘g‘ri' }); }
  return api_(p);
}

function api_(p) {
  try {
    var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key || String(p.key || '') !== key) return json_({ ok: false, auth: true, error: 'Kalit noto‘g‘ri' });
    var args = p.args;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch (x) { args = []; } }
    args = args || [];
    var a = p.action, data;
    if (a === 'ping') data = { app: APP_NAME, ver: ver_() };
    else if (a === 'ver' || a === 'getVer') data = ver_();
    else if (a === 'getData') data = getData();
    else if (a === 'batch') data = batch(args[0], args[1]);
    else return json_({ ok: false, error: 'Noma’lum amal: ' + a });
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** HtmlService rejimi uchun (google.script.run) — joriy versiya. */
function getVer() { return ver_(); }

/** Ma'lumot o'zgarganini bildiruvchi belgi — qurilmalar shu orqali sinxronlashadi. */
function ver_() {
  return PropertiesService.getScriptProperties().getProperty('VER') || '0';
}
function bump_() {
  var v = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  PropertiesService.getScriptProperties().setProperty('VER', v);
  return v;
}

/** Jadvalni qo'lda tahrirlasangiz ham qurilmalar yangilanadi (oddiy trigger). */
function onEdit(e) {
  try {
    if (e && e.range && SCHEMA[e.range.getSheet().getName()]) bump_();
  } catch (err) { /* jim */ }
}

/** Bir marta muharrirdan ishga tushiring: ruxsat beradi, varaqlarni va API kalitini yaratadi. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('SSID');
  ensureSetup_();
  if (!props.getProperty('API_KEY')) props.setProperty('API_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 24));
  if (!props.getProperty('VER')) bump_();
  var msg = 'Tayyor! Jadval: ' + ss_().getUrl() + '\nAPI kaliti: ' + props.getProperty('API_KEY');
  Logger.log(msg);
  return msg;
}

/** Kalitni yo'qotib qo'ysangiz — shuni ishga tushiring, Log'da ko'rinadi. */
function kalitniKorsat() {
  var k = PropertiesService.getScriptProperties().getProperty('API_KEY');
  Logger.log('API kaliti: ' + k);
  return k;
}

/** Kalitni almashtirish (masalan, havola begonaga tushib qolsa). Qurilmalarda qayta ulanish kerak bo'ladi. */
function kalitniYangilash() {
  PropertiesService.getScriptProperties().setProperty('API_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 24));
  return kalitniKorsat();
}

/** Barcha ma'lumot — UI ochilganda bir marta chaqiriladi. */
function getData() {
  ensureSetup_();
  var ss = ss_();
  var out = {};
  Object.keys(SCHEMA).forEach(function (n) { out[n] = readAll_(ss, n); });
  out.meta = {
    exportUrl: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx',
    sheetUrl: ss.getUrl(),
    ver: ver_(),
    statuses: STATUSES,
    serverToday: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')
  };
  return out;
}

/**
 * Bir nechta o'zgarishni bitta so'rovda yozadi.
 * ops: [{op:'save', sheet:'Faollik', obj:{...}}, {op:'remove', sheet:'Faollik', key:'abc'}]
 */
function batch(ops, clientVer) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var before = ver_();
    if (!ops || !ops.length) return { res: [], ver: before, stale: clientVer != null && clientVer !== before };
    var ss = ss_();
    ops.forEach(function (op) {
      if (!SCHEMA[op.sheet]) throw new Error('Noma’lum varaq: ' + op.sheet);
      if (op.op !== 'save' && op.op !== 'remove') throw new Error('Noma’lum amal: ' + op.op);
    });
    var out = ops.map(function (op) {
      return op.op === 'save' ? save_(ss, op.sheet, op.obj || {}) : remove_(ss, op.sheet, op.key);
    });
    SpreadsheetApp.flush();
    var v = bump_();
    // stale=true: bu qurilma bilmagan o'zgarish bor edi (boshqa qurilma yoki qo'lda tahrir)
    return { res: out, ver: v, stale: clientVer != null && clientVer !== before };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Ichki yordamchilar ---------- */

function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SSID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Skript Google Sheets ichidan yaratilishi kerak: Kengaytmalar → Apps Script.');
  props.setProperty('SSID', ss.getId());
  return ss;
}

function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function header_(sh, def) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  if (head.length === 1 && head[0] === '') head = [];
  var changed = false;
  def.cols.forEach(function (c) {
    if (head.indexOf(c) < 0) { head.push(c); changed = true; }
  });
  if (changed) sh.getRange(1, 1, 1, head.length).setValues([head]);
  var idx = {};
  head.forEach(function (h, i) { if (h) idx[h] = i; });
  return { head: head, idx: idx };
}

function readCell_(def, col, v) {
  if (def.dates && def.dates.indexOf(col) >= 0) {
    if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    return v === '' || v == null ? '' : String(v).slice(0, 10);
  }
  if (def.bools && def.bools.indexOf(col) >= 0) return v === true || String(v).toUpperCase() === 'TRUE';
  if (def.nums && def.nums.indexOf(col) >= 0) return v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

function writeCell_(def, col, v) {
  if (def.dates && def.dates.indexOf(col) >= 0) return v ? String(v).slice(0, 10) : '';
  if (def.bools && def.bools.indexOf(col) >= 0) return v === true || v === 'true' || v === 'TRUE';
  if (def.nums && def.nums.indexOf(col) >= 0) return v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
  var s = v == null ? '' : String(v);
  return /^[=+@]/.test(s) ? "'" + s : s;
}

function readAll_(ss, name) {
  var def = SCHEMA[name];
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var h = header_(sh, def);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, h.head.length).getValues();
  var k = h.idx[def.key];
  return rows.filter(function (r) { return r[k] !== '' && r[k] != null; }).map(function (r) {
    var o = {};
    def.cols.forEach(function (c) { o[c] = readCell_(def, c, r[h.idx[c]]); });
    return o;
  });
}

function findRow_(sh, def, h, key) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var k = h.idx[def.key];
  var vals = sh.getRange(2, k + 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(readCell_(def, def.key, vals[i][0])) === String(key)) return i + 2;
  }
  return -1;
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function save_(ss, name, obj) {
  var def = SCHEMA[name];
  var sh = ss.getSheetByName(name);
  var h = header_(sh, def);
  if (!obj[def.key]) obj[def.key] = newId_();
  var r = findRow_(sh, def, h, obj[def.key]);
  var row;
  if (r > 0) {
    row = sh.getRange(r, 1, 1, h.head.length).getValues()[0];
    (def.dates || []).forEach(function (c) { if (h.idx[c] != null) row[h.idx[c]] = readCell_(def, c, row[h.idx[c]]); });
  } else {
    r = sh.getLastRow() + 1;
    row = h.head.map(function () { return ''; });
  }
  def.cols.forEach(function (c) {
    if (Object.prototype.hasOwnProperty.call(obj, c)) row[h.idx[c]] = writeCell_(def, c, obj[c]);
  });
  sh.getRange(r, 1, 1, row.length).setValues([row]);
  (def.bools || []).forEach(function (c) { sh.getRange(r, h.idx[c] + 1).insertCheckboxes(); });
  var saved = sh.getRange(r, 1, 1, h.head.length).getValues()[0];
  var o = {};
  def.cols.forEach(function (c) { o[c] = readCell_(def, c, saved[h.idx[c]]); });
  return o;
}

function deleteWhere_(ss, name, col, value) {
  var def = SCHEMA[name];
  var sh = ss.getSheetByName(name);
  var h = header_(sh, def);
  var last = sh.getLastRow();
  if (last < 2) return;
  var vals = sh.getRange(2, h.idx[col] + 1, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(value)) sh.deleteRow(i + 2);
  }
}

function remove_(ss, name, key) {
  var def = SCHEMA[name];
  var sh = ss.getSheetByName(name);
  var h = header_(sh, def);
  var r = findRow_(sh, def, h, key);
  if (r > 0) sh.deleteRow(r);
  if (name === 'Missiyalar') {
    deleteWhere_(ss, 'Qadamlar', 'missiya_id', key);
    deleteWhere_(ss, 'Faollik', 'missiya_id', key);
    var xs = ss.getSheetByName('Xarajatlar');
    var xh = header_(xs, SCHEMA.Xarajatlar);
    var last = xs.getLastRow();
    if (last >= 2) {
      var c = xh.idx.missiya_id + 1;
      var rng = xs.getRange(2, c, last - 1, 1);
      rng.setValues(rng.getValues().map(function (v) { return [String(v[0]) === String(key) ? '' : v[0]]; }));
    }
  }
  return { removed: key };
}


/* ---------- Sozlash va migratsiya ---------- */

function setupNeeded_(ss) {
  for (var n in SCHEMA) if (!ss.getSheetByName(n)) return true;
  if (!ss.getSheetByName('Hisobot')) return true;
  return PropertiesService.getScriptProperties().getProperty('REPORT_VERSION') !== REPORT_VERSION;
}

/** Yetishmayotgan varaqlarni yaratadi. Mavjud ma'lumotga tegmaydi — eski versiyadan yangilashda ham xavfsiz. */
function ensureSetup_() {
  var ss = ss_();
  if (!setupNeeded_(ss)) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!setupNeeded_(ss)) return;
    ss.setSpreadsheetTimeZone(TZ);
    var blank = ss.getSheets().filter(function (s) { return s.getLastRow() === 0 && !SCHEMA[s.getName()] && s.getName() !== 'Hisobot'; });

    Object.keys(SCHEMA).forEach(function (n) {
      var def = SCHEMA[n];
      var sh = ss.getSheetByName(n) || ss.insertSheet(n);
      if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]);
      header_(sh, def);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, def.cols.length).setFontWeight('bold').setBackground('#1F2A5A').setFontColor('#FFFFFF');
      def.cols.forEach(function (c, i) {
        var rng = sh.getRange(2, i + 1, 999, 1);
        if (def.dates && def.dates.indexOf(c) >= 0) rng.setNumberFormat('yyyy-mm-dd');
        else if (c === 'summa') rng.setNumberFormat('#,##0');
        else if (!(def.nums && def.nums.indexOf(c) >= 0) && !(def.bools && def.bools.indexOf(c) >= 0)) rng.setNumberFormat('@');
      });
    });

    seedCategories_(ss);
    seedSettings_(ss);
    buildReport_(ss);
    PropertiesService.getScriptProperties().setProperty('REPORT_VERSION', REPORT_VERSION);

    blank.forEach(function (s) { if (ss.getSheets().length > 1) ss.deleteSheet(s); });
    var ms = ss.getSheetByName('Missiyalar');
    ms.setColumnWidth(3, 320);
    ss.setActiveSheet(ms);
  } finally {
    lock.releaseLock();
  }
}

/** Kategoriyalar varag'i bo'sh bo'lsa to'ldiradi: avval jadvalda ishlatilgan yo'nalishlar, ular bo'lmasa — boshlang'ich ro'yxat. */
function seedCategories_(ss) {
  if (readAll_(ss, 'Kategoriyalar').length) return;
  var used = [];
  readAll_(ss, 'Missiyalar').concat(readAll_(ss, 'Xarajatlar')).forEach(function (o) {
    if (o.kategoriya && used.indexOf(o.kategoriya) < 0) used.push(o.kategoriya);
  });
  var style = {};
  STARTER_CATEGORIES.forEach(function (c) { style[c[0]] = c; });
  var palette = ['#ff6b6b', '#3ddc97', '#ffc857', '#5aa9ff', '#a78bfa', '#ff9f1c', '#ff8fab', '#d4a373'];
  var list = used.length
    ? used.map(function (n, i) { return style[n] || [n, '✨', palette[i % palette.length], 40]; })
    : STARTER_CATEGORIES;
  var rows = list.map(function (c, i) { return ['k' + ('0' + (i + 1)).slice(-2), c[0], c[1], c[2], c[3], i + 1]; });
  ss.getSheetByName('Kategoriyalar').getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function seedSettings_(ss) {
  var have = readAll_(ss, 'Sozlamalar').map(function (o) { return o.kalit; });
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var end = Utilities.formatDate(new Date(Date.now() + 13 * 864e5), TZ, 'yyyy-MM-dd');
  [['ism', ''], ['nomi', 'Ta’til'], ['boshlanish', today], ['tugash', end], ['byudjet', '']].forEach(function (kv) {
    if (have.indexOf(kv[0]) < 0) save_(ss, 'Sozlamalar', { kalit: kv[0], qiymat: kv[1] });
  });
}

/** Hisobot formulalari Kategoriyalar varag'idan o'qiydi — yangi yo'nalish qo'shilsa, o'zi paydo bo'ladi. */
function buildReport_(ss) {
  var sh = ss.getSheetByName('Hisobot') || ss.insertSheet('Hisobot');
  sh.clear();
  var mc = SCHEMA.Missiyalar.cols, xc = SCHEMA.Xarajatlar.cols, qc = SCHEMA.Qadamlar.cols, kc = SCHEMA.Kategoriyalar.cols;
  var L = function (cols, name) { return colLetter_(cols.indexOf(name) + 1); };
  var col = function (sheet, cols, name) { var c = L(cols, name); return sheet + '!' + c + ':' + c; };
  var KAT = col('Missiyalar', mc, 'kategoriya'), HOL = col('Missiyalar', mc, 'holat'), NOM = col('Missiyalar', mc, 'nomi');
  var SUM = col('Xarajatlar', xc, 'summa'), XKAT = col('Xarajatlar', xc, 'kategoriya');
  var QB = col('Qadamlar', qc, 'bajarildi'), KNOM = col('Kategoriyalar', kc, 'nomi');
  var MAXCAT = 30;

  var rows = [];
  rows.push(['TA’TIL QUEST — HISOBOT', '', '', '', '']);
  rows.push(['Formulalar avtomatik hisoblanadi. Yo‘nalishlar Kategoriyalar varag‘idan olinadi.', '', '', '', '']);
  rows.push(['Holat', 'Soni', 'Ulushi', '', '']);
  STATUSES.forEach(function (s, i) {
    var r = 4 + i;
    rows.push([s, '=COUNTIF(' + HOL + ',A' + r + ')', '=IFERROR(B' + r + '/B8,0)', '', '']);
  });
  rows.push(['Jami missiya', '=COUNTA(' + NOM + ')-1', '=IFERROR(SUM(B4:B7)/B8,0)', '', '']);
  rows.push(['', '', '', '', '']);
  rows.push(['Yo‘nalish', 'Jami', 'Bajarildi', 'Bajarilgan %', 'Xarajat (so‘m)']);
  for (var i = 0; i < MAXCAT; i++) {
    var r = 11 + i;
    var A = '$A' + r;
    rows.push([
      '=IFERROR(INDEX(' + KNOM + ',' + (i + 2) + ')&"","")',
      '=IF(' + A + '="","",COUNTIF(' + KAT + ',' + A + '))',
      '=IF(' + A + '="","",COUNTIFS(' + KAT + ',' + A + ',' + HOL + ',"Bajarildi"))',
      '=IF(' + A + '="","",IFERROR(C' + r + '/B' + r + ',0))',
      '=IF(' + A + '="","",SUMIF(' + XKAT + ',' + A + ',' + SUM + '))'
    ]);
  }
  var tr = 11 + MAXCAT;
  rows.push(['JAMI', '=SUM(B11:B' + (tr - 1) + ')', '=SUM(C11:C' + (tr - 1) + ')', '=IFERROR(C' + tr + '/B' + tr + ',0)', '=SUM(E11:E' + (tr - 1) + ')']);
  rows.push(['', '', '', '', '']);
  rows.push(['Jami xarajat (so‘m)', '=SUM(' + SUM + ')', '', '', '']);
  rows.push(['Faollik yozuvlari', '=COUNTA(Faollik!A:A)-1', '', '', '']);
  rows.push(['Bajarilgan qadamlar', '=COUNTIF(' + QB + ',TRUE)', '', '', '']);
  rows.push(['Kundalik yozuvlari', '=COUNTA(Kundalik!A:A)-1', '', '', '']);

  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange('A1').setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setFontColor('#777777').setFontStyle('italic');
  [3, 10].forEach(function (r) {
    sh.getRange(r, 1, 1, r === 3 ? 3 : 5).setFontWeight('bold').setBackground('#1F2A5A').setFontColor('#FFFFFF');
  });
  sh.getRange('C4:C8').setNumberFormat('0%');
  sh.getRange('D11:D' + tr).setNumberFormat('0%');
  sh.getRange('E11:E' + tr).setNumberFormat('#,##0');
  sh.getRange('B' + (tr + 2)).setNumberFormat('#,##0');
  sh.getRange(8, 1, 1, 3).setFontWeight('bold');
  sh.getRange(tr, 1, 1, 5).setFontWeight('bold');
  sh.setColumnWidth(1, 220);
}
