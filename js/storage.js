// IndexedDB + اعتبارسنجی + بکاپ خودکار + بازیابی. لایه‌ای که بعداً با API/Cloud عوض می‌شود.
const DB = 'neoJournalDB', STORE = 'records', VERSION = 1, BACKUP_EVERY = 10, BACKUP_KEEP = 3;
let db, writes = 0;
export function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'key' }); };
    r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => new Promise((res, rej) => { const q = fn(db.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
export const get = async k => (await tx('readonly', s => s.get(k)))?.value;
export const del = k => tx('readwrite', s => s.delete(k));
export async function put(k, value) {
  await tx('readwrite', s => s.put({ key: k, value }));
  if (k === 'trades' && ++writes % BACKUP_EVERY === 0) autoBackup(value).catch(console.warn);
}
async function autoBackup(trades) {
  const list = (await get('backups')) || [];
  list.unshift({ at: new Date().toISOString(), trades });
  await tx('readwrite', s => s.put({ key: 'backups', value: list.slice(0, BACKUP_KEEP) }));
}
export const isTrade = t => t && typeof t.id === 'string' && typeof t.date === 'string' && ['open', 'closed'].includes(t.status);
// Recovery: داده‌ی خراب حذف می‌شود و در صورت خالی بودن از آخرین بکاپ بازیابی می‌شود
export async function loadTrades() {
  const raw = await get('trades');
  const list = Array.isArray(raw) ? raw : [];
  const valid = list.filter(isTrade);
  if (!valid.length) {
    const b = (await get('backups')) || [];
    const recovered = Array.isArray(b[0]?.trades) ? b[0].trades.filter(isTrade) : [];
    if (recovered.length) {
      await put('trades', recovered);
      return { trades: recovered, recovered: true };
    }
  }
  if (valid.length !== list.length) await put('trades', valid); // پاکسازی دائمی رکوردهای خراب
  return { trades: valid, recovered: false, dropped: list.length - valid.length };
}
export async function exportJson(state) {
  const blob = new Blob([JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'neo-journal-backup.json' });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function importJson(file, maxBytes = 50e6) {
  if (file.size > maxBytes) throw new Error('فایل بیش از حد بزرگ است');
  const d = JSON.parse(await file.text());
  if (!Array.isArray(d.trades)) throw new Error('ساختار فایل معتبر نیست');
  return d.trades.filter(isTrade);
}
