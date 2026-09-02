'use strict';

/* ============================================================
   ALERT SYSTEM — depends on: constants.js, date-utils.js, store.js, helpers.js
   ============================================================ */

/* ============================================================
   6. ALERT SYSTEM
   ============================================================ */

const AlertSystem = {
  _dismissed: new Set(),

  init() {
    document.getElementById('alertToggleBtn').addEventListener('click', () => this.toggle());
    document.getElementById('closeAlertBtn').addEventListener('click', () => this.close());
    document.getElementById('alertDrawerOverlay').addEventListener('click', () => this.close());
  },

  _buildAlerts() {
    const alerts = [];
    MODES.forEach(mode => {
      TaskStore.all(mode).forEach(task => {
        if (task.status === 'done') return;
        const key = 'overdue_' + task.id;
        if (DateUtils.isOverdue(task.dueDate, task.status) && !this._dismissed.has(key)) {
          alerts.push({
            key, level: 'critical',
            message: `"${task.title}" (${MODE_META[mode].label}) is overdue.`,
            action: DateUtils.relativeLabel(task.dueDate, task.status),
          });
        } else if (DateUtils.isWithinDays(task.dueDate, 2) && !this._dismissed.has('soon_' + task.id)) {
          alerts.push({
            key: 'soon_' + task.id, level: 'warning',
            message: `"${task.title}" (${MODE_META[mode].label}) is due soon.`,
            action: DateUtils.relativeLabel(task.dueDate, task.status),
          });
        }
        if (TaskStore.isBlocked(mode, task) && !this._dismissed.has('blocked_' + task.id)) {
          const dep = TaskStore.getById(mode, task.dependsOn);
          alerts.push({
            key: 'blocked_' + task.id, level: 'info',
            message: `"${task.title}" is blocked by "${dep ? dep.title : 'a task'}".`,
            action: 'Complete the dependency to unblock',
          });
        }
      });
    });
    return alerts;
  },

  checkAll() {
    const alerts = this._buildAlerts();
    const badge = document.getElementById('alertBadge');
    const btn = document.getElementById('alertToggleBtn');
    if (alerts.length > 0) {
      badge.textContent = alerts.length;
      badge.classList.add('active');
      btn.classList.add('has-alerts');
    } else {
      badge.classList.remove('active');
      btn.classList.remove('has-alerts');
    }
    if (document.getElementById('alertDrawer').classList.contains('open')) {
      this._render();
    }
  },

  _render() {
    const alerts = this._buildAlerts();
    const content = document.getElementById('alertDrawerContent');
    if (alerts.length === 0) {
      content.innerHTML = `
        <div class="alert-clear">
          <div class="alert-clear-icon">✅</div>
          <div class="alert-clear-text">You're all caught up.</div>
        </div>`;
      return;
    }
    const iconFor = level => level === 'critical' ? '⏰' : level === 'warning' ? '⚠️' : 'ℹ️';
    content.innerHTML = `
      <div class="alert-list">
        ${alerts.map(a => `
          <div class="alert-item ${a.level}" data-key="${a.key}">
            <div class="alert-icon">${iconFor(a.level)}</div>
            <div class="alert-content">
              <div class="alert-message">${escapeHTML(a.message)}</div>
              <div class="alert-action">${escapeHTML(a.action)}</div>
            </div>
            <button class="alert-dismiss" data-key="${a.key}" aria-label="Dismiss">×</button>
          </div>
        `).join('')}
      </div>
      <div class="alert-footer">
        <button class="alert-dismiss-all-btn" id="dismissAllAlertsBtn">Dismiss all</button>
      </div>
    `;
    content.querySelectorAll('.alert-dismiss').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._dismissed.add(btn.dataset.key);
        this._render();
        this.checkAll();
      });
    });
    const dismissAllBtn = document.getElementById('dismissAllAlertsBtn');
    if (dismissAllBtn) {
      dismissAllBtn.addEventListener('click', () => {
        alerts.forEach(a => this._dismissed.add(a.key));
        this._render();
        this.checkAll();
      });
    }
  },

  toggle() {
    const drawer = document.getElementById('alertDrawer');
    const overlay = document.getElementById('alertDrawerOverlay');
    if (drawer.classList.contains('open')) { this.close(); return; }
    this._render();
    drawer.classList.add('open');
    overlay.classList.add('visible');
  },
  close() {
    document.getElementById('alertDrawer').classList.remove('open');
    document.getElementById('alertDrawerOverlay').classList.remove('visible');
  },
};

