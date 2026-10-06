'use strict';

/* ============================================================
   VIEW — ACCOUNT
   depends on: constants.js, date-utils.js, store.js, helpers.js,
               views/dashboard-core.js (must load first)
   ============================================================ */

const ACCOUNT_KEY = 'momentum.account';

Object.assign(Dashboard, {

  /* ---------- persistence ---------- */
  getAccount() {
    let acc = {};
    try { acc = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '{}'); } catch (e) { acc = {}; }
    if (!acc.createdAt) {
      acc.createdAt = new Date().toISOString();
      try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc)); } catch (e) { /* storage blocked */ }
    }
    return { name: '', email: '', role: '', ...acc };
  },

  _saveAccount(patch) {
    const next = { ...this.getAccount(), ...patch };
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next)); } catch (e) { /* storage blocked */ }
    return next;
  },

  /* ---------- helpers ---------- */
  _initials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  },

  _accountStats() {
    const tasks = TaskStore.all(this.mode) || [];
    const today = DateUtils.todayISO();
    const count = s => tasks.filter(t => t.status === s).length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;
    const total = tasks.length;
    const done = count('done');
    return {
      total, done, overdue,
      rate: total ? Math.round((done / total) * 100) : 0,
      breakdown: [
        { label: 'To Do', value: count('todo'), cls: 'todo' },
        { label: 'In Progress', value: count('inprogress'), cls: 'inprogress' },
        { label: 'Blocked', value: count('blocked'), cls: 'blocked' },
        { label: 'Done', value: done, cls: 'done' }
      ]
    };
  },

  // Builds a conic-gradient string like: #94A3B8 0% 30%, #3B82F6 30% 55%, ...
  _donutGradient(breakdown, total) {
    let acc = 0;
    if (!total) return 'conic-gradient(var(--border) 0% 100%)';
    const stops = breakdown.filter(b => b.value).map(b => {
      const start = (acc / total) * 100;
      acc += b.value;
      const end = (acc / total) * 100;
      return `var(--c-${b.cls}) ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  },

  /* ---------- render ---------- */
  _renderAccount() {
    const wrap = document.getElementById('mainViewWrap');
    if (!wrap) return;

    const acc = this.getAccount();
    const st = this._accountStats();
    const since = new Date(acc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    wrap.innerHTML = `
      <div class="account-view">
        <section class="account-layout">
          <div class="account-l-layout">
            <section class="account-card account-hero">
              <div class="account-avatar" id="accountAvatar">${escapeHTML(this._initials(acc.name))}</div>
              <div class="account-hero-text">
                  <div class="account-name" id="accountNameLabel">${escapeHTML(acc.name || 'Your name')}</div>
                <div class="account-sub">${escapeHTML(acc.role || 'Add a role')}${acc.email ? ' · ' + escapeHTML(acc.email) : ''}</div>
                <div class="account-since">Using Momentum since ${escapeHTML(since)}</div>
              </div>
            </section>

            <section class="account-card">
              <h3 class="account-card-title"><i class="ri-user-settings-line"></i> Profile</h3>
              <form id="accountForm" class="account-form" novalidate>
                <label class="account-field">
                  <span>Display name</span>
                  <input type="text" id="accName" value="${escapeHTML(acc.name)}" placeholder="e.g. Sipho Dlamini" autocomplete="name" maxlength="60" />
                </label>
                <label class="account-field">
                  <span>Email</span>
                  <input type="email" id="accEmail" value="${escapeHTML(acc.email)}" placeholder="you@example.com" autocomplete="email" />
                  <small class="account-error" id="accEmailError"></small>
                </label>
                <label class="account-field">
                  <span>Role / focus</span>
                  <input type="text" id="accRole" value="${escapeHTML(acc.role)}" placeholder="e.g. Student, Freelancer" maxlength="60" />
                </label>
                <div class="account-actions">
                  <span class="account-saved" id="accSaved" aria-live="polite"></span>
                  <button type="submit" class="btn-primary btn-sm">Save profile</button>
                </div>
              </form>
            </section>
          </div>

          <div class="account-r-layout">
            <section class="account-stats">
              <div class="account-stat"><div class="account-stat-num">${st.total}</div><div class="account-stat-label">Total tasks</div></div>
              <div class="account-stat"><div class="account-stat-num">${st.done}</div><div class="account-stat-label">Completed</div></div>
              <div class="account-stat ${st.overdue ? 'is-warn' : ''}"><div class="account-stat-num">${st.overdue}</div><div class="account-stat-label">Overdue</div></div>
              <div class="account-stat"><div class="account-stat-num">${st.rate}%</div><div class="account-stat-label">Completion</div></div>
            </section>

            <section class="account-card account-graph">
              <h3 class="account-card-title account-title"><i class="ri-bar-chart-horizontal-line"></i> Task breakdown</h3>
                <div class="account-stats-container">
                  ${st.total ? `
                  <div class="account-legend">
                    ${st.breakdown.map(b =>
                      `<span class="account-legend-item"><i class="account-dot seg-${b.cls}"></i>${b.label} <strong>${b.value}</strong></span>`).join('')}
                  </div>` : '<p class="account-muted">No tasks yet. Add one to see your breakdown.</p>'}
                  <div class="account-donut"
                       style="background:${this._donutGradient(st.breakdown, st.total)}"
                       role="img"
                       aria-label="${st.done} of ${st.total} tasks completed">
                    <div class="account-donut-hole">
                      <strong>${st.rate}%</strong>
                      <span>done</span>
                    </div>
                  </div>
                <div class="account-user-mode" role="group" aria-label="Task mode">
                  ${[['work', 'Work Mode'], ['student', 'Student Mode'], ['personal', 'Personal Mode']].map(([m, label]) => `
                    <button type="button"
                            class="mode-btn btn-sm ${this.mode === m ? 'active' : ''}"
                            data-mode="${m}"
                            aria-pressed="${this.mode === m}">${label}</button>`).join('')}
                </div>
              </div>
            </section>
          </div>
        </section>

        <h3 class="account-card-title account-data-title"><i class="ri-database-2-line"></i> Your data</h3>

        <section class="account-data">
          <div class="account-backup">
            <div class="account-content">
              <h3 class="account-title">Backup</h3>
              <p class="account-muted">Everything is stored locally in this browser. Back up regularly, since clearing browser data will erase it.</p>
            </div>
            <div class="account-data-actions">
              <button type="button" class="btn-secondary btn-sm" id="accBackupBtn"><i class="ri-download-2-line"></i> Backup</button>
            </div>
          </div>

          <div class="account-restore">
            <div class="account-content">
              <h3 class="account-title">Restore</h3>
              <p class="account-muted">Everything is stored locally in this browser. Back up regularly, since clearing browser data will erase it.</p>
            </div>
            <div class="account-data-actions">
              <button type="button" class="btn-secondary btn-sm" id="accRestoreBtn"><i class="ri-upload-2-line"></i> Restore</button>
            </div>
          </div>
        </section>
      </div>
    `;

    this._bindAccount(wrap);
  },

  /* ---------- events ---------- */
  _bindAccount(wrap) {
    const nameInput = wrap.querySelector('#accName');
    const avatar = wrap.querySelector('#accountAvatar');

    wrap.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.mode) return;
        this.setMode(mode);      // updates this.mode, resets the status filter, saves LASTMODE_KEY
        this._renderAccount();   // re-reads TaskStore.all(this.mode), so every stat updates
      });
    });

    // Live avatar preview while typing
    nameInput?.addEventListener('input', () => {
      avatar.textContent = this._initials(nameInput.value);
    });

    wrap.querySelector('#accountForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const email = wrap.querySelector('#accEmail').value.trim();
      const role = wrap.querySelector('#accRole').value.trim();
      const err = wrap.querySelector('#accEmailError');

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.textContent = 'Enter a valid email address.';
        return;
      }
      err.textContent = '';

      this._saveAccount({ name, email, role });
      this._renderAccount();
      const saved = document.getElementById('accSaved');
      if (saved) {
        saved.textContent = 'Saved ✓';
        setTimeout(() => { saved.textContent = ''; }, 2000);
      }
    });

    // Reuse existing backup/restore buttons so backup.js stays the single source of truth
    const proxy = (id, targetId) => {
      wrap.querySelector(id)?.addEventListener('click', () => document.getElementById(targetId)?.click());
    };
    proxy('#accBackupBtn', 'backupBtn');
    proxy('#accRestoreBtn', 'restoreBtn');
  },

});