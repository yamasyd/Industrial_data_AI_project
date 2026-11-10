/* ATLAS: модель таблиц и импорт CSV / Excel.
   Каждый набор данных — отдельная таблица (лист Excel или CSV-файл).
   Колонки распознаются по названию (рус./англ.), порядок не важен. */
'use strict';

const SCHEMA = {
  costs: {
    title: 'Облачные расходы', hint: 'Помесячные затраты по сервисам: план, факт и объём операций',
    names: ['costs', 'расход', 'затрат', 'finops', 'cost'],
    fields: [
      { key: 'month', label: 'Месяц', type: 'month', req: true, alias: ['месяц', 'период', 'дата', 'month', 'period', 'date'], ex: '2026-01' },
      { key: 'service', label: 'Сервис', type: 'str', req: true, alias: ['сервис', 'система', 'продукт', 'проект', 'service', 'product'], ex: 'Мобильный банк' },
      { key: 'category', label: 'Категория', type: 'str', req: true, alias: ['категор', 'тип', 'вид', 'category', 'type'], ex: 'Вычисления' },
      { key: 'plan', label: 'План, млн ₽', type: 'num', req: false, alias: ['план', 'бюджет', 'plan', 'budget'], ex: '2,4' },
      { key: 'fact', label: 'Факт, млн ₽', type: 'num', req: true, alias: ['факт', 'расход', 'затрат', 'сумма', 'fact', 'actual', 'cost', 'spend'], ex: '2,51' },
      { key: 'volume', label: 'Транзакции, млн', type: 'num', req: false, alias: ['транзакц', 'операц', 'объем', 'объём', 'нагрузк', 'volume', 'transactions'], ex: '260' }
    ]
  },
  market: {
    title: 'Рынок облаков', hint: 'Выручка и доли поставщиков по годам',
    names: ['market', 'рынок', 'iaas', 'поставщ'],
    fields: [
      { key: 'year', label: 'Год', type: 'int', req: true, alias: ['год', 'year'], ex: '2024' },
      { key: 'provider', label: 'Поставщик', type: 'str', req: true, alias: ['поставщик', 'провайдер', 'компания', 'provider', 'vendor', 'company'], ex: 'Amazon' },
      { key: 'revenue', label: 'Выручка, млн USD', type: 'num', req: true, alias: ['выручк', 'доход', 'revenue', 'sales'], ex: '64804,9' },
      { key: 'share', label: 'Доля, %', type: 'num', req: false, alias: ['доля', 'share'], ex: '37,7' }
    ]
  },
  adoption: {
    title: 'Облака в бизнесе', hint: 'Доли компаний, использующих облака, по странам и сервисам',
    names: ['adoption', 'облака в бизнесе', 'eurostat', 'внедрен', 'использ'],
    fields: [
      { key: 'slice', label: 'Срез', type: 'str', req: true, alias: ['срез', 'группа', 'slice', 'group'], ex: 'Страны' },
      { key: 'name', label: 'Название', type: 'str', req: true, alias: ['название', 'страна', 'сервис', 'name', 'country'], ex: 'Финляндия' },
      { key: 'value', label: 'Доля, %', type: 'num', req: true, alias: ['доля', 'значение', 'value', 'share'], ex: '79,21' }
    ]
  },
  tech: {
    title: 'Технологический радар', hint: 'Технологии, статус внедрения и индекс готовности',
    names: ['tech', 'радар', 'технолог', 'radar'],
    fields: [
      { key: 'name', label: 'Технология', type: 'str', req: true, alias: ['технолог', 'кратко', 'name', 'tech'], ex: 'RAG' },
      { key: 'full', label: 'Полное название', type: 'str', req: false, alias: ['полное', 'full'], ex: 'RAG и база знаний' },
      { key: 'ring', label: 'Статус', type: 'ring', req: true, alias: ['статус', 'кольцо', 'ring', 'status'], ex: 'Внедрять / Пилотировать / Наблюдать' },
      { key: 'sector', label: 'Сектор', type: 'sector', req: true, alias: ['сектор', 'область', 'sector', 'area'], ex: 'Данные и ИИ / Облако / Операции / Доверие' },
      { key: 'score', label: 'Индекс 0–100', type: 'num', req: true, alias: ['индекс', 'оценка', 'балл', 'score', 'index'], ex: '76' },
      { key: 'horizon', label: 'Горизонт', type: 'str', req: false, alias: ['горизонт', 'срок', 'horizon'], ex: '0–6 мес.' },
      { key: 'metric', label: 'Метрика пилота', type: 'str', req: false, alias: ['метрик', 'metric', 'kpi'], ex: 'Точность ответов' },
      { key: 'desc', label: 'Описание', type: 'str', req: false, alias: ['описан', 'desc'], ex: '' },
      { key: 'step', label: 'Следующий шаг', type: 'str', req: false, alias: ['шаг', 'следующ', 'step', 'next'], ex: '' }
    ]
  },
  risks: {
    title: 'Реестр рисков', hint: 'Риски с оценкой вероятности и влияния по шкале 1–5',
    names: ['risk', 'риск'],
    fields: [
      { key: 'name', label: 'Риск', type: 'str', req: true, alias: ['риск', 'название', 'risk', 'name'], ex: 'Утечка данных' },
      { key: 'p', label: 'Вероятность 1–5', type: 'scale', req: true, alias: ['вероятн', 'probab', 'likelihood'], ex: '3' },
      { key: 'i', label: 'Влияние 1–5', type: 'scale', req: true, alias: ['влиян', 'ущерб', 'impact', 'severity'], ex: '5' },
      { key: 'owner', label: 'Владелец', type: 'str', req: false, alias: ['владел', 'ответств', 'owner'], ex: 'CISO' },
      { key: 'act', label: 'Мера', type: 'str', req: false, alias: ['мера', 'действ', 'action', 'mitigation'], ex: '' },
      { key: 'why', label: 'Причина', type: 'str', req: false, alias: ['причин', 'почему', 'why', 'cause'], ex: '' },
      { key: 'status', label: 'Статус', type: 'status', req: false, alias: ['статус', 'status'], ex: 'В работе / Выполнено' }
    ]
  }
};
const SECTORS = ['Данные и ИИ', 'Облако', 'Операции', 'Доверие'];
const RINGS = ['Внедрять', 'Пилотировать', 'Наблюдать'];

/* ---------- normalisation ---------- */
const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9%]+/g, '');
const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').trim().replace(/[\s  ₽$€%]|руб\.?|usd|млн|млрд/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');   // 1.234,5
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');    // 1,234.5
  s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const pad = n => String(n).padStart(2, '0');
function parseMonth(v) {
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + pad(v.getMonth() + 1);
  if (typeof v === 'number' && v > 20000 && v < 80000) { // Excel serial date
    const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
  }
  const s = String(v ?? '').trim().toLowerCase();
  let m;
  if ((m = s.match(/^(\d{4})[-./](\d{1,2})([-./]\d{1,2})?/))) return m[1] + '-' + pad(+m[2]);
  if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/))) return m[3] + '-' + pad(+m[2]);   // 15.01.2026
  if ((m = s.match(/^(\d{1,2})[-./](\d{4})$/))) return m[2] + '-' + pad(+m[1]);              // 01.2026
  if ((m = s.match(/^([a-zа-яё]+)\.?\s*[-/ ]?\s*(\d{2,4})$/))) {
    const w = m[1].slice(0, 3).replace('ё', 'е'); let k = MONTHS_RU.indexOf(w); if (k < 0) k = MONTHS_EN.indexOf(w);
    if (w === 'мая') k = 4;
    if (k >= 0) { const y = m[2].length === 2 ? '20' + m[2] : m[2]; return y + '-' + pad(k + 1) }
  }
  return null;
}
function pickFrom(list, v) {
  const n = norm(v); if (!n) return null;
  const idx = list.findIndex(x => norm(x).startsWith(n.slice(0, 5)) || n.startsWith(norm(x).slice(0, 5)));
  if (idx >= 0) return list[idx];
  const num = parseInt(n, 10); return num >= 1 && num <= list.length ? list[num - 1] : null;
}
const RING_EN = { adopt: 0, trial: 1, pilot: 1, assess: 2, hold: 2, watch: 2 };
function convert(type, v) {
  switch (type) {
    case 'str': { const s = String(v ?? '').trim(); return s || null }
    case 'num': return parseNum(v);
    case 'int': { const n = parseNum(v); return n != null && Number.isInteger(n) ? n : null }
    case 'month': return parseMonth(v);
    case 'scale': { const n = parseNum(v); return n != null && n >= 1 && n <= 5 ? Math.round(n) : null }
    case 'ring': { const en = RING_EN[norm(v)]; return en != null ? RINGS[en] : pickFrom(RINGS, v) }
    case 'sector': return pickFrom(SECTORS, v);
    case 'status': return /выполн|готов|закрыт|done|closed|complete/i.test(String(v)) ? 'Выполнено' : 'В работе';
  }
  return v;
}

/* ---------- header mapping and dataset detection ---------- */
function mapHeaders(key, headers) {
  const used = new Set(), map = {};
  SCHEMA[key].fields.forEach(f => {
    const exact = headers.findIndex((h, i) => !used.has(i) && (norm(h) === norm(f.label) || norm(h) === f.key));
    const idx = exact >= 0 ? exact : headers.findIndex((h, i) => !used.has(i) && f.alias.some(a => norm(h).startsWith(norm(a))));
    if (idx >= 0) { map[f.key] = idx; used.add(idx) }
  });
  return map;
}
function detectDataset(name, headers) {
  const n = String(name || '').toLowerCase();
  const byName = Object.keys(SCHEMA).find(k => SCHEMA[k].names.some(x => n.includes(x)));
  const fits = k => SCHEMA[k].fields.filter(f => f.req).every(f => f.key in mapHeaders(k, headers));
  if (byName && fits(byName)) return byName;
  let best = byName || null, score = 0;
  Object.keys(SCHEMA).forEach(k => {
    const map = mapHeaders(k, headers), req = SCHEMA[k].fields.filter(f => f.req);
    const hit = req.filter(f => f.key in map).length;
    const s = hit === req.length ? hit + Object.keys(map).length / 10 : 0;
    if (s > score) { score = s; best = k }
  });
  return best;
}

/* ---------- rows -> typed records ---------- */
function buildDataset(key, table) {
  const headerRow = table.findIndex(r => r.filter(c => String(c ?? '').trim()).length >= 2);
  if (headerRow < 0) return { key, rows: [], errors: ['Не найдена строка заголовков'], missing: [] };
  const headers = table[headerRow].map(c => String(c ?? '').trim());
  const map = mapHeaders(key, headers);
  const missing = SCHEMA[key].fields.filter(f => f.req && !(f.key in map)).map(f => f.label);
  if (missing.length) return { key, rows: [], errors: [], missing };
  const rows = [], errors = [];
  table.slice(headerRow + 1).forEach((r, k) => {
    if (!r || r.every(c => String(c ?? '').trim() === '')) return;
    const rec = {}, bad = [];
    SCHEMA[key].fields.forEach(f => {
      const raw = f.key in map ? r[map[f.key]] : null;
      const val = raw == null || String(raw).trim() === '' ? null : convert(f.type, raw);
      if (val == null && raw != null && String(raw).trim() !== '') bad.push(`${f.label}: «${String(raw).slice(0, 24)}»`);
      if (val == null && f.req) { if (!bad.length || !bad[bad.length - 1].startsWith(f.label)) bad.push(`${f.label}: пусто`) }
      rec[f.key] = val ?? (f.type === 'status' ? 'В работе' : f.type === 'str' ? '' : null);
    });
    const reqBad = SCHEMA[key].fields.some(f => f.req && rec[f.key] == null);
    if (reqBad) errors.push(`строка ${headerRow + k + 2}: ${bad.join(', ')}`);
    else rows.push(rec);
  });
  if (key === 'market') {               // доля из выручки, если колонка не заполнена
    const years = [...new Set(rows.map(r => r.year))];
    years.forEach(y => {
      const ys = rows.filter(r => r.year === y), tot = ys.reduce((a, r) => a + r.revenue, 0);
      ys.forEach(r => { if (r.share == null) r.share = tot ? +(r.revenue / tot * 100).toFixed(1) : 0 });
    });
  }
  if (key === 'tech') rows.forEach(r => { r.full = r.full || r.name; r.score = Math.max(0, Math.min(100, r.score)) });
  return { key, rows, errors, missing };
}

/* ---------- file readers ---------- */
function splitCSV(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const delim = [';', '\t', ','].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = '' }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row) }
  return out;
}
function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '') }
  catch { return new TextDecoder('windows-1251').decode(buf) }   // CSV из русского Excel
}
async function readFileTables(file) {
  const buf = await file.arrayBuffer();
  const base = file.name.replace(/\.[^.]+$/, '');
  if (/\.(csv|tsv|txt)$/i.test(file.name)) return [{ name: base, table: splitCSV(decodeText(buf)) }];
  if (!window.XLSX) throw new Error('Библиотека Excel не загрузилась. Проверьте интернет или сохраните таблицу как CSV');
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  return wb.SheetNames.map(n => ({ name: wb.SheetNames.length > 1 ? n : n + ' ' + base, table: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }));
}

/** Разбирает файлы и возвращает { datasets: {key: rows}, report: [...] } */
async function importFiles(files) {
  const datasets = {}, report = [];
  for (const file of files) {
    let tables;
    try { tables = await readFileTables(file) }
    catch (e) { report.push({ file: file.name, ok: false, msg: e.message || 'Не удалось прочитать файл' }); continue }
    for (const t of tables) {
      if (/^(справка|help|readme|инструкц)/i.test(t.name)) continue;
      const label = tables.length > 1 ? `${file.name} → ${t.name}` : file.name;
      const hr = t.table.find(r => r.filter(c => String(c ?? '').trim()).length >= 2) || [];
      const key = detectDataset(t.name, hr.map(String));
      if (!key) { if (t.table.length) report.push({ file: label, ok: false, msg: 'Не удалось определить тип таблицы. Сверьте заголовки с шаблоном' }); continue }
      const res = buildDataset(key, t.table);
      if (res.missing.length) { report.push({ file: label, key, ok: false, msg: `Нет обязательных колонок: ${res.missing.join(', ')}` }); continue }
      if (!res.rows.length) { report.push({ file: label, key, ok: false, msg: 'Нет корректных строк', errors: res.errors }); continue }
      datasets[key] = (datasets[key] || []).concat(res.rows);
      report.push({ file: label, key, ok: true, rows: res.rows.length, skipped: res.errors.length, errors: res.errors });
    }
  }
  return { datasets, report };
}

/* ---------- exports ---------- */
function datasetToTable(key, rows) {
  const f = SCHEMA[key].fields;
  return [f.map(x => x.label), ...rows.map(r => f.map(x => r[x.key] ?? ''))];
}
