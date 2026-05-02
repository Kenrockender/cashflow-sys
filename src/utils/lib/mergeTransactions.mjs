/**
 * Merge fresh Firestore transactions with optimistic local rows after offline queue flush.
 * @param {object[]} fresh
 * @param {object[]} prev
 * @param {string[]|null|undefined} syncedFingerprints
 * @param {(t: object) => string} fingerprintFn
 */
export function mergeTransactionsAfterQueueFlush(fresh, prev, syncedFingerprints, fingerprintFn) {
  const fp =
    fingerprintFn ||
    (t => `${t.date}|${Number(t.amount)}|${String(t.description || '').trim().toLowerCase()}`);
  const pruned = prev.filter(t => {
    if (!String(t.id || '').startsWith('offline_')) return true;
    if (syncedFingerprints && syncedFingerprints.length) {
      const ok = new Set(syncedFingerprints);
      return !ok.has(fp(t));
    }
    const fpSeen = new Set(fresh.map(x => fp(x)));
    return !fpSeen.has(fp(t));
  });
  const ids = new Set(fresh.map(t => t.id));
  return [...fresh, ...pruned.filter(t => !ids.has(t.id))];
}
