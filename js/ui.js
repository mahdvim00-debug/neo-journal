// UI عمومی: escape (ضد XSS)، toast، modal، تم، ناوبری lazy
export const $ = id => document.getElementById(id);
const ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const TOAST_MS = 3200;
export function toast(msg, type = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
  $('toasts').append(el); setTimeout(() => el.remove(), TOAST_MS);
}
export function confirmModal(msg) {
  const m = $('modal'); $('modalMsg').textContent = msg;
  return new Promise(res => { m.addEventListener('close', () => res(m.returnValue === 'yes'), { once: true }); m.returnValue = 'no'; m.showModal(); });
}
export function initTheme() {
  let t = 'dark'; try { t = localStorage.getItem('neo.theme') || 'dark'; } catch {}
  document.body.dataset.theme = t;
}
export function toggleTheme() {
  const t = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = t; try { localStorage.setItem('neo.theme', t); } catch {}
  document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  return t;
}
export const PAGES = { dashboard: ['داشبورد', '▦'], new: ['ثبت', '＋'], history: ['تاریخچه', '▤'], analytics: ['تحلیل', '◫'], account: ['حساب', '$'], chartlab: ['چارت', '◧'] };
const renderers = {}, rendered = new Set();
export const registerPage = (name, fn) => { renderers[name] = fn; };
export const invalidate = () => rendered.clear(); // Lazy Rendering: فقط صفحهٔ فعال رندر می‌شود
export function buildNav() {
  const html = Object.entries(PAGES).map(([k, [t, i]]) => `<button data-page="${k}">${i} ${t}</button>`).join('');
  $('nav').innerHTML = html; $('dock').innerHTML = html;
}
export async function show(page) {
  if (!PAGES[page]) return;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('pageTitle').textContent = PAGES[page][0];
  if (!rendered.has(page)) {
    try { await renderers[page]($(page)); rendered.add(page); } catch (e) { console.error(e); toast('خطا در نمایش صفحه', 'error'); }
  }
  scrollTo(0, 0);
}
