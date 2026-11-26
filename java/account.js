import { $, toast } from './ui.js';
import { num, moneyOf } from './trades.js';
export const LIMITS = { MAX_LEV: 3000, DEFAULT_LEV: 100 };
export const usd = v => (v < 0 ? '-' : '') + '$' + Math.abs(+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function summary(settings, trades) {
  const bal = Math.max(0, num(settings.account?.balance)), lev = Math.max(1, Math.round(num(settings.account?.leverage)) || LIMITS.DEFAULT_LEV);
  const pnl = trades.map(moneyOf).filter(x => x !== null).reduce((a, b) => a + b, 0), eq = bal + pnl;
  return { bal, lev, pnl, eq, bp: eq > 0 ? eq * lev : 0 };
}
export function renderAccount(root, settings, trades, onSave) {
  const s = summary(settings, trades);
  root.innerHTML = `<div class="card form"><div class="field"><label>موجودی اولیه (دلار)</label><input id="accBal" type="number" min="0" step="any" value="${s.bal || ''}"></div><div class="field"><label>لوریج (۱ به ...)</label><input id="accLev" type="number" min="1" max="${LIMITS.MAX_LEV}" value="${s.lev}"></div><div class="row"><button id="accSave">ذخیره حساب</button></div></div>
  <div class="grid"><div class="card stat"><span>کل حساب</span><b>${s.bal ? usd(s.eq) : '—'}</b></div><div class="card stat"><span>قدرت خرید</span><b>${s.bal ? usd(s.bp) : '—'}</b></div></div>`;
  $('accSave').onclick = () => {
    const bal = parseFloat($('accBal').value || 0), lev = parseInt($('accLev').value, 10);
    if (!(bal >= 0) || !(lev >= 1 && lev <= LIMITS.MAX_LEV)) return toast(`موجودی ≥ ۰ و لوریج بین ۱ تا ${LIMITS.MAX_LEV}`, 'error');
    onSave({ balance: bal, leverage: lev });
  };
}
