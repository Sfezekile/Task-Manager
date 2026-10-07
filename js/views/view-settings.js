'use strict';

/* ============================================================
   VIEW — SETTINGS
   depends on: constants.js, store.js, helpers.js,
               views/dashboard-core.js (must load first)
   ============================================================ */

const SETTINGS_KEY = 'momentum.settings';
const SETTINGS_DEFAULTS = { theme: 'light', density: 'comfortable', defaultView: 'board' };

Object.assign(Dashboard, {

  /* ---------- persistence ---------- */
  getSettings() {
    try {
      return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch (e) {
      return { ...SETTINGS_DEFAULTS };
    }
  },

  _saveSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { /* storage blocked */ }
    this._applySettings();
    return next;
  },

  // Safe to call at startup (main.js) and after every change
  _applySettings() {
    const s = this.getSettings();
    const dark = s.theme === 'dark' ||
      (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.body.classList.toggle('density-compact', s.density === 'compact');
  },

  /* ---------- small builders ---------- */
  _settingsSegment(name, options, current) {
    return `
      <div class="seg" role="radiogroup" data-setting="${name}">
        ${options.map(o => `
          <button type="button" class="seg-btn ${o.value === current ? 'active' : ''}"
                  role="radio" aria-checked="${o.value === current}" data-value="${o.value}">
            ${o.icon ? `<i class="${o.icon}"></i>` : ''}${o.label}
          </button>`).join('')}
      </div>`;
  },

  _settingsRow(title, desc, controlHTML) {
    return `
      <div class="settings-row">
        <div class="settings-row-text">
          <div class="settings-row-title">${title}</div>
          <div class="settings-row-desc">${desc}</div>
        </div>
        <div class="settings-row-control">${controlHTML}</div>
      </div>`;
  },

  /* ---------- render ---------- */
  _renderSettings() {
    const wrap = document.getElementById('mainViewWrap');
    if (!wrap) return;

    const s = this.getSettings();
    const tasks = TaskStore.all(this.mode) || [];
    const done = tasks.filter(t => t.status === 'done').length;
    const categories = Object.entries(typeof CATEGORY_COLORS !== 'undefined' ? CATEGORY_COLORS : {});

    wrap.innerHTML = `
      <div class="settings-view">

        <section class="settings-card">
          <h3 class="settings-card-title"><i class="ri-palette-line"></i> Appearance</h3>
          ${this._settingsRow('Theme', 'Choose light, dark, or follow your device.',
            this._settingsSegment('theme', [
              { value: 'light', label: 'Light', icon: 'ri-sun-line' },
              { value: 'dark', label: 'Dark', icon: 'ri-moon-line' },
              { value: 'system', label: 'System', icon: 'ri-computer-line' }
            ], s.theme))}
          ${this._settingsRow('Density', 'Compact fits more on screen.',
            this._settingsSegment('density', [
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' }
            ], s.density))}
        </section>

        <section class="settings-card">
          <h3 class="settings-card-title"><i class="ri-layout-line"></i> Preferences</h3>
          ${this._settingsRow('Default view', 'The view Momentum opens on.',
            this._settingsSegment('defaultView', [
              { value: 'board', label: 'Dashboard' },
              { value: 'calendar', label: 'Calendar' },
              { value: 'list', label: 'Task List' }
            ], s.defaultView))}
        </section>

        <section class="settings-card">
          <h3 class="settings-card-title"><i class="ri-price-tag-3-line"></i> Categories</h3>
          <div class="settings-cats">
            ${categories.length
              ? categories.map(([name, color]) => `
                  <span class="settings-cat" style="background:${color}26;border:1px solid ${color};color:${color};">
                    <span class="settings-cat-dot" style="background:${color}"></span>${escapeHTML(name)}
                  </span>`).join('')
              : '<p class="settings-muted">No categories defined.</p>'}
          </div>
        </section>

        <h3 class="account-card-title account-data-title"><i class="ri-database-2-line"></i> Your data</h3>

        <section class="account-data">
          <div class="account-backup">
            <div class="account-data-actions">
              ${this._settingsRow('Backup', 'Download all your data as a file.',
               `<button type="button" class="btn-secondary btn-sm" id="settingsBackupBtn"><i class="ri-download-2-line"></i> Backup</button>`)}
            </div>
          </div>

          <div class="account-restore">
            <div class="account-data-actions">
              ${this._settingsRow('Restore', 'Load data from a previous backup.',
               `<button type="button" class="btn-secondary btn-sm" id="settingsRestoreBtn"><i class="ri-upload-2-line"></i> Restore</button>`)}
            </div>
          </div>
          <div class="account-reset">
            <div class="account-data-actions">
              ${this._settingsRow('Reset preferences', 'Restore theme, density and default view to defaults. Tasks are not affected.',
               `<button type="button" class="btn-danger btn-reset" id="settingsResetBtn"><i class="ri-loop-right-line"></i> Reset</button>`)}
            </div>
          </div>
        </section>
        
          

        <section class="settings-card">
          <h3 class="settings-card-title"><i class="ri-information-line"></i> About</h3>
          <p class="settings-muted">Momentum – Task Dashboard. Your data is stored locally in this browser.</p>
        </section>

      </div>
    `;

    this._bindSettings(wrap);
  },

  /* ---------- events ---------- */
  _bindSettings(wrap) {
    // Segmented controls
    wrap.querySelectorAll('.seg').forEach(seg => {
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn) return;
        this._saveSettings({ [seg.dataset.setting]: btn.dataset.value });
        seg.querySelectorAll('.seg-btn').forEach(b => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-checked', on);
        });
      });
    });

    // Reuse the existing backup/restore buttons so backup.js stays the single source of truth
    const proxy = (id, targetId) => {
      const el = wrap.querySelector(id);
      if (el) el.addEventListener('click', () => document.getElementById(targetId)?.click());
    };
    proxy('#settingsBackupBtn', 'backupBtn');
    proxy('#settingsRestoreBtn', 'restoreBtn');

    wrap.querySelector('#settingsResetBtn')?.addEventListener('click', () => {
      if (!confirm('Reset all preferences to their defaults?')) return;
      this._saveSettings({ ...SETTINGS_DEFAULTS });
      this._renderSettings();
    });
  },

});

// Apply saved theme/density as soon as this script loads (avoids a flash)
Dashboard._applySettings();
