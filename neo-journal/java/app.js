// Bootstrap + state + event delegation (فقط یک listener سراسری)
import * as ui from './ui.js';
import * as store from './storage.js';
import * as T from './trades.js';
import { renderDashboard, renderAnalytics } from './analytics.js';
import { renderAccount } from './account.js';
import { renderChartLab } from './chartlab.js';
const { $, toast, show, invalidate, registerPage, confirmModal } = ui;
const state = { trades: [], settings: { account: { balance: 0, leverage: 100 } }, editing: null };
async function persist() { try { await store.put('trades', state.trades); invalidate(); } catch (e) { console.error(e); toast('ذخیره‌سازی ناموفق بود', 'error'); throw e; } }
async function onSubmit(t) {
  const i = state.trades.findIndex(x => x.id === t.id);
  i >= 0 ? state.trades[i] = t : state.trades.push(t);
  try { await persist(); } catch { return; }
  T.clearDraft(); state.editing = null; toast('معامله ذخیره شد'); show('history');
}
registerPage('dashboard', r => renderDashboard(r, state.trades));
registerPage('analytics', r => renderAnalytics(r, state.trades));
registerPage('history', r => T.renderHistory(r, state.trades));
registerPage('new', r => T.renderForm(r, state.editing, onSubmit));
registerPage('account', r => renderAccount(r, state.settings, state.trades, async acc => { state.settings.account = acc; await store.put('settings', state.settings); invalidate(); show('account'); toast('حساب ذخیره شد'); }));
registerPage('chartlab', renderChartLab);
const actions = {
  theme: () => ui.toggleTheme(),
  'reset-form': () => { T.clearDraft(); state.editing = null; invalidate(); show('new'); },
  edit: b => { state.editing = state.trades.find(t => t.id === b.dataset.id); invalidate(); show('new'); },
  delete: async b => { if (await confirmModal('این معامله حذف شود؟')) { state.trades = state.trades.filter(t => t.id !== b.dataset.id); await persist(); toast('حذف شد'); show('history'); } },
  page: b => { T.view.page = +b.dataset.p; T.renderHistory($('history'), state.trades); }
};
document.addEventListener('click', e => {
  const p = e.target.closest('[data-page]'); if (p) { if (p.dataset.page === 'new') { state.editing = null; invalidate(); } return show(p.dataset.page); }
  const a = e.target.closest('[data-act]'); if (a) return actions[a.dataset.act]?.(a);
  const s = e.target.closest('[data-sort]'); if (s) { const k = s.dataset.sort; T.view.dir = T.view.sort === k ? -T.view.dir : -1; T.view.sort = k; T.renderHistory($('history'), state.trades); }
});
document.addEventListener('input', ui.debounce(e => { const v = e.target.dataset?.view; if (v) { T.view[v] = e.target.value; T.view.page = 1; T.renderHistory($('history'), state.trades); } }, 200));
addEventListener('error', e => console.error(e.error));
addEventListener('unhandledrejection', e => console.error(e.reason));
(async () => {
  ui.initTheme(); ui.buildNav();
  $('dashboard').innerHTML = '<div class="skeleton"></div>';
  try {
    await store.open();
    const r = await store.loadTrades(); state.trades = r.trades;
    if (r.recovered) toast('داده از آخرین بکاپ خودکار بازیابی شد');
    if (r.dropped) toast(`${r.dropped} رکورد خراب نادیده گرفته شد`, 'error');
    state.settings = Object.assign(state.settings, await store.get('settings') || {});
  } catch (e) { console.error(e); toast('IndexedDB در دسترس نیست', 'error'); }
  show('dashboard');
})();
