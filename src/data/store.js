/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — store.js
   Offline queue (IndexedDB) + Firebase Firestore operations.
   Depends on: firebase-init.js (db, auth)
══════════════════════════════════════════════════════════ */

// Export to window for app.js access
window.txSyncFingerprint = function txSyncFingerprint(t) {
  const amt = Number(t.amount);
  const cat = t.category || '';
  const acct = t.accountId || '';
  return `${t.date}|${amt}|${String(t.description || '').trim().toLowerCase()}|${cat}|${acct}`;
};
const txSyncFingerprint = window.txSyncFingerprint;

function isOfflineFirestoreError(e) {
  if (!e) return false;
  let c = e.code != null ? String(e.code) : '';
  if (c.includes('/')) c = c.split('/').pop();
  if (c === 'unavailable') return true;
  const msg = String(e.message || '');
  if (/client is offline|failed to get document/i.test(msg)) return true;
  if (/failed to get documents/i.test(msg)) return true;
  return false;
}

async function firestoreQueryGet(q) {
  try {
    return await q.get();
  } catch (e) {
    if (!isOfflineFirestoreError(e)) throw e;
    try {
      return await q.get({ source: 'cache' });
    } catch (_) {
      return { empty: true, docs: [] };
    }
  }
}

async function firestoreDocGet(ref) {
  try {
    return await ref.get();
  } catch (e) {
    if (!isOfflineFirestoreError(e)) throw e;
    try {
      return await ref.get({ source: 'cache' });
    } catch (_) {
      return { exists: false, data: () => null };
    }
  }
}

/* ── OFFLINE QUEUE ───────────────────────────────────────── */
const OQ = (() => {
  const DB = 'cashflow-offline', ST = 'pending';
  let _db = null;

  const open = () => new Promise((res, rej) => {
    if (_db) return res(_db);
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(ST))
        d.createObjectStore(ST, { keyPath: 'localId', autoIncrement: true });
    };
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror = () => rej(r.error);
  });

  const enqueue = async tx => {
    const d = await open();
    return new Promise((res, rej) => {
      const s = d.transaction(ST, 'readwrite').objectStore(ST);
      const r = s.add({ ...tx, queuedAt: Date.now() });
      r.onsuccess = () => res(r.result);
      r.onerror  = () => rej(r.error);
    });
  };

  const getAll = async () => {
    const d = await open();
    return new Promise((res, rej) => {
      const s = d.transaction(ST, 'readonly').objectStore(ST);
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => rej(r.error);
    });
  };

  const remove = async lid => {
    const d = await open();
    return new Promise((res, rej) => {
      const s = d.transaction(ST, 'readwrite').objectStore(ST);
      const r = s.delete(lid);
      r.onsuccess = () => res();
      r.onerror   = () => rej(r.error);
    });
  };

  const flush = async () => {
    const pending = await getAll();
    if (!pending.length) return { n: 0, failed: 0, syncedFingerprints: [] };
    
    // Batch items into chunks for faster processing
    const BATCH_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      chunks.push(pending.slice(i, i + BATCH_SIZE));
    }
    
    let n = 0, failed = 0;
    const syncedFingerprints = [];
    
    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(async item => {
        const { localId, queuedAt, ...tx } = item;
        await Store.add(tx);
        await remove(localId);
        return { tx, localId };
      }));
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          n++;
          syncedFingerprints.push(txSyncFingerprint(result.value.tx));
        } else {
          failed++;
          console.warn('OQ flush error:', result.reason);
        }
      }
    }
    return { n, failed, syncedFingerprints };
  };

  return { enqueue, getAll, flush };
})();

/* ── STORE ───────────────────────────────────────────────── */
const Store = (() => {
  let uid = null;
  const col  = n  => db.collection('users').doc(uid).collection(n);
  const ts   = () => firebase.firestore.FieldValue.serverTimestamp();

  const setUser = u => { uid = u; console.log('[STORE] User set:', u); };

  const add = async tx => {
    console.log('[STORE] Adding tx to:', `users/${uid}/transactions`);
    try {
      const r = await col('transactions').add({ ...tx, createdAt: ts() });
      console.log('[STORE] Added with id:', r.id);
      return r.id;
    } catch (e) {
      console.error('[STORE] Add failed:', e.code, e.message);
      throw e;
    }
  };

  const addBatch = async txs => {
    const results = [];
    const chunks  = [];
    for (let i = 0; i < txs.length; i += 400) chunks.push(txs.slice(i, i + 400));
    for (const chunk of chunks) {
      const batch = db.batch();
      const refs = chunk.map(tx => {
        const ref = col('transactions').doc();
        batch.set(ref, { ...tx, createdAt: ts() });
        return { id: ref.id, ...tx };
      });
      await batch.commit();
      results.push(...refs);
    }
    return results;
  };

  const update = async (id, d) => col('transactions').doc(id).update(d);
  const del    = async id     => col('transactions').doc(id).delete();
  
  // Soft delete: mark as deleted instead of removing
  const softDelete = async id => col('transactions').doc(id).update({ 
    deleted: true, 
    deletedAt: ts() 
  });
  
  // Restore soft-deleted transaction
  const restore = async id => col('transactions').doc(id).update({ 
    deleted: firebase.firestore.FieldValue.delete(), 
    deletedAt: firebase.firestore.FieldValue.delete() 
  });
  
  // Permanently delete (empty trash)
  const permDelete = async id => col('transactions').doc(id).delete();
  
  // Get deleted transactions (trash)
  const getDeleted = async () => {
    const q = col('transactions').where('deleted', '==', true).orderBy('deletedAt', 'desc').limit(100);
    const s = await firestoreQueryGet(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const omitDeleted = txs => txs.filter(t => !t.deleted);
  
  // Empty trash (permanent delete all)
  const emptyTrash = async () => {
    const deleted = await getDeleted();
    if (!deleted.length) return 0;
    const chunks = [];
    for (let i = 0; i < deleted.length; i += 400) chunks.push(deleted.slice(i, i + 400));
    let count = 0;
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(tx => batch.delete(col('transactions').doc(tx.id)));
      await batch.commit();
      count += chunk.length;
    }
    return count;
  };

  const getRecent = async (months = 6) => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const q = col('transactions').orderBy('date', 'desc').where('date', '>=', cutoffStr);
    const s = await firestoreQueryGet(q);
    return omitDeleted(s.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const getLatest = async (limitCount = 2000) => {
    const q = col('transactions').orderBy('date', 'desc').limit(limitCount);
    const s = await firestoreQueryGet(q);
    return omitDeleted(s.docs.map(d => ({ id: d.id, ...d.data() }))).sort(sortTxByInput);
  };

  const getPage = async (afterDate, limit = 200) => {
    const q = col('transactions').orderBy('date', 'desc').where('date', '<', afterDate).limit(limit);
    const s = await firestoreQueryGet(q);
    return omitDeleted(s.docs.map(d => ({ id: d.id, ...d.data() }))).sort(sortTxByInput);
  };

  const saveBudgets     = async b     => col('settings').doc('budgets').set(b);
  const getBudgets      = async ()    => {
    const d = await firestoreDocGet(col('settings').doc('budgets'));
    return d.exists ? d.data() : { ...DEF_BUDGETS };
  };
  const saveBudgetsFull = async (amounts, percents, income) =>
    col('settings').doc('budgets').set({ ...amounts, __percents__: percents, __income__: income });
  const getBudgetsFull  = async () => {
    const d = await firestoreDocGet(col('settings').doc('budgets'));
    if (!d.exists) return { amounts: { ...DEF_BUDGETS }, percents: {}, income: 10000000 };
    const raw = d.data();
    const percents = raw.__percents__ || {};
    const income   = raw.__income__ || parseInt(localStorage.getItem('cf-total-income')) || 10000000;
    const amounts  = {};
    for (const k of Object.keys(raw)) { if (!k.startsWith('__')) amounts[k] = raw[k]; }
    return { amounts, percents, income };
  };

  // Goals
  const addGoal    = async g    => { const r = await col('goals').add({ ...g, createdAt: ts() }); return r.id; };
  const updateGoal = async (id, d) => col('goals').doc(id).update(d);
  const delGoal    = async id   => col('goals').doc(id).delete();
  const getGoals   = async ()   => {
    const q = col('goals').orderBy('createdAt', 'asc');
    const s = await firestoreQueryGet(q);
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  return { setUser, add, addBatch, update, del, softDelete, restore, permDelete, getDeleted, emptyTrash, getRecent, getLatest, getPage, saveBudgets, getBudgets, saveBudgetsFull, getBudgetsFull, addGoal, updateGoal, delGoal, getGoals };
})();

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { txSyncFingerprint, isOfflineFirestoreError, firestoreQueryGet, firestoreDocGet, OQ, Store });
