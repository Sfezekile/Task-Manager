'use strict';

/* ============================================================
   SHARED HELPERS — depends on: constants.js
   ============================================================ */

/* ============================================================
   7. HELPERS
   ============================================================ */

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function categoryLabel(mode, value) {
  const cat = (CATEGORIES[mode] || []).find(c => c.value === value);
  return cat ? cat.label : value;
}

function categoryTagHTML(mode, value) {
  const color = CATEGORY_COLORS[value] || '#6B7280';
  return `<span class="category-tag" style="background:${color}22;color:${color};border-color:${color}55;">
    ${escapeHTML(categoryLabel(mode, value))}
  </span>`;
}

