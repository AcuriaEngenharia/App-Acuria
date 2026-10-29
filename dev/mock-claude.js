/*
 * Simulação local do runtime de Artifacts (window.claude) para testar o app fora do claude.ai.
 * Implementa só o que o app usa: db (collection/doc com get, onSnapshot, set, update, delete),
 * downloads (save), user (can) e assets (upload).
 * Os dados ficam no localStorage do navegador (chave "mockdb"). Para começar do zero:
 *   localStorage.removeItem('mockdb'); location.reload();
 * Para carregar uma base de teste, defina window.__SEED = { "caminho/do/doc": {...}, ... } antes deste script.
 */
(function () {
  const KEY = 'mockdb';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { store = {}; }
  if (window.__SEED && !Object.keys(store).length) store = JSON.parse(JSON.stringify(window.__SEED));
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { console.warn('mockdb: localStorage cheio', e); } };

  const clone = o => JSON.parse(JSON.stringify(o));
  const parent = p => p.split('/').slice(0, -1).join('/');
  const idOf = p => p.split('/').pop();
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  // merge aninhado: null apaga a chave, objetos são mesclados, o resto substitui
  function merge(dst, src) {
    for (const k in src) {
      const v = src[k];
      if (v === null) delete dst[k];
      else if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], v);
      else dst[k] = clone(v);
    }
    return dst;
  }
  const docSnap = p => ({ id: idOf(p), exists: p in store, data: () => (p in store ? clone(store[p]) : undefined) });
  const colSnap = p => ({ docs: Object.keys(store).filter(k => parent(k) === p).sort().map(docSnap) });

  const subs = new Set();
  function notify(path) {
    persist();
    for (const s of subs) {
      if (s.kind === 'doc' && s.path === path) setTimeout(() => s.fn(docSnap(s.path)), 0);
      if (s.kind === 'col' && parent(path) === s.path) setTimeout(() => s.fn(colSnap(s.path)), 0);
    }
  }
  const delay = () => new Promise(r => setTimeout(r, 5));
  const db = {
    collection(path) {
      return {
        async get() { await delay(); return colSnap(path); },
        onSnapshot(fn) { const s = { kind: 'col', path, fn }; subs.add(s); setTimeout(() => fn(colSnap(path)), 0); return () => subs.delete(s); }
      };
    },
    doc(path) {
      return {
        async get() { await delay(); return docSnap(path); },
        onSnapshot(fn) { const s = { kind: 'doc', path, fn }; subs.add(s); setTimeout(() => fn(docSnap(path)), 0); return () => subs.delete(s); },
        async set(data) { await delay(); store[path] = clone(data); notify(path); },
        async update(data) { await delay(); if (!(path in store)) throw err('invalid_argument', 'documento não existe: ' + path); merge(store[path], data); notify(path); },
        async delete() { await delay(); delete store[path]; notify(path); }
      };
    }
  };
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { status: 'saved' };
    }
  };
  const assets = {
    async upload(file) {
      const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file instanceof Blob ? file : new Blob([file])); });
      return { id: 'local-' + Date.now(), url };
    }
  };
  const user = { async can() { return true; } };
  window.claude = { use: async n => ({ db, downloads, assets, user })[n] || null };
  window.__mockdb = { store: () => store, reset() { localStorage.removeItem(KEY); location.reload(); } };
})();
