import { $, toast, esc } from './ui.js';
import * as store from './storage.js';
const TV_SRC = 'https://s3.tradingview.com/tv.js', LWC_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/5.0.8/lightweight-charts.standalone.production.js', MAX_BYTES = 30e6, SYM_RE = /^[\w.!:\-]{1,40}$/;
const SYMBOLS = ['OANDA:NAS100USD', 'OANDA:US30USD', 'OANDA:XAUUSD', 'FX:EURUSD', 'FX:GBPUSD', 'BINANCE:BTCUSDT'];
const TFS = [['1', '1m'], ['5', '5m'], ['15', '15m'], ['60', '1H'], ['240', '4H'], ['D', 'Daily']];
const SPEEDS = [1, 2, 5, 10, 30];
const libs = {}, loadScript = src => (window[src === TV_SRC ? 'TradingView' : 'LightweightCharts'] ? Promise.resolve() : (libs[src] ??= new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: () => { delete libs[src]; rej(new Error('بارگذاری کتابخانه ناموفق بود؛ اینترنت یا فیلترشکن را بررسی کن')); } }); document.head.append(s); })));
let lwc, series, rp = null, timer = null, wl = null, last = { symbol: SYMBOLS[0], interval: '15' };
const stop = () => { clearInterval(timer); timer = null; const b = $('rpPlay'); if (b) b.textContent = '▶ پخش'; };
export const destroyChart = () => { stop(); lwc?.remove(); lwc = series = rp = null; };
export function parseCandles(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sep = [',', ';', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0], map = new Map();
  for (const l of lines) {
    const c = l.split(sep).map(x => x.trim()), t = /^\d{9,13}$/.test(c[0]) ? +c[0] / (c[0].length > 10 ? 1000 : 1) : Date.parse(c[0].replace(/\./g, '-').replace(' ', 'T') + 'Z') / 1000;
    const [o, h, lo, cl] = c.slice(1, 5).map(parseFloat);
    if ([t, o, h, lo, cl].every(Number.isFinite)) map.set(Math.floor(t), { time: Math.floor(t), open: o, high: h, low: lo, close: cl });
  }
  if (map.size < 2) throw new Error('کندل معتبری پیدا نشد (ستون‌ها: time,open,high,low,close)');
  return [...map.values()].sort((a, b) => a.time - b.time);
}
// ---------- Watchlist (ذخیره در IndexedDB) ----------
async function loadWL() { if (!wl) { try { wl = await store.get('watchlist'); } catch {} if (!Array.isArray(wl) || !wl.length) wl = [...SYMBOLS]; } }
const saveWL = () => store.put('watchlist', wl).catch(() => toast('ذخیره واچ‌لیست ناموفق بود', 'error'));
function drawWL() {
  $('wlList').innerHTML = wl.map((s, i) => `<div class="wl ${s === last.symbol ? 'on' : ''}"><button class="wlb" data-s="${esc(s)}">${esc(s.split(':').pop())}<small>${esc(s.includes(':') ? s.split(':')[0] : '')}</small></button><button class="ghost wlx" data-i="${i}" aria-label="حذف">✕</button></div>`).join('') || '<div class="empty">خالی است</div>';
}
// ---------- TradingView ----------
async function mountTV(box) {
  box.className = 'card chart-wrap tv'; box.innerHTML = '<div class="skeleton" style="height:100%"></div>'; destroyChart();
  try {
    await loadScript(TV_SRC); box.innerHTML = '<div id="tvBox" style="height:100%"></div>';
    new window.TradingView.widget({ autosize: true, container_id: 'tvBox', symbol: last.symbol, interval: last.interval, timezone: 'Etc/UTC', theme: document.body.dataset.theme === 'light' ? 'light' : 'dark', style: '1', locale: 'en', allow_symbol_change: true, enable_publishing: false, withdateranges: true, save_image: true, hide_side_toolbar: false, hide_top_toolbar: false, studies: [] });
  } catch (e) { box.innerHTML = `<div class="empty">${e.message}</div>`; }
}
async function showTV(pane) {
  await loadWL();
  pane.innerHTML = `<div class="card row"><input id="tvSym" value="${esc(last.symbol)}" style="max-width:260px" aria-label="نماد"><select id="tvTf" style="max-width:120px">${TFS.map(([v, l]) => `<option value="${v}" ${v === last.interval ? 'selected' : ''}>${l}</option>`).join('')}</select><button id="tvGo">اعمال</button><button class="ghost" id="wlAdd">＋ افزودن به واچ‌لیست</button><a id="tvOpen" href="#" target="_blank" rel="noopener" class="ghost" style="padding:10px 14px;border-radius:12px;text-decoration:none;color:var(--text);border:1px solid var(--line);background:var(--panel2)">باز کردن در TradingView (با Replay)</a></div>
  <div class="tvgrid"><div id="chartBox"></div><aside class="card"><h3>واچ‌لیست</h3><div id="wlList"></div></aside></div>`;
  const box = $('chartBox'), upd = () => { $('tvOpen').href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(last.symbol) + '&interval=' + last.interval; };
  const go = sym => { const s = (sym ?? $('tvSym').value).trim(); if (!SYM_RE.test(s)) return toast('نماد معتبر نیست (مثال: OANDA:XAUUSD)', 'error'); last = { symbol: s, interval: $('tvTf').value }; $('tvSym').value = s; upd(); drawWL(); mountTV(box); };
  $('tvGo').onclick = () => go(); $('tvTf').onchange = () => go(); $('tvSym').onkeydown = e => e.key === 'Enter' && go();
  $('wlAdd').onclick = () => { const s = $('tvSym').value.trim(); if (!SYM_RE.test(s)) return toast('نماد معتبر نیست', 'error'); if (wl.includes(s)) return toast('قبلاً در لیست هست'); wl.push(s); saveWL(); drawWL(); };
  $('wlList').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.s) go(b.dataset.s); else if (b.dataset.i) { wl.splice(+b.dataset.i, 1); saveWL(); drawWL(); } };
  upd(); drawWL(); mountTV(box);
}
// ---------- CSV + Replay ----------
function setPos(i, full = true) {
  rp.i = Math.max(1, Math.min(rp.data.length, i));
  full ? series.setData(rp.data.slice(0, rp.i)) : series.update(rp.data[rp.i - 1]);
  $('rpPos').value = rp.i; $('rpInfo').textContent = `${rp.i} / ${rp.data.length} · ${new Date(rp.data[rp.i - 1].time * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}
const step = () => rp.i >= rp.data.length ? stop() : setPos(rp.i + 1, false);
function play() { if (timer) return stop(); if (rp.i >= rp.data.length) return; $('rpPlay').textContent = '⏸ توقف'; timer = setInterval(step, 1000 / +$('rpSpd').value); }
function showCSV(pane) {
  destroyChart();
  pane.innerHTML = `<div class="card"><label class="ghost" style="padding:10px 14px;border-radius:12px;cursor:pointer;display:inline-block">بارگذاری CSV<input id="lwFile" type="file" accept=".csv,.txt" hidden></label>
  <div class="row" id="rpBar" hidden style="margin-top:12px"><button id="rpBack" class="ghost">◀ گام</button><button id="rpPlay">▶ پخش</button><button id="rpNext" class="ghost">گام ▶</button><select id="rpSpd" style="max-width:90px">${SPEEDS.map(s => `<option value="${s}">${s}x</option>`).join('')}</select><input id="rpPos" type="range" min="1" value="1" style="flex:1;min-width:160px"><span class="muted" id="rpInfo" dir="ltr"></span></div></div>
  <div class="card chart-wrap" id="lwChart"><div class="empty">فایل CSV کندل‌ها را بارگذاری کن؛ سپس با نوار Replay کندل‌ها را یکی‌یکی جلو ببر.</div></div>`;
  $('lwFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > MAX_BYTES) return toast('حجم فایل بیش از حد مجاز است', 'error');
    try { await loadScript(LWC_SRC); const data = parseCandles(await f.text()); destroyChart(); $('lwChart').innerHTML = '';
      const L = window.LightweightCharts; lwc = L.createChart($('lwChart'), { autoSize: true, timeScale: { timeVisible: true }, layout: { background: { color: 'transparent' }, textColor: '#9aa9c4' } });
      series = lwc.addSeries(L.CandlestickSeries, {}); rp = { data, i: 1 }; $('rpPos').max = data.length; $('rpBar').hidden = false;
      setPos(Math.max(1, Math.min(data.length, Math.max(50, Math.floor(data.length * .3))))); lwc.timeScale().fitContent(); toast(`${data.length} کندل بارگذاری شد`);
    } catch (err) { toast(err.message, 'error'); }
  };
  $('rpPlay').onclick = () => rp && play(); $('rpNext').onclick = () => rp && step(); $('rpBack').onclick = () => rp && setPos(rp.i - 1);
  $('rpPos').oninput = e => rp && (stop(), setPos(+e.target.value)); $('rpSpd').onchange = () => { if (timer) { stop(); play(); } };
}
export function renderChartLab(root) {
  root.innerHTML = '<div class="tabs"><button class="on" data-tab="tv">TradingView (زنده)</button><button data-tab="csv">بک‌تست و Replay با CSV</button></div><div id="pane"></div>';
  root.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return;
    root.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); b.dataset.tab === 'tv' ? showTV($('pane')) : showCSV($('pane')); };
  showTV($('pane'));
}
