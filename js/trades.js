import { esc, debounce, toast } from './ui.js';
export const LIMITS = { TEXT: 2000, SYMBOL: 20, PAGE_SIZE: 10, DRAFT_MS: 600 };
const DRAFT_KEY = 'neo.draft';
export const num = v => Number.isFinite(+v) ? +v : 0;
export const outcomeOf = t => t.status === 'open' ? 'Open' : t.result > 0 ? 'Win' : t.result < 0 ? 'Loss' : 'Breakeven';
export const moneyOf = t => t.status !== 'open' && t.risk > 0 ? t.result * t.risk : null;
export const fmt = v => (v > 0 ? '+' : '') + num(v).toFixed(2);
export function calcR({ entry, stop, exitPrice, direction }) {
  const risk = direction === 'Buy' ? entry - stop : stop - entry;
  if (!(risk > 0) || !Number.isFinite(exitPrice)) return null;
  return Math.round(((direction === 'Buy' ? exitPrice - entry : entry - exitPrice) / risk) * 100) / 100;
}
const str = (v, n = LIMITS.TEXT) => String(v ?? '').trim().slice(0, n);
const numOrNull = v => (v === '' || v == null || !Number.isFinite(+v)) ? null : +v;
export function sanitize(f, id) {
  const closed = f.status === 'closed', now = new Date().toISOString();
  return { id, date: str(f.date, 16), symbol: str(f.symbol, LIMITS.SYMBOL).toUpperCase(), direction: f.direction === 'Sell' ? 'Sell' : 'Buy',
    model: str(f.model, 40), session: str(f.session, 40), entry: numOrNull(f.entry), stop: numOrNull(f.stop), target: numOrNull(f.target), risk: numOrNull(f.risk), leverage: numOrNull(f.leverage), margin: numOrNull(f.margin),
    status: closed ? 'closed' : 'open', exitPrice: closed ? numOrNull(f.exitPrice) : null, exitDate: closed ? str(f.exitDate, 16) : '', result: closed ? num(f.result) : 0,
    reason: str(f.reason), notes: str(f.notes), createdAt: now, updatedAt: now };
}
export function validate(t) {
  const e = {};
  if (!t.date) e.date = 'تاریخ لازم است';
  if (!t.symbol) e.symbol = 'نماد لازم است';
  if (t.entry === null || t.entry <= 0) e.entry = 'قیمت ورود معتبر نیست';
  if (t.entry !== null && t.stop !== null && t.stop === t.entry) e.stop = 'حد ضرر نباید برابر ورود باشد';
  if (t.status === 'closed') { if (t.exitPrice === null) e.exitPrice = 'قیمت خروج لازم است'; if (!t.exitDate) e.exitDate = 'زمان خروج لازم است'; }
  return e;
}
export const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const saveDraft = debounce(form => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {} }, LIMITS.DRAFT_MS);
export const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };
export const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; } };
const FIELDS = [['date','تاریخ و ساعت','datetime-local'],['symbol','نماد','text'],['direction','جهت','select:Buy,Sell'],['model','مدل','text'],['session','سشن','select:New York,London,Asia,Other'],['status','وضعیت','select:open,closed'],
 ['entry','قیمت ورود','number'],['stop','حد ضرر','number'],['target','حد سود','number'],['leverage','لوریج (۱ به ...)','number'],['margin','مارجین (دلار)','number'],['risk','ریسک (دلار) · خودکار','number'],['exitDate','زمان خروج','datetime-local'],['exitPrice','قیمت خروج','number'],['result','نتیجه (R)','number']];
const input = ([n, l, t]) => `<div class="field"><label for="f_${n}">${l}</label>${t.startsWith('select:') ? `<select id="f_${n}" name="${n}">${t.slice(7).split(',').map(o => `<option>${o}</option>`).join('')}</select>` : `<input id="f_${n}" name="${n}" type="${t}" ${t === 'number' ? 'step="any"' : ''}>`}<span class="err" data-err="${n}"></span></div>`;
const pf = v => parseFloat(v), ok = x => Number.isFinite(x) && x > 0;
const usd = v => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
export function posCalc(f) {
  const e = pf(f.entry.value), s = pf(f.stop.value), t = pf(f.target.value), lev = pf(f.leverage.value), m = pf(f.margin.value), buy = f.direction.value === 'Buy';
  const dR = buy ? e - s : s - e, dW = buy ? t - e : e - t, n = ok(m) && ok(lev) ? m * lev : 0;
  return { e, lev, m, n, rr: ok(dR) && ok(dW) ? dW / dR : null, loss: n && ok(dR) && ok(e) ? n * dR / e : null, gain: n && ok(dW) && ok(e) ? n * dW / e : null, stopPct: ok(dR) && ok(e) ? dR / e : null };
}
function calcPanel(form, acc) {
  const p = posCalc(form), el = form.querySelector('#calc'), eq = acc?.eq > 0 ? acc.eq : 0, cell = (l, v, c = '', sub = '') => `<div><div class="muted">${l}</div><b class="${c}" dir="ltr">${v}</b><div class="muted">${sub}</div></div>`;
  const pct = v => eq ? (v / eq * 100).toFixed(2) + '% از حساب' : '';
  const rrCls = p.rr === null ? '' : p.rr >= 2 ? 'pos' : p.rr < 1 ? 'neg' : '';
  let w = '';
  if (eq && p.m > eq) w += '<div class="neg">مارجین از کل حساب بیشتر است.</div>';
  if (p.stopPct !== null && p.lev && p.stopPct >= 1 / p.lev) w += `<div class="neg">با لوریج 1:${p.lev} حرکت ${(100 / p.lev).toFixed(2)}% مارجین را می‌خورد؛ قبل از استاپ لیکویید می‌شوی.</div>`;
  el.innerHTML = `<div class="grid">${cell('ریسک به ریوارد', p.rr === null ? '—' : '1 : ' + p.rr.toFixed(2), rrCls, p.rr === null ? 'ورود، حد ضرر و حد سود را درست وارد کن' : p.rr < 1 ? 'کمتر از ۱:۱' : '')}${cell('ارزش پوزیشن', p.n ? usd(p.n) : '—', '', p.n && p.e ? 'حجم ≈ ' + (p.n / p.e).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '')}${cell('اگر استاپ بخورد', p.loss === null ? '—' : '-' + usd(p.loss), 'neg', p.loss === null ? '' : pct(p.loss))}${cell('اگر حد سود بخورد', p.gain === null ? '—' : '+' + usd(p.gain), 'pos', p.gain === null ? '' : pct(p.gain))}</div>${w}<div class="muted">محاسبه ساده است؛ اسپرد، کمیسیون و سواپ لحاظ نشده.</div>`;
  if (p.loss !== null && !form.risk.dataset.manual) form.risk.value = p.loss.toFixed(2);
}
export function renderForm(root, trade, onSubmit, getAcc = () => null) {
  root.innerHTML = `<form class="card form" novalidate>${FIELDS.map(input).join('')}<div class="card calc span3" id="calc"></div><div class="field span3"><label>دلیل ورود</label><textarea name="reason" maxlength="${LIMITS.TEXT}"></textarea></div><div class="field span3"><label>درس‌ها</label><textarea name="notes" maxlength="${LIMITS.TEXT}"></textarea></div><div class="row span3"><button>${trade ? 'ذخیره تغییرات' : 'ذخیره معامله'}</button><button type="button" class="ghost" data-act="reset-form">پاک کردن</button></div></form>`;
  const form = root.querySelector('form'), data = trade || loadDraft() || { date: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16), status: 'open' };
  for (const [k, v] of Object.entries(data)) if (form.elements[k] && v != null) form.elements[k].value = v;
  if (!trade && !form.leverage.value && getAcc()?.lev) form.leverage.value = getAcc().lev;
  if (trade && trade.risk != null) form.risk.dataset.manual = '1';
  const sync = () => { const c = form.status.value === 'closed'; ['exitDate','exitPrice','result'].forEach(n => form.elements[n].closest('.field').hidden = !c); };
  const autoR = () => { if (form.status.value !== 'closed' || form.result.dataset.manual) return; const r = calcR({ entry: +form.entry.value, stop: +form.stop.value, exitPrice: parseFloat(form.exitPrice.value), direction: form.direction.value }); if (r !== null) form.result.value = r; };
  form.addEventListener('input', e => { if (e.target.name === 'risk') form.risk.dataset.manual = e.target.value ? '1' : ''; if (e.target.name === 'result') form.result.dataset.manual = e.target.value ? '1' : ''; sync(); autoR(); calcPanel(form, getAcc()); if (!trade) saveDraft(form); });
  form.addEventListener('submit', e => { e.preventDefault(); form.querySelectorAll('[data-err]').forEach(s => s.textContent = ''); form.querySelectorAll('.bad').forEach(x => x.classList.remove('bad'));
    const t = sanitize(Object.fromEntries(new FormData(form)), trade?.id || newId()), errs = validate(t);
    if (Object.keys(errs).length) { for (const [k, m] of Object.entries(errs)) { form.querySelector(`[data-err=${k}]`).textContent = m; form.elements[k].classList.add('bad'); } toast('فرم را بررسی کن', 'error'); return; }
    if (trade) t.createdAt = trade.createdAt; onSubmit(t); });
  sync(); calcPanel(form, getAcc());
}
export const view = { q: '', outcome: '', sort: 'date', dir: -1, page: 1 };
export function queryTrades(all) {
  const q = view.q.toLowerCase();
  const list = all.filter(t => (!q || t.symbol.toLowerCase().includes(q)) && (!view.outcome || outcomeOf(t) === view.outcome));
  list.sort((a, b) => (a[view.sort] > b[view.sort] ? 1 : a[view.sort] < b[view.sort] ? -1 : 0) * view.dir);
  const pages = Math.max(1, Math.ceil(list.length / LIMITS.PAGE_SIZE)); view.page = Math.min(view.page, pages);
  return { rows: list.slice((view.page - 1) * LIMITS.PAGE_SIZE, view.page * LIMITS.PAGE_SIZE), total: list.length, pages };
}
export function renderHistory(root, all) {
  if (!root.firstElementChild) root.innerHTML = `<div class="card"><div class="row"><input data-view="q" placeholder="جست‌وجوی نماد" style="max-width:200px"><select data-view="outcome" style="max-width:160px"><option value="">همه</option><option>Win</option><option>Loss</option><option>Breakeven</option><option>Open</option></select></div></div><div id="hBody"></div>`;
  const { rows, total, pages } = queryTrades(all);
  root.querySelector('#hBody').innerHTML = !all.length ? `<div class="card empty">هنوز معامله‌ای ثبت نشده است.<br><button data-page="new" style="margin-top:10px">ثبت اولین معامله</button></div>` : !total ? '<div class="card empty">معامله‌ای با این فیلتر پیدا نشد.</div>' :
  `<div class="card table-wrap"><table><thead><tr>${[['date','تاریخ'],['symbol','نماد'],['direction','جهت'],['result','نتیجه']].map(([k,l]) => `<th data-sort="${k}">${l}${view.sort === k ? (view.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th>وضعیت</th><th></th></tr></thead><tbody>${rows.map(t => `<tr><td>${esc(t.date.replace('T', ' '))}</td><td>${esc(t.symbol)}</td><td>${esc(t.direction)}</td><td dir="ltr" class="${t.result >= 0 ? 'pos' : 'neg'}">${t.status === 'open' ? '—' : fmt(t.result) + 'R'}</td><td>${outcomeOf(t)}</td><td><button class="ghost" data-act="edit" data-id="${esc(t.id)}">${t.status === 'open' ? 'ثبت خروج' : 'ویرایش'}</button> <button class="danger" data-act="delete" data-id="${esc(t.id)}">حذف</button></td></tr>`).join('')}</tbody></table></div><div class="row" style="justify-content:center"><button class="ghost" data-act="page" data-p="${view.page - 1}" ${view.page <= 1 ? 'disabled' : ''}>قبلی</button><span class="muted">${view.page} / ${pages} · ${total} معامله</span><button class="ghost" data-act="page" data-p="${view.page + 1}" ${view.page >= pages ? 'disabled' : ''}>بعدی</button></div>`;
}
