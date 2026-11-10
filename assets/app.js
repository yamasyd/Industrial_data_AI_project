/* ATLAS: логика портала. Все дашборды строятся из DATA, который можно заменить загруженными таблицами. */
'use strict';
const $ = id => document.getElementById(id);
const ico = n => `<svg class="ico"><use href="#i-${n}"/></svg>`;
const fmt = (n, d = 1) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (a, f = x => x) => a.reduce((s, x) => s + (f(x) || 0), 0);
const uniq = a => [...new Set(a)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many };
const NUM_WORDS = ['Ноль', 'Один', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять'];
const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const monLabel = m => { const [y, mo] = m.split('-'); return MON[+mo - 1] + ' ' + y.slice(2) };

function readStore(k, f) { try { const v = JSON.parse(localStorage.getItem('atlas-' + k)); return v ?? f } catch { return f } }
function writeStore(k, v) { try { localStorage.setItem('atlas-' + k, JSON.stringify(v)); return true } catch { toast('Браузер не разрешил сохранение. Данные действуют до закрытия страницы'); return false } }

/* ================= DATA STATE ================= */
const stored = readStore('data-v1', null);
const DATA = {}, META = {};
Object.keys(SCHEMA).forEach(k => {
  const custom = stored && stored.datasets && Array.isArray(stored.datasets[k]) && stored.datasets[k].length;
  DATA[k] = custom ? stored.datasets[k] : DEMO_DATA[k];
  if (custom) META[k] = stored.meta[k];
});
function persistData() {
  const ds = {}; Object.keys(META).forEach(k => ds[k] = DATA[k]);
  if (!Object.keys(META).length) { try { localStorage.removeItem('atlas-data-v1') } catch { } return }
  writeStore('data-v1', { datasets: ds, meta: META });
}

let bookmarks = readStore('bookmarks', []); if (!Array.isArray(bookmarks)) bookmarks = []; bookmarks = bookmarks.filter(id => articles.some(a => a.id === id));
let done = readStore('done', []); if (!Array.isArray(done)) done = [];
let controlled = readStore('controlled-names', null);
let year = null, mode = 'share', adoptSlice = null, resFilter = 'all', riskFilter = 'all', selRisk = 0, selTech = 0, costCat = 'all', previewKey = 'costs';

/* ================= HELPERS ================= */
let toastT;
function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200) }
function download(name, text, type = 'text/plain;charset=utf-8') { downloadBlob(name, new Blob([text], { type })) }
function downloadBlob(name, b) { const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); toast('Файл скачан') }
function csv(name, rows) { download(name, '﻿' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n'), 'text/csv;charset=utf-8') }
function setSeg(sel, attr, val) { document.querySelectorAll(sel).forEach(b => b.classList.toggle('on', b.dataset[attr] === String(val))) }
function barsHTML(rows, max, unit, d = 1, topN = 0) {
  return rows.map(([n, v], i) => `<div class="bar${i < topN ? ' top' : ''}"><span title="${esc(n)}">${esc(n)}</span><div class="track"><div class="fill" data-w="${max ? Math.max(0, Math.min(100, v / max * 100)) : 0}"></div></div><b>${fmt(v, d)}${unit}</b></div>`).join('')
}
function growBars(host) { requestAnimationFrame(() => requestAnimationFrame(() => host.querySelectorAll('.fill').forEach(f => f.style.width = f.dataset.w + '%'))) }
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const SERIES = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => css('--s' + i));

/* ================= CITY: банк как миниатюрный город ================= */
// Районы: Ядро → расходы, Облако → рынок, ИИ → радар, Контроль → риски. veil приглушает город под плотными дашбордами.
const CAMS = {
  hero: { pos: [46, 40, 54], look: [-2, 0, 2], shift: .27, orbit: 1, labels: 'districts' },
  facts: { pos: [14, 66, 62], look: [0, 0, -4], labels: 'districts', veil: .2 },
  data: { pos: [0, 96, 14], look: [0, 0, 0], fov: 26, labels: 'none', veil: .85 },
  costs: { pos: [-36, 22, 6], look: [-12, 3, -12], labels: 'none', veil: .85 },
  market: { pos: [21, 17, 21], look: [11.5, 6, -12], labels: 'none', veil: .6 },
  ai: { pos: [36, 17, 40], look: [12, 4, 12], labels: 'none', veil: .6 },
  risks: { pos: [-44, 22, 38], look: [-11, 6, 10], labels: 'none', alert: 1, veil: .6 },
  plan: { pos: [0, 96, 14], look: [0, 0, 0], fov: 26, labels: 'none', veil: .85 },
  finops: { pos: [-20, 15, 46], look: [-18, 0, 6], labels: 'none', veil: .6 },
  research: { pos: [60, 56, 64], look: [0, 0, 0], labels: 'none', veil: .85 },
  sources: { pos: [0, 120, 46], look: [0, 0, 0], labels: 'none', veil: .88 }
};
const COVERS = [
  { id: 'growth', pos: [24, 7, 1], look: [12, 6, -12], bg: '#CFE6FF' },
  { id: 'ai', pos: [22, 9, 24], look: [12, 4.5, 12], bg: '#E3DEFF' },
  { id: 'strategy', pos: [-4, 6, 0], look: [-12, 2.6, -12], bg: '#FFEFC2' },
  { id: 'finops', pos: [-22, 4.5, 36], look: [2, 0, 26], bg: '#D9F2E5' },
  { id: 'europe', pos: [52, 46, 56], look: [0, 0, 0], bg: '#E4ECF6' },
  { id: 'models', pos: [-6, 15, -36], look: [8, 3, -10], bg: '#FFE0E6' }
];
const DISTRICT_TO_SECTION = { core: 'costs', cloud: 'market', ai: 'ai', control: 'risks' };
let city = null, coversMap = {}, cityTried = false;
let minimal = !!readStore('minimal', false);
function initCity() {   // город создаётся только когда нужен: в минималистичной версии three.js не нагружает страницу
  if (cityTried) return; cityTried = true;
  try {
    city = window.createCity ? createCity($('stage'), {
      labelHost: $('labels'), bg: '#FAFAF8',
      onPick: k => { const id = DISTRICT_TO_SECTION[k]; if (id) $(id).scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }) }
    }) : null;
  } catch (e) { console.warn('ATLAS: 3D недоступно', e); city = null }
  if (!city) { document.documentElement.classList.add('no-webgl'); return }
  try { coversMap = city.covers(COVERS) } catch (e) { coversMap = {} }
  renderMarket(); renderResearch(); cityTheme();
  requestAnimationFrame(() => city.start());
}
function paintModeBtn() {
  const b = $('modeBtn'); if (!b) return;
  b.querySelector('.t').textContent = minimal ? 'Версия с городом' : 'Минималистичная версия';
  b.setAttribute('aria-pressed', minimal); b.title = minimal ? 'Показать 3D-город на фоне' : 'Убрать 3D-город и оставить только данные';
}
function toggleMinimal() {
  // высота первого экрана меняется, поэтому держим в кадре тот же раздел
  const anchor = scrollY > 10 ? camSecs.find(s => s.getBoundingClientRect().bottom > 80) : null, off = anchor ? anchor.getBoundingClientRect().top : 0;
  minimal = !minimal; writeStore('minimal', minimal);
  document.documentElement.classList.toggle('minimal', minimal);
  if (anchor) scrollTo({ top: anchor.getBoundingClientRect().top + scrollY - off, behavior: 'instant' });
  if (minimal) { if (city) city.freeze(true) } else if (city) city.freeze(false); else initCity();
  paintModeBtn(); measure(); onScroll();
  toast(minimal ? 'Минималистичная версия: только данные' : 'Город снова на фоне');
}
function cityTheme() { if (city) city.setTarget({ ...CAMS[lastKey ? $(lastKey).dataset.cam : 'hero'], bg: css('--bg') }); if (city) onScroll() }
function coverImg(id, alt = '') { return coversMap[id] ? `<img src="${coversMap[id]}" alt="${esc(alt)}" loading="lazy">` : '' }

/* ================= THEME ================= */
(function initTheme() { const t = readStore('theme', null); if (t) document.documentElement.dataset.theme = t })();
function toggleTheme() {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark'; writeStore('theme', dark ? 'light' : 'dark');
  renderCharts(); renderRadar(); cityTheme();
}

/* ================= CHARTS (Chart.js) ================= */
const charts = {};
function chartBase(extra = {}) {
  const muted = css('--muted'), grid = css('--grid');
  return {
    responsive: true, maintainAspectRatio: false, animation: REDUCED ? false : { duration: 500 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: css('--surface'), titleColor: css('--ink'), bodyColor: css('--ink-2'), borderColor: css('--line-2'), borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true, titleFont: { family: 'Onest', weight: '600' }, bodyFont: { family: 'Onest' } }
    },
    scales: {
      x: { grid: { display: false }, border: { color: css('--line-2') }, ticks: { color: muted, font: { family: 'Onest', size: 12 }, maxRotation: 0, autoSkipPadding: 12 } },
      y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { family: 'Onest', size: 12 }, maxTicksLimit: 5, callback: v => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) } }
    },
    ...extra
  };
}
function drawChart(id, config) {
  const el = $(id); if (!el) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id] }
  const host = el.parentElement; host.querySelector('.empty-state')?.remove(); el.style.display = '';
  if (!window.Chart) { emptyChart(id, 'Графики не загрузились: нет доступа к cdn.jsdelivr.net'); return }
  charts[id] = new Chart(el, config);
}
function emptyChart(id, msg) {
  const el = $(id); if (charts[id]) { charts[id].destroy(); delete charts[id] }
  el.style.display = 'none'; const host = el.parentElement; host.querySelector('.empty-state')?.remove();
  host.insertAdjacentHTML('beforeend', `<div class="empty-state">${esc(msg)}</div>`);
}
function renderCharts() { renderCosts(); renderMarket() }

/* ================= KPI ROW ================= */
function marketYears() { return uniq(DATA.market.map(r => r.year)).sort((a, b) => a - b) }
function renderKPI() {
  const ys = marketYears(), ly = ys[ys.length - 1], py = ys[ys.length - 2];
  const rev = y => sum(DATA.market.filter(r => r.year === y), r => r.revenue) / 1000;
  const growth = py != null && rev(py) ? (rev(ly) / rev(py) - 1) * 100 : null;
  const top3 = top3Share(DATA.market.filter(r => r.year === ly));
  const c = DATA.costs, months = uniq(c.map(r => r.month)).sort(), last12 = months.slice(-12);
  const spend = sum(c.filter(r => last12.includes(r.month)), r => r.fact);
  const planSum = sum(c.filter(r => last12.includes(r.month) && r.plan != null), r => r.plan);
  const dev = planSum ? (spend / planSum - 1) * 100 : null;
  const high = DATA.risks.filter(r => r.p * r.i >= 15);
  const highOpen = high.filter(r => !isControlled(r)).length;
  const tile = (go, label, val, sub) => `<button class="card kpi" onclick="$('${go}').scrollIntoView({behavior:REDUCED?'auto':'smooth'})"><span class="label">${label}</span><span class="val num">${val}</span><span class="sub">${sub}</span></button>`;
  $('kpiRow').innerHTML = [
    tile('market', `Рынок IaaS, ${ly ?? '—'}`, ly ? `$${fmt(rev(ly))}<small>млрд</small>` : '—', growth != null ? `<span class="${growth >= 0 ? 'delta-up' : 'delta-down'}">${growth >= 0 ? '+' : ''}${fmt(growth)}%</span> к ${py}` : 'одна точка данных'),
    tile('market', 'Доля трёх лидеров', ly ? `${fmt(top3)}<small>%</small>` : '—', 'концентрация рынка'),
    tile('costs', `Облачные расходы, ${last12.length} мес.`, months.length ? `${fmt(spend)}<small>млн ₽</small>` : '—', dev != null ? `<span class="${dev > 0 ? 'delta-down' : 'delta-up'}">${dev > 0 ? '+' : ''}${fmt(dev)}%</span> к плану` : 'план не указан'),
    tile('risks', 'Высокие риски в работе', `${highOpen}<small>из ${DATA.risks.length}</small>`, `${high.length} ${plural(high.length, 'риск', 'риска', 'рисков')} с баллом от 15`)
  ].join('');
  const custom = Object.keys(META).length;
  $('dataBadge').classList.toggle('custom', !!custom);
  $('dataBadge').querySelector('span').textContent = custom ? `Ваши данные: ${Object.keys(META).map(k => SCHEMA[k].title.toLowerCase()).join(', ')}` : 'Демонстрационные данные. Загрузите свои в разделе «Данные»';
}

/* ================= DATA SECTION ================= */
function renderDataSection() {
  $('dsList').innerHTML = Object.keys(SCHEMA).map(k => {
    const m = META[k];
    return `<li><div class="nm"><b>${SCHEMA[k].title}</b><small>${SCHEMA[k].hint}</small></div><span class="ds-state${m ? ' custom' : ''}">${m ? `● ${esc(m.file)}, ${DATA[k].length} стр.` : `демо, ${DATA[k].length} стр.`}</span><span>${m ? `<button class="btn ghost sm" onclick="resetData('${k}')">Сбросить</button>` : `<a class="btn ghost sm" href="templates/${k}.csv" download>CSV</a>`}</span></li>`;
  }).join('');
  $('previewSeg').innerHTML = Object.keys(SCHEMA).map(k => `<button data-pk="${k}" class="${k === previewKey ? 'on' : ''}" onclick="setPreview('${k}')">${SCHEMA[k].title}</button>`).join('');
  renderPreview();
}
function setPreview(k) { previewKey = k; setSeg('[data-pk]', 'pk', k); renderPreview() }
function renderPreview() {
  const k = previewKey, f = SCHEMA[k].fields, rows = DATA[k], LIM = 200;
  const isNum = x => ['num', 'int', 'scale'].includes(x.type);
  $('previewInfo').textContent = `${META[k] ? 'Загружено: ' + META[k].file + ', ' + META[k].date : 'Демонстрационные данные'} · ${rows.length} ${plural(rows.length, 'строка', 'строки', 'строк')}${rows.length > LIM ? `, показаны первые ${LIM}` : ''}`;
  $('preview').innerHTML = `<table class="tbl"><thead><tr>${f.map(x => `<th class="${isNum(x) ? 'n' : ''}">${esc(x.label)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, LIM).map(r => `<tr>${f.map(x => { const v = r[x.key]; return `<td class="${isNum(x) ? 'n' : ''}"${x.key === 'desc' || x.key === 'act' || x.key === 'why' || x.key === 'step' ? ` title="${esc(v)}"` : ''}>${v == null || v === '' ? '<span style="color:var(--muted)">—</span>' : isNum(x) ? fmt(v, x.type === 'num' ? 2 : 0).replace(/,00$/, '') : esc(String(v).length > 48 ? String(v).slice(0, 46) + '…' : v)}</td>` }).join('')}</tr>`).join('')}</tbody></table>`;
  $('schemaBox').innerHTML = `<summary>Модель таблицы «${SCHEMA[k].title}»</summary><p>Лист Excel или CSV-файл с колонками ниже. Порядок колонок не важен, названия распознаются по началу слова на русском или английском. Числа можно писать с запятой. ${k === 'costs' ? 'Месяц: 2026-01, 01.2026, «янв 2026» или дата Excel.' : ''}${k === 'market' ? 'Если доля не указана, она считается из выручки внутри года.' : ''}${k === 'risks' ? 'Балл риска = вероятность × влияние, высокий от 15.' : ''}</p><dl>${SCHEMA[k].fields.map(x => `<dt class="${x.req ? 'req' : ''}">${esc(x.label)}</dt><dd>${typeDesc(x)}${x.ex ? `, например: ${esc(x.ex)}` : ''}</dd>`).join('')}</dl><p><a class="link" href="templates/${k}.csv" download>Скачать пример, CSV</a></p>`;
}
function typeDesc(x) { return { str: 'текст', num: 'число', int: 'целое число', month: 'месяц', scale: 'число от 1 до 5', ring: 'Внедрять, Пилотировать или Наблюдать', sector: 'один из секторов', status: 'В работе или Выполнено' }[x.type] }

async function handleFiles(files) {
  files = [...files].filter(f => /\.(csv|tsv|txt|xlsx|xls)$/i.test(f.name));
  if (!files.length) { toast('Поддерживаются файлы .xlsx, .xls и .csv'); return }
  $('report').innerHTML = '<div>Читаю файлы…</div>';
  const { datasets, report } = await importFiles(files);
  const date = new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  Object.entries(datasets).forEach(([k, rows]) => {
    DATA[k] = rows; META[k] = { file: report.filter(r => r.ok && r.key === k).map(r => r.file).join(', '), date };
    if (k === 'tech') selTech = 0;
    if (k === 'risks') { selRisk = 0; controlled = null }
    if (k === 'market') year = null;
  });
  persistData();
  $('report').innerHTML = report.map(r => r.ok
    ? `<div><b>${SCHEMA[r.key].title}</b>: ${r.rows} ${plural(r.rows, 'строка', 'строки', 'строк')} из «${esc(r.file)}»${r.skipped ? `, пропущено ${r.skipped}` : ''}${r.skipped ? `<small>${r.errors.slice(0, 3).map(esc).join('<br>')}${r.errors.length > 3 ? '<br>…' : ''}</small>` : ''}</div>`
    : `<div class="err"><b>${esc(r.file)}</b>: ${esc(r.msg)}${r.errors ? `<small>${r.errors.slice(0, 3).map(esc).join('<br>')}</small>` : ''}</div>`).join('') || '<div class="err">В файлах не найдено таблиц</div>';
  const keys = Object.keys(datasets);
  if (keys.length) { previewKey = keys[0]; renderAll(); toast('Дашборды обновлены: ' + keys.map(k => SCHEMA[k].title).join(', ')) }
}
function resetData(k) {
  (k ? [k] : Object.keys(SCHEMA)).forEach(key => { DATA[key] = DEMO_DATA[key]; delete META[key] });
  if (!k || k === 'risks') controlled = null;
  if (!k || k === 'market') year = null;
  selTech = 0; selRisk = 0; persistData(); $('report').innerHTML = ''; renderAll();
  toast(k ? `«${SCHEMA[k].title}»: возвращены демо-данные` : 'Возвращены демонстрационные данные');
}
function workbook(src) {
  const wb = XLSX.utils.book_new();
  Object.keys(SCHEMA).forEach(k => {
    const ws = XLSX.utils.aoa_to_sheet(datasetToTable(k, src[k]));
    ws['!cols'] = SCHEMA[k].fields.map(f => ({ wch: Math.max(12, f.label.length + 2, ['desc', 'act', 'why', 'step'].includes(f.key) ? 40 : 0) }));
    XLSX.utils.book_append_sheet(wb, ws, SCHEMA[k].title.slice(0, 31));
  });
  const help = [['Набор', 'Колонка', 'Обязательная', 'Тип', 'Пример']];
  Object.keys(SCHEMA).forEach(k => SCHEMA[k].fields.forEach(f => help.push([SCHEMA[k].title, f.label, f.req ? 'да' : 'нет', typeDesc(f), f.ex])));
  const hs = XLSX.utils.aoa_to_sheet(help); hs['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 13 }, { wch: 36 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, hs, 'Справка');
  return wb;
}
function downloadTemplate() {
  if (!window.XLSX) { location.href = 'templates/costs.csv'; toast('Excel недоступен, скачан CSV-пример'); return }
  XLSX.writeFile(workbook(DEMO_DATA), 'atlas-template.xlsx'); toast('Шаблон скачан: по листу на каждый набор данных');
}
function exportAll() {
  if (!window.XLSX) { csv(`atlas-${previewKey}.csv`, datasetToTable(previewKey, DATA[previewKey])); return }
  XLSX.writeFile(workbook(DATA), 'atlas-data.xlsx'); toast('Текущие данные скачаны');
}
(function initDrop() {
  const d = $('drop'), inp = $('fileIn');
  inp.addEventListener('change', () => { handleFiles(inp.files); inp.value = '' });
  d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click() } });
  ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add('over') }));
  ['dragleave', 'drop'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.remove('over') }));
  d.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  // файлы, брошенные мимо зоны, не должны открываться браузером
  addEventListener('dragover', e => e.preventDefault()); addEventListener('drop', e => { if (!d.contains(e.target)) e.preventDefault() });
})();

/* ================= COSTS DASHBOARD ================= */
function costCategories() {
  const tot = {}; DATA.costs.forEach(r => tot[r.category] = (tot[r.category] || 0) + r.fact);
  return Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
}
function catColor(cat) {   // цвет закреплён за категорией, а не за её местом в фильтре
  const cats = costCategories(), i = cats.indexOf(cat), S = SERIES();
  return i >= 0 && i < 7 ? S[i] : css('--muted');
}
const catKey = cat => { const cats = costCategories(); return cats.indexOf(cat) < 7 ? cat : 'Другое' };
function setCostCat(c) { costCat = c; setSeg('[data-cc]', 'cc', c); renderCosts() }
function renderCosts() {
  const all = DATA.costs, cats = costCategories();
  if (costCat !== 'all' && !cats.includes(costCat)) costCat = 'all';
  $('catSeg').innerHTML = `<button data-cc="all" class="${costCat === 'all' ? 'on' : ''}" onclick="setCostCat('all')">Все</button>` + cats.slice(0, 7).map(c => `<button data-cc="${esc(c)}" class="${costCat === c ? 'on' : ''}" onclick="setCostCat(this.dataset.cc)">${esc(c)}</button>`).join('');
  const rows = costCat === 'all' ? all : all.filter(r => r.category === costCat);
  const months = uniq(all.map(r => r.month)).sort();
  if (!rows.length) { $('costKpi').innerHTML = ''; ['chPlanFact', 'chCats', 'chUnit'].forEach(id => emptyChart(id, 'Нет данных')); $('svcTable').innerHTML = ''; return }
  $('costsLead').textContent = `${monLabel(months[0])} – ${monLabel(months[months.length - 1])}, ${uniq(all.map(r => r.service)).length} ${plural(uniq(all.map(r => r.service)).length, 'сервис', 'сервиса', 'сервисов')}. Факт против плана, структура затрат и стоимость одной операции.`;
  const byM = m => rows.filter(r => r.month === m);
  const factM = months.map(m => sum(byM(m), r => r.fact));
  const hasPlan = rows.some(r => r.plan != null);
  const planM = months.map(m => { const p = byM(m).filter(r => r.plan != null); return p.length ? sum(p, r => r.plan) : null });

  // KPI
  const fact = sum(rows, r => r.fact), plan = sum(rows.filter(r => r.plan != null), r => r.plan);
  const factWithPlan = sum(rows.filter(r => r.plan != null), r => r.fact);
  const dev = plan ? factWithPlan - plan : null, devP = plan ? (factWithPlan / plan - 1) * 100 : null;
  const last3 = factM.slice(-3), runRate = last3.length ? sum(last3) / last3.length * 12 : 0;
  const first3 = factM.slice(0, 3), trend = months.length >= 6 && sum(first3) ? (sum(last3) / sum(first3) - 1) * 100 : null;
  let fastest = null;
  if (costCat === 'all' && months.length >= 6) {
    cats.forEach(c => {
      const f = ms => sum(all.filter(r => r.category === c && ms.includes(r.month)), r => r.fact);
      const a = f(months.slice(0, 3)), b = f(months.slice(-3)); if (a > 0) { const g = (b / a - 1) * 100; if (!fastest || g > fastest.g) fastest = { c, g } }
    });
  }
  const tile = (label, val, sub) => `<div class="card kpi"><span class="label">${label}</span><span class="val num">${val}</span><span class="sub">${sub}</span></div>`;
  $('costKpi').innerHTML = [
    tile('Факт за период', `${fmt(fact)}<small>млн ₽</small>`, `${months.length} ${plural(months.length, 'месяц', 'месяца', 'месяцев')}`),
    tile('Отклонение от плана', dev != null ? `${dev > 0 ? '+' : ''}${fmt(dev)}<small>млн ₽</small>` : '—', devP != null ? `<span class="${devP > 0 ? 'delta-down' : 'delta-up'}">${devP > 0 ? '▲ перерасход ' : '▼ экономия '}${fmt(Math.abs(devP))}%</span>` : 'план не загружен'),
    tile('Прогноз на год', `${fmt(runRate)}<small>млн ₽</small>`, 'по среднему за 3 последних месяца'),
    fastest ? tile('Быстрее всего растёт', esc(fastest.c), `<span class="${fastest.g > 0 ? 'delta-down' : 'delta-up'}">${fastest.g > 0 ? '+' : ''}${fmt(fastest.g)}%</span> последние 3 мес. к первым 3`)
      : tile('Динамика расходов', trend != null ? `${trend > 0 ? '+' : ''}${fmt(trend)}<small>%</small>` : '—', 'последние 3 мес. к первым 3')
  ].join('');

  const labels = months.map(monLabel), S1 = css('--s1'), ink2 = css('--ink-2');
  const money = c => `${c.dataset.label}: ${fmt(c.parsed.y, 2)} млн ₽`;
  // 1. Факт и план
  drawChart('chPlanFact', {
    type: 'bar', data: {
      labels, datasets: [
        { type: 'bar', label: 'Факт', data: factM, backgroundColor: costCat === 'all' ? S1 : catColor(costCat), borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 32, order: 2 },
        ...(hasPlan ? [{ type: 'line', label: 'План', data: planM, borderColor: ink2, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: ink2, tension: .25, spanGaps: true, order: 1 }] : [])
      ]
    }, options: chartBase({ plugins: { ...chartBase().plugins, tooltip: { ...chartBase().plugins.tooltip, callbacks: { label: money, footer: it => { const f = it.find(x => x.dataset.label === 'Факт'), p = it.find(x => x.dataset.label === 'План'); return f && p && p.parsed.y ? `Отклонение: ${f.parsed.y >= p.parsed.y ? '+' : ''}${fmt((f.parsed.y / p.parsed.y - 1) * 100)}%` : '' } } } } })
  });
  // 2. Структура по категориям (stacked)
  const catsShown = costCat === 'all' ? uniq(cats.map(catKey)) : [costCat];
  $('catLegend').innerHTML = catsShown.map(c => `<span><i style="background:${c === 'Другое' ? css('--muted') : catColor(c)}"></i>${esc(c)}</span>`).join('');
  const base2 = chartBase();
  drawChart('chCats', {
    type: 'bar', data: {
      labels, datasets: catsShown.map(c => ({
        label: c, data: months.map(m => sum(all.filter(r => r.month === m && catKey(r.category) === c), r => r.fact)),
        backgroundColor: c === 'Другое' ? css('--muted') : catColor(c), borderColor: css('--surface'), borderWidth: { top: 2 }, borderSkipped: false, maxBarThickness: 26
      }))
    }, options: { ...base2, plugins: { ...base2.plugins, tooltip: { ...base2.plugins.tooltip, callbacks: { label: money, footer: it => 'Всего: ' + fmt(sum(it, x => x.parsed.y), 2) + ' млн ₽' } } }, scales: { x: { ...base2.scales.x, stacked: true }, y: { ...base2.scales.y, stacked: true } } }
  });
  // 3. Стоимость 1000 транзакций
  const unit = months.map(m => { const v = byM(m).filter(r => r.volume > 0); const vol = sum(v, r => r.volume); return vol ? sum(v, r => r.fact) / vol * 1000 : null });
  if (unit.every(v => v == null)) emptyChart('chUnit', 'Добавьте колонку «Транзакции, млн», чтобы увидеть стоимость операции' + (costCat !== 'all' ? ' в этой категории' : ''));
  else drawChart('chUnit', {
    type: 'line', data: { labels, datasets: [{ label: 'Стоимость 1000 транзакций', data: unit, borderColor: S1, backgroundColor: S1, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: .25, spanGaps: true }] },
    options: chartBase({ plugins: { ...chartBase().plugins, tooltip: { ...chartBase().plugins.tooltip, callbacks: { label: c => `${fmt(c.parsed.y, 2)} ₽ за 1000 транзакций` } } }, scales: { ...chartBase().scales, y: { ...chartBase().scales.y, beginAtZero: false, ticks: { ...chartBase().scales.y.ticks, callback: v => fmt(v, 1) } } } })
  });
  // 4. Таблица сервисов
  const svc = uniq(rows.map(r => r.service)).map(s => {
    const rs = rows.filter(r => r.service === s), f = sum(rs, r => r.fact), p = rs.some(r => r.plan != null) ? sum(rs.filter(r => r.plan != null), r => r.plan) : null, fp = sum(rs.filter(r => r.plan != null), r => r.fact);
    return { s, cat: rs[0].category, f, p, d: p ? (fp / p - 1) * 100 : null };
  }).sort((a, b) => b.f - a.f);
  $('svcTable').innerHTML = `<table class="tbl"><thead><tr><th>Сервис</th><th>Категория</th><th class="n">План, млн ₽</th><th class="n">Факт, млн ₽</th><th class="n">Отклонение</th><th class="n">Доля</th></tr></thead><tbody>${svc.map(x => `<tr><td>${esc(x.s)}</td><td><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:${catColor(x.cat)}"></i>${esc(x.cat)}</span></td><td class="n">${x.p != null ? fmt(x.p, 2) : '—'}</td><td class="n">${fmt(x.f, 2)}</td><td class="n ${x.d > 0 ? 'delta-down' : 'delta-up'}">${x.d != null ? (x.d > 0 ? '▲ +' : '▼ ') + fmt(x.d) + '%' : '—'}</td><td class="n">${fmt(x.f / fact * 100)}%</td></tr>`).join('')}</tbody></table>`;
}

/* ================= MARKET ================= */
function setYear(y) { year = y; setSeg('[data-year]', 'year', y); renderMarket() }
function setMode(m) { mode = m; setSeg('[data-mode]', 'mode', m); renderMarket() }
const isOther = n => /^(друг|прочие|прочее|остальн|other)/i.test(n);
const top3Share = rows => sum(rows.filter(r => !isOther(r.provider)).sort((a, b) => b.share - a.share).slice(0, 3), r => r.share);
function providerOrder() {   // поставщики в порядке выручки последнего года; «Другие» всегда в конце
  const ys = marketYears(), ly = ys[ys.length - 1], tot = {};
  DATA.market.forEach(r => tot[r.provider] = (tot[r.provider] || 0) + (r.year === ly ? r.revenue * 1e6 : r.revenue));
  return Object.keys(tot).sort((a, b) => isOther(a) - isOther(b) || tot[b] - tot[a]);
}
function renderMarket() {
  const ys = marketYears(); if (!ys.length) return;
  if (!ys.includes(year)) year = ys[ys.length - 1];
  $('yearSeg').innerHTML = ys.slice(-6).map(y => `<button data-year="${y}" class="${y === year ? 'on' : ''}" onclick="setYear(${y})">${y}</button>`).join('');
  const share = mode === 'share', yr = DATA.market.filter(r => r.year === year);
  const order = providerOrder();
  const rows = yr.slice().sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider)).map(r => [r.provider, share ? r.share : r.revenue / 1000]);
  const max = Math.max(...rows.map(r => r[1]), 0) * 1.05;
  $('marketBarsTitle').textContent = `Поставщики, ${year}: ${share ? 'доля, %' : 'выручка, млрд USD'}`;
  $('marketBars').innerHTML = barsHTML(rows, max, share ? '%' : '', 1, 3);
  growBars($('marketBars'));
  if (city) {   // башни в районе «Облако» = поставщики выбранного года (до 6)
    const tw = rows.slice(0, 6), mx = Math.max(...tw.map(r => r[1]), 1);
    city.setTowers([0, 1, 2, 3, 4, 5].map(k => tw[k] ? tw[k][1] / mx * 16 : 0));
    [0, 1, 2, 3, 4, 5].forEach(k => {
      const r = tw[k], src = r && yr.find(x => x.provider === r[0]);
      city.setLabelText('t' + k, r ? `${esc(r[0])}<em>${share ? fmt(src.share) + '%' : '$' + fmt(src.revenue / 1000, 0) + ' млрд'}</em>` : '');
    });
  }
  const top3 = top3Share(yr);
  $('top3').textContent = fmt(top3) + '%';
  $('marketTitle').textContent = `Три компании держат ${fmt(top3, 0)}% облачного рынка`;
  // линия выручки по годам
  const provs = order.slice(0, 8), S = SERIES();
  $('mktLegend').innerHTML = provs.map((p, i) => `<span><i style="background:${S[i]}"></i>${esc(p)}</span>`).join('');
  if (ys.length < 2) { emptyChart('chMarket', 'Для динамики нужны данные минимум за два года'); return }
  drawChart('chMarket', {
    type: 'line', data: {
      labels: ys.map(String), datasets: provs.map((p, i) => ({
        label: p, data: ys.map(y => { const r = DATA.market.find(x => x.year === y && x.provider === p); return r ? r.revenue / 1000 : null }),
        borderColor: S[i], backgroundColor: S[i], borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: css('--surface'), pointBorderWidth: 2, tension: .2, spanGaps: true
      }))
    }, options: chartBase({ plugins: { ...chartBase().plugins, tooltip: { ...chartBase().plugins.tooltip, itemSort: (a, b) => b.parsed.y - a.parsed.y, callbacks: { label: c => `${c.dataset.label}: $${fmt(c.parsed.y)} млрд` } } } })
  });
}
function setAdopt(s) { adoptSlice = s; setSeg('[data-as]', 'as', s); renderAdoption() }
function renderAdoption() {
  const slices = uniq(DATA.adoption.map(r => r.slice));
  if (!slices.includes(adoptSlice)) adoptSlice = slices[0];
  $('adoptSeg').innerHTML = slices.map(s => `<button data-as="${esc(s)}" class="${s === adoptSlice ? 'on' : ''}" onclick="setAdopt(this.dataset.as)">${esc(s)}</button>`).join('');
  const d = DATA.adoption.filter(r => r.slice === adoptSlice).sort((a, b) => b.value - a.value).map(r => [r.name, r.value]);
  $('euBars').innerHTML = barsHTML(d, 100, '%', 1, 0); growBars($('euBars'));
}
function exportMarket() { csv(`atlas-market.csv`, datasetToTable('market', DATA.market)) }

/* ================= RADAR ================= */
function techList() {   // угол внутри сектора распределяется равномерно
  const out = [];
  SECTORS.forEach((s, si) => {
    const inS = DATA.tech.filter(t => t.sector === s);
    inS.forEach((t, k) => out.push({ ...t, ringI: RINGS.indexOf(t.ring), sectorI: si, a: (k + 1) / (inS.length + 1) }));
  });
  return out;
}
function techPos(t) {
  const R = [62, 118, 172][t.ringI], r0 = [0, 62, 118][t.ringI];
  const r = r0 + (R - r0) * (t.ringI === 0 ? .6 : .5 + (t.a - .5) * .4);
  const ang = (-90 + t.sectorI * 90 + t.a * 90) * Math.PI / 180;
  return [200 + Math.cos(ang) * r, 200 + Math.sin(ang) * r];
}
let TECHS = [];
function renderRadar() {
  TECHS = techList(); if (selTech >= TECHS.length) selTech = 0;
  const svg = $('radar'), cols = [css('--s1'), css('--s4'), css('--muted')];
  let h = '';
  [172, 118, 62].forEach(r => h += `<circle class="ring" cx="200" cy="200" r="${r}"/>`);
  h += `<path class="axis" d="M200 22V378M22 200H378"/>`;
  [[SECTORS[0], 396, 16, 'end'], [SECTORS[1], 396, 396, 'end'], [SECTORS[2], 4, 396, 'start'], [SECTORS[3], 4, 16, 'start']].forEach(([s, x, y, a]) => h += `<text class="sector" x="${x}" y="${y}" text-anchor="${a}">${s}</text>`);
  TECHS.forEach((t, i) => {
    const [x, y] = techPos(t), right = x > 200;
    h += `<g class="dot${i === selTech ? ' on' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(t.full)}, ${t.ring}"><circle cx="${x}" cy="${y}" r="16" fill="transparent"/><circle class="c" cx="${x}" cy="${y}" r="6" fill="${cols[t.ringI]}" stroke="${css('--surface')}" stroke-width="2"/><text x="${right ? x - 12 : x + 12}" y="${y + 4}" text-anchor="${right ? 'end' : 'start'}">${esc(t.name)}</text></g>`;
  });
  svg.innerHTML = h;
  svg.querySelectorAll('.dot').forEach(g => { const i = +g.dataset.i; g.onclick = () => pickTech(i); g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickTech(i) } } });
  if (TECHS.length) pickTech(selTech); else $('techDetail').innerHTML = '<p class="muted">В таблице нет технологий.</p>';
}
function pickTech(i) {
  selTech = i; const t = TECHS[i]; if (!t) return;
  document.querySelectorAll('#radar .dot').forEach(g => g.classList.toggle('on', +g.dataset.i === i));
  $('techDetail').innerHTML = `<span class="pill ${t.ringI === 0 ? '' : t.ringI === 1 ? 'mid' : 'lo'}">${t.ring}</span><h3 class="h3" style="margin-top:12px;font-size:20px">${esc(t.full)}</h3><div class="score num">${fmt(t.score, 0)}<small> / 100</small></div><span class="small">индекс готовности</span>${t.desc ? `<p>${esc(t.desc)}</p>` : ''}<div class="kv"><div><small>Горизонт</small><b>${esc(t.horizon || '—')}</b></div><div><small>Метрика пилота</small><b>${esc(t.metric || '—')}</b></div></div>${t.step ? `<p style="margin:0"><b>Следующий шаг.</b> ${esc(t.step)}</p>` : ''}`;
}

/* ================= RISKS ================= */
const lvl = v => v >= 15 ? 'h' : v >= 6 ? 'm' : 'l';
function isControlled(r) { return controlled ? controlled.includes(r.name) : r.status === 'Выполнено' }
function controlledList() { return controlled || DATA.risks.filter(r => r.status === 'Выполнено').map(r => r.name) }
function renderRisks() {
  const R = DATA.risks; if (selRisk >= R.length) selRisk = 0;
  const n = R.length;
  $('risksTitle').textContent = n ? `${n <= 10 ? NUM_WORDS[n] : n} ${plural(n, 'риск', 'риска', 'рисков')}, у каждого есть владелец` : 'Рисков нет';
  let h = '';
  for (let p = 5; p >= 1; p--) {
    h += `<span class="ax">${p}</span>`;
    for (let i = 1; i <= 5; i++) {
      const v = p * i;
      h += `<div class="cell ${lvl(v)}" title="Вероятность ${p} × влияние ${i} = ${v}">${R.map((r, k) => r.p === p && r.i === i ? `<button data-r="${k}" class="${k === selRisk ? 'on' : ''}${isControlled(r) ? ' done' : ''}" onclick="pickRisk(${k})" aria-label="Риск ${k + 1}: ${esc(r.name)}">${k + 1}</button>` : '').join('')}</div>`;
    }
  }
  h += '<span></span>' + [1, 2, 3, 4, 5].map(x => `<span class="ax">${x}</span>`).join('');
  $('heat').innerHTML = h;
  renderRiskList(); if (n) pickRisk(selRisk, true); else $('riskDetail').innerHTML = '';
}
function pickRisk(i) {
  const r = DATA.risks[i]; if (!r) return;
  selRisk = i; const v = r.p * r.i, isDone = isControlled(r);
  document.querySelectorAll('#heat button').forEach(b => b.classList.toggle('on', +b.dataset.r === i));
  $('riskDetail').innerHTML = `<span class="pill ${v >= 15 ? 'hi' : v >= 6 ? 'mid' : 'lo'}">${v} из 25, ${v >= 15 ? 'высокий' : v >= 6 ? 'умеренный' : 'низкий'}</span><h3 class="h3" style="margin-top:12px;font-size:19px">${i + 1}. ${esc(r.name)}</h3>${r.why ? `<p class="muted">${esc(r.why)}</p>` : ''}<div class="kv"><div><small>Вероятность</small><b>${r.p} из 5</b></div><div><small>Влияние</small><b>${r.i} из 5</b></div></div>${r.act ? `<p><b>Мера.</b> ${esc(r.act)}</p>` : ''}${r.owner ? `<p class="small" style="margin-top:-6px">Владелец: ${esc(r.owner)}</p>` : ''}<button class="toggle${isDone ? ' done' : ''}" onclick="toggleRisk(${i})">${isDone ? '✓ Мера выполнена' : 'Отметить меру выполненной'}</button>`;
}
function filterRisks(f) { riskFilter = f; setSeg('[data-rf]', 'rf', f); renderRiskList() }
function renderRiskList() {
  const rows = DATA.risks.map((r, id) => ({ ...r, id })).filter(r => riskFilter === 'all' || (riskFilter === 'high' && r.p * r.i >= 15) || (riskFilter === 'open' && !isControlled(r)));
  $('riskList').innerHTML = rows.length ? rows.map(r => `<li><button class="nm" onclick="pickRisk(${r.id})">${r.id + 1}. ${esc(r.name)}</button><span class="pill ${r.p * r.i >= 15 ? 'hi' : r.p * r.i >= 6 ? 'mid' : 'lo'}">${r.p * r.i}</span><span class="own">${isControlled(r) ? '✓ выполнено' : esc(r.owner)}</span></li>`).join('') : '<li class="muted">Нет рисков в этом фильтре.</li>';
}
function toggleRisk(i) {
  const r = DATA.risks[i], list = controlledList();
  controlled = list.includes(r.name) ? list.filter(x => x !== r.name) : [...list, r.name];
  writeStore('controlled-names', controlled); renderRisks(); pickRisk(i); renderKPI();
  toast(isControlled(r) ? 'Мера отмечена выполненной' : 'Мера возвращена в работу');
}

/* ================= PLAN ================= */
function renderPlan() {
  $('steps').innerHTML = priorities.map((p, i) => `<div class="card step${done.includes(i) ? ' is-done' : ''}"><span class="n">0${i + 1}</span><span class="when">${p.time}</span><h3>${p.title}</h3><p>${p.text}</p><span class="who">Отвечают: ${p.owner}</span><button class="toggle${done.includes(i) ? ' done' : ''}" onclick="togglePlan(${i})">${done.includes(i) ? '✓ Готово' : 'Отметить готовым'}</button></div>`).join('');
}
function togglePlan(i) { done = done.includes(i) ? done.filter(x => x !== i) : [...done, i]; writeStore('done', done); renderPlan(); toast(done.includes(i) ? 'Решение отмечено готовым' : 'Решение возвращено в работу') }
function planText() { return priorities.map((p, i) => `${i + 1}. ${p.title}\n${p.text}\nОтвечают: ${p.owner}. Срок: ${p.time}. Статус: ${done.includes(i) ? 'готово' : 'в работе'}\n`).join('\n') }
function downloadPlan() { download('atlas-cio-90-day-plan.txt', 'ATLAS. План CIO на 90 дней\n\n' + planText() + '\nРекомендации ATLAS, не результат аудита банка.\nОснова: ' + sources[4].url) }

/* ================= FINOPS ================= */
let calc = {};
const RANGES = [['budget', 'b', 10, 500], ['growth', 'g', 0, 80], ['efficiency', 'e', 0, 40], ['investment', 'c', 1, 60]];
function paintRange(el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%') }
function calculate() {
  const b = +$('budget').value, g = +$('growth').value, e = +$('efficiency').value, c = +$('investment').value;
  RANGES.forEach(([id]) => paintRange($(id)));
  calc = { b, g, e, c, base: b * (1 + g / 100) };
  calc.save = calc.base * e / 100; calc.net = calc.save - c; calc.total = calc.base - calc.save + c;
  calc.pay = calc.save > 0 ? c / (calc.save / 12) : Infinity; calc.roi = calc.net / c * 100;
  $('budgetOut').textContent = fmt(b, 0) + ' млн ₽'; $('growthOut').textContent = g + '%'; $('efficiencyOut').textContent = e + '%'; $('investmentOut').textContent = c + ' млн ₽';
  $('growthHead').textContent = g + '%';
  $('net').innerHTML = (calc.net > 0 ? '+' : '') + fmt(calc.net) + '<small>млн ₽</small>'; $('net').classList.toggle('neg', calc.net < 0);
  $('baseline').textContent = fmt(calc.base) + ' млн ₽'; $('optimized').textContent = fmt(calc.total) + ' млн ₽';
  $('payback').textContent = Number.isFinite(calc.pay) ? fmt(calc.pay) + ' мес.' : 'не окупается'; $('roi').textContent = fmt(calc.roi, 0) + '%';
  const vals = [b, calc.base, calc.total], mx = Math.max(...vals);
  $('cols').innerHTML = vals.map((v, i) => `<div><b>${fmt(v, 0)}</b><i style="height:${Math.max(4, v / mx * 90)}px"></i><span>${['Сейчас', 'С ростом', 'С FinOps'][i]}</span></div>`).join('');
}
function setCalc(o) { RANGES.forEach(([id, k, mn, mx]) => { if (Number.isFinite(o[k])) $(id).value = Math.max(mn, Math.min(mx, o[k])) }); calculate() }
function budgetFromData() {
  const months = uniq(DATA.costs.map(r => r.month)).sort(), last12 = months.slice(-12);
  if (!last12.length) { toast('Нет данных о расходах'); return }
  const v = sum(DATA.costs.filter(r => last12.includes(r.month)), r => r.fact) * 12 / last12.length;
  // рост нагрузки: изменение объёма транзакций за период, если он есть
  const vol = m => sum(DATA.costs.filter(r => r.month === m && r.volume > 0), r => r.volume);
  const g = last12.length >= 2 && vol(last12[0]) ? Math.round((vol(last12[last12.length - 1]) / vol(last12[0]) - 1) * 100) : null;
  setCalc({ b: Math.round(v), ...(g != null && g >= 0 ? { g } : {}) });
  toast(`Подставлено: ${fmt(v, 0)} млн ₽ в год${g != null && g >= 0 ? `, рост нагрузки ${g}%` : ''}`);
}
function saveScenario() { if (writeStore('scenario', { b: calc.b, g: calc.g, e: calc.e, c: calc.c })) toast('Сценарий сохранён') }
function resetCalc() { setCalc({ b: 120, g: 25, e: 18, c: 8 }); toast('Параметры сброшены') }
function exportScenario() { csv('atlas-finops-scenario.csv', [['Параметр', 'Значение', 'Единица'], ['Расходы', calc.b, 'млн RUB'], ['Рост нагрузки', calc.g, '%'], ['Экономия FinOps', calc.e, '%'], ['Внедрение', calc.c, 'млн RUB'], ['Без оптимизации', calc.base.toFixed(2), 'млн RUB'], ['С FinOps', calc.total.toFixed(2), 'млн RUB'], ['Чистый эффект', calc.net.toFixed(2), 'млн RUB'], ['Окупаемость', Number.isFinite(calc.pay) ? calc.pay.toFixed(2) : 'не окупается', 'мес.'], ['ROI', calc.roi.toFixed(1), '%']]) }

/* ================= RESEARCH ================= */
function setResFilter(f) { resFilter = f; setSeg('[data-f]', 'f', f); renderResearch() }
function cardHTML(a) {
  const on = bookmarks.includes(a.id);
  return `<article class="card art">${coversMap[a.id] ? `<button class="cover" onclick="openArticle('${a.id}')" tabindex="-1" aria-hidden="true">${coverImg(a.id)}</button>` : ''}<span class="cat">${a.cat}</span><h3><button onclick="openArticle('${a.id}')">${esc(a.title)}</button></h3><p>${esc(a.desc)}</p><div class="meta"><span>${esc(a.source)}</span><button class="mark${on ? ' on' : ''}" onclick="toggleMark('${a.id}')" aria-pressed="${on}" aria-label="${on ? 'Убрать из брифа' : 'Добавить в бриф'}">${ico('mark')}</button></div></article>`;
}
function renderResearch() {
  const q = $('resQ').value.toLowerCase().trim();
  const rows = articles.filter(a => (resFilter === 'all' || a.cat === resFilter) && (a.title + ' ' + a.desc + ' ' + a.source + ' ' + a.body).toLowerCase().includes(q));
  $('rail').innerHTML = rows.length ? rows.map(cardHTML).join('') : '<p class="muted">Ничего не нашлось. Попробуйте «облака», «риски» или «ИИ».</p>';
  $('savedCount').textContent = bookmarks.length;
}
function toggleMark(id) {
  bookmarks = bookmarks.includes(id) ? bookmarks.filter(x => x !== id) : [...bookmarks, id];
  writeStore('bookmarks', bookmarks); renderResearch();
  const sb = $('sheetMark'); if (sb) sb.textContent = bookmarks.includes(id) ? '✓ В брифе' : 'Добавить в бриф';
  if ($('sheet').dataset.view === 'saved') openSaved(true);
  toast(bookmarks.includes(id) ? 'Добавлено в бриф' : 'Убрано из брифа');
}

/* ================= OVERLAYS ================= */
let lastFocus = null;
function openSheet(html, view) {
  lastFocus = lastFocus || document.activeElement;
  closePalette();
  $('sheetBody').innerHTML = html; $('sheet').dataset.view = view || '';
  $('sheet').classList.add('open'); $('scrim').classList.add('open');
  document.body.style.overflow = 'hidden'; $('sheetBody').scrollTop = 0;
  setTimeout(() => $('sheet').querySelector('.sheet-bar button').focus(), 50);
}
function closeAll() {
  $('sheet').classList.remove('open'); $('scrim').classList.remove('open'); $('sheet').dataset.view = ''; closePalette(); document.body.style.overflow = '';
  if (lastFocus && lastFocus.isConnected) lastFocus.focus(); lastFocus = null;
}
function refs(ids) { return ids.map(id => { const s = sources.find(x => x.id === id); return `<p class="src"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}: ${esc(s.title)}</a>, ${s.date}</p>` }).join('') }
const goBtn = (id, t) => `<button class="btn ghost sm" onclick="closeAll();$('${id}').scrollIntoView()">${t}</button>`;
function openArticle(id) {
  const a = articles.find(x => x.id === id); if (!a) return;
  openSheet(`${coversMap[a.id] ? `<div class="sheet-cover">${coverImg(a.id)}</div>` : ""}<div class="sheet-inner"><span class="pill">${a.cat}</span><h2 id="sheetTitle">${esc(a.title)}</h2>${a.body}<h3>Источники</h3>${refs(a.refs)}<p class="src">Рекомендации это интерпретация ATLAS, а не показатели вашего банка.</p><div class="sheet-actions"><button class="btn primary sm" id="sheetMark" onclick="toggleMark('${a.id}')">${bookmarks.includes(a.id) ? '✓ В брифе' : 'Добавить в бриф'}</button>${id === 'finops' ? goBtn('finops', 'Открыть калькулятор') : ''}</div></div>`, 'article');
}
function openSource(id) {
  const s = sources.find(x => x.id === id);
  openSheet(`<div class="sheet-inner"><span class="pill">${esc(s.name)}</span><h2 id="sheetTitle">${esc(s.title)}</h2><div class="kv"><div><small>Публикация</small><b>${s.date}</b></div><div><small>Период данных</small><b>${s.period}</b></div></div><p>${s.desc}</p><p><b>Охват.</b> ${s.scope}</p><div class="sheet-actions"><a class="btn primary sm" href="${s.url}" target="_blank" rel="noopener">Открыть первоисточник ${ico('out')}</a>${goBtn('sources', 'Все источники')}</div></div>`, 'source');
}
function briefSignals() {
  const ys = marketYears(), ly = ys[ys.length - 1], py = ys[ys.length - 2];
  const rev = y => sum(DATA.market.filter(r => r.year === y), r => r.revenue);
  const g = py && rev(py) ? (rev(ly) / rev(py) - 1) * 100 : null;
  const months = uniq(DATA.costs.map(r => r.month)).sort(), f = sum(DATA.costs, r => r.fact), p = sum(DATA.costs.filter(r => r.plan != null), r => r.plan), fp = sum(DATA.costs.filter(r => r.plan != null), r => r.fact);
  return { market: g != null ? `IaaS ${g >= 0 ? '+' : ''}${fmt(g)}% за ${ly} год` : `IaaS, ${ly}`, costs: months.length ? `${fmt(f)} млн ₽ за ${months.length} мес.${p ? `, ${fp > p ? 'перерасход' : 'экономия'} ${fmt(Math.abs(fp / p - 1) * 100)}% к плану` : ''}` : 'нет данных' };
}
function openExecBrief() {
  const s = briefSignals();
  openSheet(`<div class="sheet-inner"><span class="pill">Брифинг для CIO</span><h2 id="sheetTitle">Масштабировать ИИ, сохраняя контроль</h2><p>Облака растут, ИИ уже работает в финансовых компаниях. Но размер рынка не заменяет бизнес-кейс конкретного банка.</p><div class="kv"><div><small>Рынок</small><b>${s.market}</b></div><div><small>Отрасль</small><b>75% респондентов используют ИИ</b></div><div style="grid-column:span 2"><small>Облачные расходы банка${META.costs ? '' : ' (демо)'}</small><b>${s.costs}</b></div></div><h3>Три решения на 90 дней</h3><ul>${priorities.map((p, i) => `<li><b>${p.title}.</b> ${p.text} ${p.owner}, ${p.time.toLowerCase()}.${done.includes(i) ? ' Готово.' : ''}</li>`).join('')}</ul><h3>Контрольная точка</h3><p>Для каждого пилота зафиксируйте владельца, тестовую выборку, стоимость единицы результата, права доступа и процедуру отката.</p>${refs(['gartner', 'boe', 'strategy'])}<div class="sheet-actions"><button class="btn primary sm" onclick="downloadBrief()">Скачать брифинг ${ico('down')}</button>${goBtn('costs', 'Открыть расходы')}</div></div>`, 'brief');
}
function downloadBrief() { const s = briefSignals(); download('atlas-executive-brief.txt', 'ATLAS. Брифинг для CIO банка\n\nМасштабировать ИИ, сохраняя контроль.\n\nСигналы: ' + s.market + '; 75% респондентов используют ИИ (BoE и FCA, 2024); облачные расходы: ' + s.costs + '.\n\nТри решения на 90 дней:\n' + planText() + '\nИсточники:\n' + sources.filter(x => ['gartner', 'boe', 'strategy'].includes(x.id)).map(x => x.name + ': ' + x.url).join('\n')) }
function openSaved(refresh) {
  const rows = articles.filter(a => bookmarks.includes(a.id));
  const html = `<div class="sheet-inner"><h2 id="sheetTitle">Мой бриф</h2><p class="muted">Сохранённые исследования. Хранятся в этом браузере.</p>${rows.length ? rows.map(a => `<div class="saved-item"><button class="t" onclick="openArticle('${a.id}')">${esc(a.title)}</button><button class="mark on" onclick="toggleMark('${a.id}')" aria-label="Убрать из брифа">${ico('mark')}</button></div>`).join('') + `<div class="sheet-actions"><button class="btn primary sm" onclick="exportCollection()">Скачать подборку ${ico('down')}</button></div>` : `<p>Здесь пока пусто. Нажмите на закладку у исследования, и оно появится в брифе.</p>${goBtn('research', 'Перейти к исследованиям')}`}</div>`;
  if (refresh) { $('sheetBody').innerHTML = html; return }
  openSheet(html, 'saved');
}
function exportCollection() { const ch = articles.filter(a => bookmarks.includes(a.id)); if (!ch.length) return; download('atlas-my-brief.txt', 'ATLAS. Мой бриф\n\n' + ch.map((a, i) => `${i + 1}. ${a.title}\n${a.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n\nИсточники:\n${a.refs.map(id => { const s = sources.find(x => x.id === id); return s.name + ': ' + s.url }).join('\n')}`).join('\n\n---\n\n')) }

/* palette */
const SECTIONS = [['data', 'Загрузка данных'], ['costs', 'Облачные расходы'], ['market', 'Рынок облаков'], ['ai', 'Технологический радар'], ['risks', 'Реестр рисков'], ['plan', 'План на 90 дней'], ['finops', 'Калькулятор FinOps'], ['research', 'Исследования'], ['sources', 'Источники и методология']];
function openPalette() { lastFocus = document.activeElement; $('palette').classList.add('open'); $('scrim').classList.add('open'); $('palQ').value = ''; searchAll(''); setTimeout(() => $('palQ').focus(), 30) }
function closePalette() { $('palette').classList.remove('open'); if (!$('sheet').classList.contains('open')) $('scrim').classList.remove('open') }
function searchAll(q) {
  q = q.toLowerCase().trim();
  const arts = articles.filter(a => (a.title + ' ' + a.desc + ' ' + a.cat + ' ' + a.body.replace(/<[^>]+>/g, '')).toLowerCase().includes(q));
  const secs = SECTIONS.filter(([, n]) => n.toLowerCase().includes(q) || !q);
  $('palRes').innerHTML = secs.map(([id, n]) => `<button onclick="closePalette();$('${id}').scrollIntoView()"><span>${n}</span><small>раздел</small></button>`).join('') + arts.map(a => `<button onclick="closePalette();openArticle('${a.id}')"><span>${esc(a.title)}</span><small>${a.cat}</small></button>`).join('') || '<p>Ничего не нашлось. Попробуйте «облака», «риски» или «ИИ».</p>';
}

/* nav */
function toggleNav(v) { const s = v ?? !$('mnav').classList.contains('open'); $('mnav').classList.toggle('open', s); $('burger').setAttribute('aria-expanded', s); document.body.style.overflow = s ? 'hidden' : '' }
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette() }
  if (e.key === 'Escape') { closeAll(); toggleNav(false) }
});
/* ================= SCROLL ENGINE: камера города следует за разделами ================= */
const camSecs = [...document.querySelectorAll('[data-cam]')];
const navLinks = [...document.querySelectorAll('.nav a')];
let tops = [], lastKey = '';
function measure() { tops = camSecs.map(s => s.getBoundingClientRect().top + scrollY) }
const lerp = (a, b, t) => a + (b - a) * t;
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) };
function onScroll() {
  const y = scrollY + innerHeight * .5;
  let i = 0; while (i < tops.length - 1 && y >= tops[i + 1]) i++;
  const a = CAMS[camSecs[i].dataset.cam], nextSec = camSecs[i + 1], b = nextSec ? CAMS[nextSec.dataset.cam] : a;
  const s = nextSec ? smooth(.55, 1, (y - tops[i]) / (tops[i + 1] - tops[i])) : 0;
  const cur = s > .5 ? b : a;
  if (city) city.setTarget({ pos: lerpArr(a.pos, b.pos, s), look: lerpArr(a.look, b.look, s), shift: lerp(a.shift || 0, b.shift || 0, s), fov: lerp(a.fov || 30, b.fov || 30, s), orbit: lerp(a.orbit || 0, b.orbit || 0, s), alert: lerp(a.alert || 0, b.alert || 0, s), labels: cur.labels });
  $('veil').style.opacity = lerp(a.veil || 0, b.veil || 0, s);
  const key = camSecs[i].id;
  if (key !== lastKey) { lastKey = key; navLinks.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + key)) }
}

/* sources */
function exportSources() { csv('atlas-sources.csv', [['Источник', 'Название', 'Публикация', 'Период', 'Охват', 'URL'], ...sources.map(s => [s.name, s.title, s.date, s.period, s.scope, s.url])]) }
function renderSources() { $('srcList').innerHTML = sources.map(s => `<li><div><h3>${esc(s.name)}</h3><p>${esc(s.title)}. ${s.scope}, ${s.period}</p></div><a class="icon-btn" href="${s.url}" target="_blank" rel="noopener" aria-label="Открыть: ${esc(s.title)}">${ico('out')}</a></li>`).join('') }

/* ================= INIT ================= */
function renderAll() { renderKPI(); renderDataSection(); renderCosts(); renderMarket(); renderAdoption(); renderRadar(); renderRisks() }
RANGES.forEach(([id]) => $(id).addEventListener('input', calculate));
if (window.Chart) { Chart.defaults.font.family = 'Onest, system-ui, sans-serif' }
renderAll(); renderPlan(); renderSources();
setCalc(readStore('scenario', { b: 120, g: 25, e: 18, c: 8 }));
renderResearch(); paintModeBtn();
if (!minimal) initCity();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme) { renderCharts(); renderRadar(); cityTheme() } });
measure(); onScroll(); cityTheme();
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { measure(); onScroll() });
addEventListener('load', () => { measure(); onScroll() });
new ResizeObserver(() => { measure(); onScroll() }).observe(document.querySelector('main'));
