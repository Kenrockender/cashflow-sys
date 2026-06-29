/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — categories.js
   Custom category management
   Depends on: state.js, helpers.js
══════════════════════════════════════════════════════════ */

function addCustomCategory() {
  const rawLabel = document.getElementById('new-cat-label')?.value?.trim();
  const color = document.getElementById('new-cat-color')?.value || '#6b7280';
  if (!rawLabel) { toast(t('cat.custom.err.name')); return; }
  const label = rawLabel.replace(/[<>"'&]/g, '').slice(0, 50);
  if (!label) { toast(t('cat.custom.err.name')); return; }
  const id = 'custom_' + Date.now().toString(36);
  S.customCategories.push({ id, label, color });
  localStorage.setItem('cf-custom-cats', JSON.stringify(S.customCategories));
  const inp = document.getElementById('new-cat-label'); if (inp) inp.value = '';
  _catBuilt = false;
  refreshCatFilterOptions();
  renderCustomCategoriesList();
  toast(t('cat.custom.added'));
  render();
}

function removeCustomCategory(id) {
  S.customCategories = S.customCategories.filter(c => c.id !== id);
  localStorage.setItem('cf-custom-cats', JSON.stringify(S.customCategories));
  _catBuilt = false;
  refreshCatFilterOptions();
  renderCustomCategoriesList();
  render();
}

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { addCustomCategory, removeCustomCategory });
