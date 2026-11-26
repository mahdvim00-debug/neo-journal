import { $, toast } from './ui.js';
const LWC_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/5.0.8/lightweight-charts.standalone.production.js', MAX_BYTES = 30e6;
let chart, loading;
const loadLib = () => window.LightweightCharts ? Promise.resolve() : (loading ??= new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src: LWC_SRC, onload: res, onerror: () => { loading = null; rej(new Error('بارگذاری کتابخانه چارت ناموفق بود')); } }); document.head.append(s); }));
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
export function renderChartLab(root) {
  root.innerHTML = `<div class="card"><label class="ghost" style="padding:10px 14px;border-radius:12px;cursor:pointer;display:inline-block">بارگذاری CSV<input id="lwFile" type="file" accept=".csv,.txt" hidden></label></div><div class="card chart-wrap" id="lwChart"><div class="empty">فایل CSV کندل‌ها را بارگذاری کن.</div></div>`;
  $('lwFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > MAX_BYTES) return toast('حجم فایل بیش از حد مجاز است', 'error');
    try { await loadLib(); const data = parseCandles(await f.text()); destroyChart(); $('lwChart').innerHTML = '';
      const L = window.LightweightCharts; chart = L.createChart($('lwChart'), { autoSize: true, timeScale: { timeVisible: true } });
      chart.addSeries(L.CandlestickSeries, {}).setData(data); chart.timeScale().fitContent(); toast(`${data.length} کندل بارگذاری شد`);
    } catch (err) { toast(err.message, 'error'); }
  };
}
export const destroyChart = () => { chart?.remove(); chart = null; }; // جلوگیری از Memory Leak
