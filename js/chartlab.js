import { $, toast } from './ui.js';
const TV_SRC = 'https://s3.tradingview.com/tv.js', LWC_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/5.0.8/lightweight-charts.standalone.production.js', MAX_BYTES = 30e6;
const SYMBOLS = ['OANDA:NAS100USD', 'OANDA:US30USD', 'OANDA:XAUUSD', 'FX:EURUSD', 'FX:GBPUSD', 'BINANCE:BTCUSDT', 'NASDAQ:AAPL'];
const TFS = [['1', '1m'], ['5', '5m'], ['15', '15m'], ['60', '1H'], ['240', '4H'], ['D', 'Daily']];
const libs = {}, loadScript = src => (window[src === TV_SRC ? 'TradingView' : 'LightweightCharts'] ? Promise.resolve() : (libs[src] ??= new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: () => { delete libs[src]; rej(new Error('بارگذاری کتابخانه ناموفق بود؛ اینترنت یا فیلترشکن را بررسی کن')); } }); document.head.append(s); })));
let lwc, last = { symbol: SYMBOLS[0], interval: '15' };
export const destroyChart = () => { lwc?.remove(); lwc = null; };
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
async function mountTV(box) {
  box.className = 'card chart-wrap tv'; box.innerHTML = '<div class="skeleton" style="height:100%"></div>'; destroyChart();
  try {
    await loadScript(TV_SRC); box.innerHTML = '<div id="tvBox" style="height:100%"></div>';
    new window.TradingView.widget({ autosize: true, container_id: 'tvBox', symbol: last.symbol, interval: last.interval, timezone: 'Etc/UTC', theme: document.body.dataset.theme === 'light' ? 'light' : 'dark', style: '1', locale: 'en', allow_symbol_change: true, enable_publishing: false, withdateranges: true, save_image: true, hide_side_toolbar: false, hide_top_toolbar: false, studies: [] });
  } catch (e) { box.innerHTML = `<div class="empty">${e.message}</div>`; }
}
function mountCSV(box) {
  box.className = 'card'; box.innerHTML = '<label class="ghost" style="padding:10px 14px;border-radius:12px;cursor:pointer;display:inline-block">بارگذاری CSV<input id="lwFile" type="file" accept=".csv,.txt" hidden></label><div id="lwChart" class="chart-wrap" style="margin-top:12px"><div class="empty">فایل CSV کندل‌ها را بارگذاری کن.</div></div>';
  $('lwFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > MAX_BYTES) return toast('حجم فایل بیش از حد مجاز است', 'error');
    try { await loadScript(LWC_SRC); const data = parseCandles(await f.text()); destroyChart(); $('lwChart').innerHTML = '';
      const L = window.LightweightCharts; lwc = L.createChart($('lwChart'), { autoSize: true, timeScale: { timeVisible: true }, layout: { background: { color: 'transparent' }, textColor: '#9aa9c4' } });
      lwc.addSeries(L.CandlestickSeries, {}).setData(data); lwc.timeScale().fitContent(); toast(`${data.length} کندل بارگذاری شد`);
    } catch (err) { toast(err.message, 'error'); }
  };
}
export function renderChartLab(root) {
  root.innerHTML = `<div class="tabs"><button class="on" data-tab="tv">TradingView (زنده)</button><button data-tab="csv">بک‌تست با CSV</button></div>
  <div class="card row" id="tvBar"><input id="tvSym" list="tvList" value="${last.symbol}" style="max-width:260px" aria-label="نماد"><datalist id="tvList">${SYMBOLS.map(s => `<option value="${s}">`).join('')}</datalist><select id="tvTf" style="max-width:120px">${TFS.map(([v, l]) => `<option value="${v}" ${v === last.interval ? 'selected' : ''}>${l}</option>`).join('')}</select><a id="tvOpen" href="#" target="_blank" rel="noopener" class="ghost" style="padding:10px 14px;border-radius:12px;text-decoration:none;color:var(--text);border:1px solid var(--line);background:var(--panel2)">باز کردن در TradingView</a><button id="tvGo">اعمال</button><span class="muted">قالب نماد: EXCHANGE:SYMBOL</span></div><div id="chartBox"></div>`;
  const box = $('chartBox'), go = () => { last = { symbol: $('tvSym').value.trim() || last.symbol, interval: $('tvTf').value }; mountTV(box); };
  const upd = () => { $('tvOpen').href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent($('tvSym').value.trim() || last.symbol) + '&interval=' + $('tvTf').value; }; upd(); $('tvSym').oninput = upd; $('tvGo').onclick = go; $('tvSym').onkeydown = e => e.key === 'Enter' && go(); $('tvTf').onchange = () => { upd(); go(); };
  root.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return;
    root.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); $('tvBar').hidden = b.dataset.tab !== 'tv';
    b.dataset.tab === 'tv' ? mountTV(box) : mountCSV(box); };
  mountTV(box);
}
