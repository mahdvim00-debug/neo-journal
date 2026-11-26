import { esc } from './ui.js';
import { num, fmt, moneyOf } from './trades.js';
export function calc(list) {
  const wins = list.filter(t => t.result > 0), loss = list.filter(t => t.result < 0);
  const net = list.reduce((s, t) => s + num(t.result), 0), gp = wins.reduce((s, t) => s + t.result, 0), gl = Math.abs(loss.reduce((s, t) => s + t.result, 0));
  let cur = 0, peak = 0, dd = 0;
  [...list].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => { cur += t.result; peak = Math.max(peak, cur); dd = Math.max(dd, peak - cur); });
  return { n: list.length, net, winRate: list.length ? wins.length / list.length * 100 : 0, pf: gl ? gp / gl : gp ? Infinity : 0, exp: list.length ? net / list.length : 0, avgWin: wins.length ? gp / wins.length : 0, avgLoss: loss.length ? -gl / loss.length : 0, dd };
}
export function moneyStats(list) {
  const v = list.map(moneyOf).filter(x => x !== null);
  return { n: v.length, net: v.reduce((a, b) => a + b, 0) };
}
export const group = (list, key) => Object.entries(list.reduce((m, t) => ((m[t[key] || 'نامشخص'] ??= []).push(t), m), {}))
  .map(([k, v]) => ({ k, ...calc(v) })).sort((a, b) => b.net - a.net);
const stat = (l, v, cls = '') => `<div class="card stat"><span>${l}</span><b class="${cls}">${v}</b></div>`;
export function renderDashboard(root, trades) {
  const done = trades.filter(t => t.status === 'closed'), c = calc(done), m = moneyStats(done);
  root.innerHTML = `<div class="grid">${stat('خالص (R)', fmt(c.net) + 'R', c.net >= 0 ? 'pos' : 'neg')}${stat('درصد برد', done.length ? c.winRate.toFixed(1) + '%' : '—')}${stat('معاملات بسته', done.length)}${stat('Profit Factor', c.pf === Infinity ? '∞' : done.length ? c.pf.toFixed(2) : '—')}</div>
  <div class="card"><span class="muted">سود/زیان پولی</span> <b dir="ltr">${m.n ? (m.net > 0 ? '+' : '') + m.net.toFixed(2) : '—'}</b></div>
  <div class="card"><h3>معاملات اخیر</h3>${trades.length ? [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(t => `<div class="row" style="justify-content:space-between;padding:6px 0"><span>${esc(t.symbol)} ${esc(t.direction)}</span><b dir="ltr">${t.status === 'open' ? 'باز' : fmt(t.result) + 'R'}</b></div>`).join('') : '<div class="empty">هنوز معامله‌ای ثبت نشده است.</div>'}</div>`;
}
export function renderAnalytics(root, trades) {
  const done = trades.filter(t => t.status === 'closed'), c = calc(done);
  if (!done.length) { root.innerHTML = '<div class="card empty">برای دیدن تحلیل، حداقل یک معامله بسته‌شده لازم است.</div>'; return; }
  const bars = arr => arr.map(x => `<div class="row" style="justify-content:space-between"><b>${esc(x.k)}</b><span dir="ltr" class="${x.net >= 0 ? 'pos' : 'neg'}">${fmt(x.net)}R · ${x.winRate.toFixed(0)}% · ${x.n}</span></div>`).join('');
  root.innerHTML = `<div class="grid">${stat('میانگین برد', fmt(c.avgWin) + 'R')}${stat('میانگین باخت', fmt(c.avgLoss) + 'R')}${stat('Expectancy', fmt(c.exp) + 'R')}${stat('بیشترین افت', c.dd.toFixed(2) + 'R')}</div><div class="card"><h3>بر اساس سشن</h3>${bars(group(done, 'session'))}</div><div class="card"><h3>بر اساس مدل</h3>${bars(group(done, 'model'))}</div>`;
}
