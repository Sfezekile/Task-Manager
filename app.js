/**
 * Momentum – Task Dashboard app.js
 * ──────────────────────────────────
 * Repurposed from the leave tracker shell into a multi-mode
 * (Student / Personal / Work) task & project dashboard.
 * Each mode is a fully separate task workspace. Tasks can
 * depend on another task in the same mode ("Depends On"),
 * and are shown as blocked until that dependency is Done.
 */

'use strict';

/* ============================================================
   1. CONSTANTS
   ============================================================ */

const STORAGE_KEY = 'momentum_tasks_v1';
const BACKUP_KEY = 'momentum_backups_v1';
const SESSION_KEY = 'momentum_session_data';
const LASTMODE_KEY = 'momentum_last_mode';

const MODES = ['student', 'personal', 'work'];

const MODE_META = {
  student: { label: 'Student Mode', icon: 'ri-graduation-cap-line' },
  personal: { label: 'Personal Mode', icon: 'ri-flask-line' },
  work: { label: 'Work Mode', icon: 'ri-briefcase-line' },
};

const CATEGORIES = {
  student: [
    { value: 'assignment', label: 'Assignment' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'exam', label: 'Exam' },
    { value: 'reading', label: 'Reading' },
    { value: 'project', label: 'Project' },
  ],
  personal: [
    { value: 'project', label: 'Project' },
    { value: 'case-study', label: 'Case Study' },
    { value: 'goal', label: 'Goal' },
    { value: 'errand', label: 'Personal Task' },
  ],
  work: [
    { value: 'commitment', label: 'Commitment' },
    { value: 'volunteer', label: 'Volunteer Work' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'deliverable', label: 'Deliverable' },
  ],
};

// Deterministic color per category (shared across modes for consistency)
const CATEGORY_COLORS = {
  assignment: '#2558D8',
  quiz: '#9333EA',
  exam: '#DC2626',
  reading: '#0891B2',
  project: '#16A34A',
  'case-study': '#D97706',
  goal: '#DB2777',
  errand: '#65A30D',
  commitment: '#7C3AED',
  volunteer: '#0EA472',
  meeting: '#B45309',
  deliverable: '#1D4ED8',
};

const STATUS_META = {
  todo: { label: 'To Do' },
  inprogress: { label: 'In Progress' },
  done: { label: 'Done' },
};

const PRIORITY_META = {
  high: { label: 'High', cls: 'priority-high' },
  medium: { label: 'Medium', cls: 'priority-medium' },
  low: { label: 'Low', cls: 'priority-low' },
};

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ============================================================
   2. DATE UTILITIES
   ============================================================ */

const DateUtils = {
  parse(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  today() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  },
  todayISO() { return this.toISO(this.today()); },
  addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  },
  daysBetween(start, end) {
    const ms = end.getTime() - start.getTime();
    return Math.round(ms / 86400000);
  },
  displayDate(iso) {
    if (!iso) return '—';
    const d = this.parse(iso);
    return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  },
  isOverdue(iso, status) {
    if (!iso || status === 'done') return false;
    return this.parse(iso) < this.today();
  },
  isToday(iso) {
    if (!iso) return false;
    return iso === this.todayISO();
  },
  isWithinDays(iso, n) {
    if (!iso) return false;
    const diff = this.daysBetween(this.today(), this.parse(iso));
    return diff >= 0 && diff <= n;
  },
  startOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  },
  /** All dates to render for a month calendar grid (incl. leading/trailing) */
  monthGridDates(year, month) {
    const first = new Date(year, month, 1);
    const start = this.startOfWeek(first);
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(this.addDays(start, i));
    return cells;
  },
  relativeLabel(iso, status) {
    if (!iso) return 'No due date';
    const diff = this.daysBetween(this.today(), this.parse(iso));
    if (status !== 'done') {
      if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
      if (diff === 0) return 'Due today';
      if (diff === 1) return 'Due tomorrow';
    }
    return this.displayDate(iso);
  },
};

/* ============================================================
   3. TASK STORE
   ============================================================ */

const TaskStore = {
  _data: { student: [], personal: [], work: [] },

  init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        MODES.forEach(m => {
          this._data[m] = Array.isArray(parsed[m])
            ? parsed[m].filter(t => t && t.id && t.title && t.dueDate)
            : [];
        });
      }
    } catch (e) {
      console.error('TaskStore: corrupted data, attempting recovery', e);
      const backups = BackupManager._getBackups();
      if (backups.length > 0) {
        this._data = backups[0].data;
        this._save();
        Toast.show('Recovered data from backup', 'warning');
      }
    }
  },

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
  },

  all(mode) {
    return this._data[mode] || [];
  },

  getById(mode, id) {
    return this.all(mode).find(t => t.id === id) || null;
  },

  effectiveStart(task) {
    return task.startDate || task.dueDate;
  },

  create(mode, data) {
    const now = new Date().toISOString();
    const record = {
      id: 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      mode,
      title: data.title,
      category: data.category,
      priority: data.priority,
      status: data.status,
      startDate: data.startDate || data.dueDate,
      dueDate: data.dueDate,
      dependsOn: data.dependsOn || '',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    this._data[mode].push(record);
    this._save();
    return record;
  },

  update(mode, id, data) {
    const list = this._data[mode];
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Task not found.');
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    this._save();
    return list[idx];
  },

  delete(mode, id) {
    this._data[mode] = this._data[mode].filter(t => t.id !== id);
    // clear dangling dependsOn references
    this._data[mode].forEach(t => {
      if (t.dependsOn === id) t.dependsOn = '';
    });
    this._save();
  },

  /** Is task blocked by an unfinished dependency? */
  isBlocked(mode, task) {
    if (!task.dependsOn) return false;
    const dep = this.getById(mode, task.dependsOn);
    if (!dep) return false;
    return dep.status !== 'done';
  },

  stats(mode) {
    const list = this.all(mode);
    const overdue = list.filter(t => DateUtils.isOverdue(t.dueDate, t.status)).length;
    const dueWeek = list.filter(t => t.status !== 'done' && DateUtils.isWithinDays(t.dueDate, 7)).length;
    const done = list.filter(t => t.status === 'done').length;
    return { total: list.length, overdue, dueWeek, done };
  },
};

/* ============================================================
   4. BACKUP MANAGER
   ============================================================ */

const BackupManager = {
  _getBackups() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },
  createBackup() {
    const backups = this._getBackups();
    backups.unshift({ data: TaskStore._data, timestamp: new Date().toISOString() });
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 5)));
  },
  exportData() {
    const json = JSON.stringify(TaskStore._data, null, 2);
    return new Blob([json], { type: 'application/json' });
  },
  importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          MODES.forEach(m => {
            TaskStore._data[m] = Array.isArray(parsed[m]) ? parsed[m] : [];
          });
          TaskStore._save();
          resolve(TaskStore._data);
        } catch (err) {
          reject(new Error('Invalid backup file.'));
        }
      };
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsText(file);
    });
  },
};

/* ============================================================
   5. TOAST
   ============================================================ */

const Toast = {
  show(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  },
};

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

/* ============================================================
   8. DASHBOARD (stats + board + upcoming panel)
   ============================================================ */

const Dashboard = {
  mode: 'student',
  statusFilter: 'all',
  dueTodayOnly: false,

  // main view: 'board' or 'calendar'
  view: 'board',
  calYear: DateUtils.today().getFullYear(),
  calMonth: DateUtils.today().getMonth(),

  init(onOpenTask) {
    this._onOpenTask = onOpenTask;
    const saved = localStorage.getItem(LASTMODE_KEY);
    if (MODES.includes(saved)) this.mode = saved;

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setMode(btn.dataset.mode);
        App.refresh();
      });
    });

    document.querySelectorAll('#statusTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#statusTabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.statusFilter = btn.dataset.status;
        App.refresh();
      });
    });
  },

  setMode(mode) {
    this.mode = mode;
    this.statusFilter = 'all';
    document.querySelectorAll('#statusTabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#statusTabs .tab-btn[data-status="all"]').classList.add('active');
    localStorage.setItem(LASTMODE_KEY, mode);
  },

  cycleMode(delta) {
    const idx = MODES.indexOf(this.mode);
    const next = MODES[(idx + delta + MODES.length) % MODES.length];
    this.setMode(next);
  },

  setView(view) {
    this.view = view;
    const filterWrap = document.getElementById('topbarFilterWrap');
    const todayBtn = document.getElementById('todayBtn');
    const isMonthBased = view === 'calendar' || view === 'gantt';
    if (isMonthBased) {
      filterWrap.style.display = 'none';
      todayBtn.textContent = 'This Month';
      todayBtn.title = 'Jump to current month';
      todayBtn.classList.remove('active-filter');
    } else {
      filterWrap.style.display = '';
      todayBtn.textContent = 'Due Today';
      todayBtn.title = 'Show tasks due today';
      todayBtn.classList.toggle('active-filter', this.dueTodayOnly);
    }
  },

  calPrev() {
    this.calMonth--;
    if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
  },
  calNext() {
    this.calMonth++;
    if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
  },
  calToday() {
    const t = DateUtils.today();
    this.calYear = t.getFullYear();
    this.calMonth = t.getMonth();
  },

  periodLabel() {
    if (this.view === 'calendar' || this.view === 'gantt') {
      return `${MONTHS_FULL[this.calMonth]} ${this.calYear}`;
    }
    return MODE_META[this.mode].label;
  },

  _renderModeSwitcher() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.mode);
    });
  },

  _renderStats() {
    const s = TaskStore.stats(this.mode);
    const row = document.getElementById('statsRow');
    row.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value">${s.total}</div>
        <div class="stat-sub">${MODE_META[this.mode].label}</div>
      </div>
      <div class="stat-card stat-week">
        <div class="stat-label">Due This Week</div>
        <div class="stat-value">${s.dueWeek}</div>
        <div class="stat-sub">Next 7 days</div>
      </div>
      <div class="stat-card stat-overdue">
        <div class="stat-label">Overdue</div>
        <div class="stat-value">${s.overdue}</div>
        <div class="stat-sub">Needs attention</div>
      </div>
      <div class="stat-card stat-done">
        <div class="stat-label">Completed</div>
        <div class="stat-value">${s.done}</div>
        <div class="stat-sub">${s.total ? Math.round((s.done / s.total) * 100) : 0}% of total</div>
      </div>
    `;
  },

  _taskCardHTML(task) {
    const blocked = TaskStore.isBlocked(this.mode, task);
    const overdue = DateUtils.isOverdue(task.dueDate, task.status);
    const color = CATEGORY_COLORS[task.category] || '#6B7280';
    const classes = ['task-card'];
    if (blocked) classes.push('is-blocked');
    if (overdue) classes.push('is-overdue');
    if (task.status === 'done') classes.push('is-done');
    return `
      <div class="${classes.join(' ')}" style="border-left-color:${color};" data-id="${task.id}">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta-row">
          ${categoryTagHTML(this.mode, task.category)}
          <span class="priority-dot ${PRIORITY_META[task.priority].cls}" title="${PRIORITY_META[task.priority].label} priority"></span>
        </div>
        <div class="task-meta-row">
          <span class="task-due"><i class="ri-calendar-line"></i> ${escapeHTML(DateUtils.relativeLabel(task.dueDate, task.status))}</span>
          ${blocked ? `<span class="task-lock"><i class="ri-lock-line"></i> Blocked</span>` : ''}
        </div>
      </div>
    `;
  },

  _matchesFilter(task) {
    if (this.dueTodayOnly && !DateUtils.isToday(task.dueDate)) return false;
    if (this.statusFilter === 'all') return true;
    if (this.statusFilter === 'blocked') return TaskStore.isBlocked(this.mode, task);
    return task.status === this.statusFilter;
  },

  _renderBoard() {
    const wrap = document.getElementById('mainViewWrap');
    const list = TaskStore.all(this.mode).filter(t => this._matchesFilter(t));

    // sort by due date ascending, no-date last
    const sortByDue = (a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    };

    const isSingle = this.statusFilter !== 'all';

    if (isSingle) {
      list.sort(sortByDue);
      const title = this.statusFilter === 'blocked' ? 'Blocked Tasks' : STATUS_META[this.statusFilter].label;
      wrap.innerHTML = `
        <div class="task-board single-column">
          <div class="task-column">
            <div class="task-column-header">
              <h4>${title}</h4>
              <span class="task-column-count">${list.length}</span>
            </div>
            <div class="task-column-list">
              ${list.length === 0
          ? `<div class="task-column-empty">Nothing here. Enjoy the quiet.</div>`
          : list.map(t => this._taskCardHTML(t)).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      const columns = ['todo', 'inprogress', 'done'];
      wrap.innerHTML = `
        <div class="task-board">
          ${columns.map(colStatus => {
        const colTasks = list.filter(t => t.status === colStatus).sort(sortByDue);
        return `
              <div class="task-column">
                <div class="task-column-header">
                  <h4>${STATUS_META[colStatus].label}</h4>
                  <span class="task-column-count">${colTasks.length}</span>
                </div>
                <div class="task-column-list">
                  ${colTasks.length === 0
            ? `<div class="task-column-empty">No tasks here yet.</div>`
            : colTasks.map(t => this._taskCardHTML(t)).join('')}
                </div>
              </div>
            `;
      }).join('')}
        </div>
      `;
    }

    wrap.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('click', () => this._onOpenTask(card.dataset.id));
    });
  },

  _renderUpcoming() {
    const list = TaskStore.all(this.mode)
      .filter(t => t.status !== 'done')
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
      .slice(0, 8);

    document.getElementById('legendCount').textContent =
      `${TaskStore.all(this.mode).length} tasks`;

    const listEl = document.getElementById('legendList');
    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-legend">No upcoming tasks.</p>`;
      return;
    }
    listEl.innerHTML = list.map(t => {
      const color = CATEGORY_COLORS[t.category] || '#6B7280';
      const overdue = DateUtils.isOverdue(t.dueDate, t.status);
      return `
        <div class="legend-item" data-id="${t.id}">
          <span class="legend-dot" style="background:${color};"></span>
          <div class="legend-info">
            <div class="legend-name">${escapeHTML(t.title)}</div>
            <div class="legend-dept ${overdue ? 'overdue' : ''}">${escapeHTML(DateUtils.relativeLabel(t.dueDate, t.status))}</div>
          </div>
          <span class="legend-badge">${PRIORITY_META[t.priority].label}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.legend-item').forEach(item => {
      item.addEventListener('click', () => this._onOpenTask(item.dataset.id));
    });
  },

  _taskPillHTML(task) {
    const color = CATEGORY_COLORS[task.category] || '#6B7280';
    const blocked = TaskStore.isBlocked(this.mode, task);
    return `
      <div class="leave-pill pill-single ${blocked ? 'is-blocked-pill' : ''}"
           style="background:${color}26;border:1px solid ${color};color:${color};"
           data-id="${task.id}" title="${escapeHTML(task.title)}">
        ${blocked ? '<i class="ri-lock-line"></i> ' : ''}${escapeHTML(task.title)}
      </div>
    `;
  },

  _renderCalendar() {
    const wrap = document.getElementById('mainViewWrap');
    const tasksByDate = new Map();
    TaskStore.all(this.mode).forEach(t => {
      if (!t.dueDate) return;
      if (!tasksByDate.has(t.dueDate)) tasksByDate.set(t.dueDate, []);
      tasksByDate.get(t.dueDate).push(t);
    });

    const cells = DateUtils.monthGridDates(this.calYear, this.calMonth);
    const todayISO = DateUtils.todayISO();

    wrap.innerHTML = `
      <div class="cal-month">
        <div class="cal-weekdays">
          ${DAYS_SHORT.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        </div>
        <div class="cal-grid">
          ${cells.map(date => {
      const iso = DateUtils.toISO(date);
      const otherMonth = date.getMonth() !== this.calMonth;
      const isToday = iso === todayISO;
      const dayTasks = (tasksByDate.get(iso) || []).sort((a, b) => a.title.localeCompare(b.title));
      const shown = dayTasks.slice(0, 3);
      const extra = dayTasks.length - shown.length;
      return `
              <div class="cal-cell ${otherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}">
                <div class="cell-day">${isToday ? `<span class="cell-today-ring">${date.getDate()}</span>` : date.getDate()}</div>
                <div class="cell-events">
                  ${shown.map(t => this._taskPillHTML(t)).join('')}
                  ${extra > 0 ? `<div class="pill-more" data-iso="${iso}">+${extra} more</div>` : ''}
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;

    wrap.querySelectorAll('.leave-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onOpenTask(pill.dataset.id);
      });
    });
    wrap.querySelectorAll('.pill-more').forEach(more => {
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        const dayTasks = tasksByDate.get(more.dataset.iso) || [];
        if (dayTasks[0]) this._onOpenTask(dayTasks[0].id);
      });
    });
  },

  _renderGantt() {
    const wrap = document.getElementById('mainViewWrap');
    const monthLen = new Date(this.calYear, this.calMonth + 1, 0).getDate();
    const dayW = 32; // must match --gantt-day-w
    const monthStart = new Date(this.calYear, this.calMonth, 1);
    const monthEnd = new Date(this.calYear, this.calMonth, monthLen);
    const todayISO = DateUtils.todayISO();

    const rows = TaskStore.all(this.mode)
      .map(t => {
        const s = DateUtils.parse(TaskStore.effectiveStart(t));
        const e = DateUtils.parse(t.dueDate);
        const start = s <= e ? s : e;
        const end = s <= e ? e : s;
        return { task: t, start, end };
      })
      .filter(r => r.end >= monthStart && r.start <= monthEnd)
      .sort((a, b) => a.start - b.start || a.task.title.localeCompare(b.task.title));

    if (rows.length === 0) {
      wrap.innerHTML = `
        <div class="gantt-wrap">
          <div class="gantt-empty">No tasks fall within ${MONTHS_FULL[this.calMonth]} ${this.calYear} for ${MODE_META[this.mode].label}.</div>
        </div>`;
      return;
    }

    const dayHeaderHTML = Array.from({ length: monthLen }, (_, i) => {
      const d = i + 1;
      const dateObj = new Date(this.calYear, this.calMonth, d);
      const iso = DateUtils.toISO(dateObj);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const isToday = iso === todayISO;
      return `<div class="gantt-day-cell ${isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}">${d}</div>`;
    }).join('');

    let todayLinePx = null;
    if (this.calYear === DateUtils.today().getFullYear() && this.calMonth === DateUtils.today().getMonth()) {
      todayLinePx = (DateUtils.today().getDate() - 1) * dayW;
    }

    const rowsHTML = rows.map(({ task, start, end }) => {
      const clippedStart = start < monthStart ? monthStart : start;
      const clippedEnd = end > monthEnd ? monthEnd : end;
      const startDay = clippedStart.getDate();
      const endDay = clippedEnd.getDate();
      const left = (startDay - 1) * dayW;
      const width = Math.max(dayW - 4, (endDay - startDay + 1) * dayW - 4);
      const color = CATEGORY_COLORS[task.category] || '#6B7280';
      const blocked = TaskStore.isBlocked(this.mode, task);
      const dep = task.dependsOn ? TaskStore.getById(this.mode, task.dependsOn) : null;

      return `
        <div class="gantt-row">
          <div class="gantt-row-label" data-id="${task.id}">
            <div class="gantt-row-title">${escapeHTML(task.title)}</div>
            <div class="gantt-row-sub">${escapeHTML(categoryLabel(this.mode, task.category))}${dep ? ` · depends on ${escapeHTML(dep.title)}` : ''}</div>
          </div>
          <div class="gantt-row-track" style="width:${monthLen * dayW}px;">
            ${todayLinePx !== null ? `<div class="gantt-today-line" style="left:${todayLinePx}px;"></div>` : ''}
            <div class="gantt-bar ${blocked ? 'is-blocked' : ''} ${task.status === 'done' ? 'is-done' : ''}"
                 data-id="${task.id}"
                 style="left:${left}px;width:${width}px;background:${color}cc;color:#fff;"
                 title="${escapeHTML(task.title)} (${DateUtils.displayDate(DateUtils.toISO(start))} – ${DateUtils.displayDate(task.dueDate)})">
              ${blocked ? '<i class="ri-lock-line"></i>' : ''}${escapeHTML(task.title)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="gantt-wrap">
        <div class="gantt-scroll">
          <div class="gantt-header-row">
            <div class="gantt-label-col-header">Task</div>
            ${dayHeaderHTML}
          </div>
          ${rowsHTML}
        </div>
      </div>
    `;

    wrap.querySelectorAll('.gantt-bar, .gantt-row-label').forEach(el => {
      el.addEventListener('click', () => this._onOpenTask(el.dataset.id));
    });
  },

  _renderListView() {
    const wrap = document.getElementById('mainViewWrap');
    const tasks = TaskStore.all(this.mode);

    if (tasks.length === 0) {
      wrap.innerHTML = `
      <div class="list-view-wrap">
        <div class="list-empty">
          <i class="ri-inbox-line"></i>
          <p>No tasks in ${MODE_META[this.mode].label} yet.</p>
          <p class="list-empty-sub">Click the + button to add your first task.</p>
        </div>
      </div>`;
      return;
    }

    wrap.innerHTML = `
    <div class="list-view-wrap">
      <div class="list-table-wrap">
        <table class="list-table">
          <thead>
            <tr>
              <th class="list-th-title" data-sort="title">Task <i class="ri-arrow-up-down-line"></i></th>
              <th class="list-th-category" data-sort="category">Category</th>
              <th class="list-th-priority" data-sort="priority">Priority</th>
              <th class="list-th-status" data-sort="status">Status</th>
              <th class="list-th-due" data-sort="due">Due Date <i class="ri-arrow-up-down-line"></i></th>
              <th class="list-th-depends">Depends On</th>
              <th class="list-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody id="listTableBody">
          </tbody>
        </table>
      </div>

      <div class="list-footer">
        <span class="list-count" id="listCount">0 tasks</span>
        <span class="list-count-done" id="listCountDone">0 completed</span>
        <span class="list-count-overdue" id="listCountOverdue">0 overdue</span>
      </div>
    </div>
  `;

    // --- Render table rows ---
    const renderRows = (filteredTasks) => {
      const tbody = document.getElementById('listTableBody');

      if (filteredTasks.length === 0) {
        tbody.innerHTML = `
        <tr class="list-empty-row">
          <td colspan="7">
            <div class="list-empty-state">
              <i class="ri-search-line"></i>
              <p>No tasks match your filters</p>
              <button class="filter-clear-btn" id="listClearFiltersEmpty">Clear filters</button>
            </div>
          </td>
        </tr>
      `;
        const clearBtn = document.getElementById('listClearFiltersEmpty');
        if (clearBtn) clearBtn.addEventListener('click', () => this._clearListFilters());
        return;
      }

      const rows = filteredTasks.map(task => {
        const blocked = TaskStore.isBlocked(this.mode, task);
        const overdue = DateUtils.isOverdue(task.dueDate, task.status);
        const color = CATEGORY_COLORS[task.category] || '#6B7280';
        const statusLabel = STATUS_META[task.status].label;
        const priorityLabel = PRIORITY_META[task.priority].label;
        const dep = task.dependsOn ? TaskStore.getById(this.mode, task.dependsOn) : null;

        let statusClass = 'list-status-todo';
        if (task.status === 'inprogress') statusClass = 'list-status-progress';
        if (task.status === 'done') statusClass = 'list-status-done';
        if (blocked) statusClass = 'list-status-blocked';

        let dueClass = '';
        let dueRelative = '';
        if (task.dueDate) {
          dueRelative = DateUtils.relativeLabel(task.dueDate, task.status);
          if (overdue && task.status !== 'done') {
            dueClass = 'list-due-overdue';
          } else if (DateUtils.isToday(task.dueDate) && task.status !== 'done') {
            dueClass = 'list-due-today';
          }
        }

        return `
        <tr class="list-row" data-id="${task.id}">
          <td class="list-cell-title">
            <div class="list-title-wrap">
              <span class="list-status-dot ${statusClass}"></span>
              <span class="list-title-text ${task.status === 'done' ? 'list-title-done' : ''}">
                ${escapeHTML(task.title)}
              </span>
              ${blocked ? '<span class="list-badge-blocked"><i class="ri-lock-line"></i> Blocked</span>' : ''}
            </div>
          </td>
          <td class="list-cell-category">
            <span class="category-tag" style="background:${color}22;color:${color};border-color:${color}55;">
              ${escapeHTML(categoryLabel(this.mode, task.category))}
            </span>
          </td>
          <td class="list-cell-priority">
            <span class="priority-dot ${PRIORITY_META[task.priority].cls}"></span>
            ${priorityLabel}
          </td>
          <td class="list-cell-status">
            <span class="list-status-label ${statusClass}">${statusLabel}</span>
          </td>
          <td class="list-cell-due ${dueClass}">
            ${task.dueDate ? escapeHTML(DateUtils.displayDate(task.dueDate)) : '—'}
            ${task.dueDate ? `<span class="list-due-relative">${escapeHTML(dueRelative)}</span>` : ''}
          </td>
          <td class="list-cell-depends">
            ${dep ? `<span class="list-dep-link" data-id="${dep.id}">${escapeHTML(dep.title)}</span>` : '—'}
          </td>
          <td class="list-cell-actions">
            <button class="list-action-btn list-action-view" title="View Task">
              <i class="ri-eye-line"></i>
            </button>
            <button class="list-action-btn list-action-edit" title="Edit Task">
              <i class="ri-pencil-line"></i>
            </button>
          </td>
        </tr>
      `;
      }).join('');

      tbody.innerHTML = rows;

      // --- Row click handlers ---
      tbody.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', (e) => {
          // Ignore if clicking action buttons
          if (e.target.closest('.list-action-btn')) return;
          if (e.target.closest('.list-dep-link')) return;
          this._onOpenTask(row.dataset.id);
        });
      });

      // --- Action button handlers ---
      tbody.querySelectorAll('.list-action-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = btn.closest('.list-row');
          this._onOpenTask(row.dataset.id);
        });
      });

      tbody.querySelectorAll('.list-action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = btn.closest('.list-row');
          ModalHandler.close();
          FormHandler.openEdit(row.dataset.id);
        });
      });

      // --- Dependency link handlers ---
      tbody.querySelectorAll('.list-dep-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.stopPropagation();
          this._onOpenTask(link.dataset.id);
        });
      });

      // Update counts
      const total = tasks.length;
      const done = tasks.filter(t => t.status === 'done').length;
      const overdueCount = tasks.filter(t => DateUtils.isOverdue(t.dueDate, t.status) && t.status !== 'done').length;
      document.getElementById('listCount').textContent = `${filteredTasks.length} of ${total} tasks`;
      document.getElementById('listCountDone').textContent = `${done} completed`;
      document.getElementById('listCountOverdue').textContent = `${overdueCount} overdue`;
    };

    const displayTasks = [...tasks];

    displayTasks.sort((a, b) => {
      const aOverdue = DateUtils.isOverdue(a.dueDate, a.status);
      const bOverdue = DateUtils.isOverdue(b.dueDate, b.status);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    renderRows(displayTasks);

    // --- Sort functionality (client-side sorting) ---
    let sortField = 'due';
    let sortAsc = true;

    document.querySelectorAll('.list-table thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (sortField === field) {
          sortAsc = !sortAsc;
        } else {
          sortField = field;
          sortAsc = true;
        }

        // Update header icons
        document.querySelectorAll('.list-table thead th i').forEach(icon => {
          icon.className = 'ri-arrow-up-down-line';
        });
        const icon = th.querySelector('i');
        icon.className = sortAsc ? 'ri-arrow-up-line' : 'ri-arrow-down-line';

        const tbody = document.getElementById('listTableBody');
        const rows = Array.from(tbody.querySelectorAll('.list-row'));

        rows.sort((a, b) => {
          let aVal, bVal;
          switch (field) {
            case 'title':
              aVal = a.querySelector('.list-title-text').textContent.toLowerCase();
              bVal = b.querySelector('.list-title-text').textContent.toLowerCase();
              break;
            case 'category':
              aVal = a.querySelector('.category-tag')?.textContent || '';
              bVal = b.querySelector('.category-tag')?.textContent || '';
              break;
            case 'priority':
              const pMap = { high: 3, medium: 2, low: 1 };
              aVal = pMap[a.dataset.priority] || 0;
              bVal = pMap[b.dataset.priority] || 0;
              break;
            case 'status':
              const sMap = { todo: 0, inprogress: 1, done: 2 };
              aVal = sMap[a.querySelector('.list-status-label')?.textContent?.toLowerCase()] || 0;
              bVal = sMap[b.querySelector('.list-status-label')?.textContent?.toLowerCase()] || 0;
              break;
            case 'due':
              const aDate = a.querySelector('.list-cell-due')?.textContent?.trim() || '9999-99-99';
              const bDate = b.querySelector('.list-cell-due')?.textContent?.trim() || '9999-99-99';
              aVal = aDate;
              bVal = bDate;
              break;
            default:
              aVal = '';
              bVal = '';
          }
          if (aVal < bVal) return sortAsc ? -1 : 1;
          if (aVal > bVal) return sortAsc ? 1 : -1;
          return 0;
        });

        rows.forEach(row => tbody.appendChild(row));
      });
    });
  },

  _clearListFilters() {
    // Filter UI has been removed. This method is kept as a no-op to avoid
    // accidental task deletion or state resets when older code paths still call it.
  },

  _renderQuickAdd() {
    const quickAddBtns = document.querySelectorAll('.quick-add-btn');
    quickAddBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;

        switch(type) {
          case 'task':
            FormHandler.open();
            break;
          case 'project':
            // Pre-fill with project category
            FormHandler.open();
            // Set category to project if available in current mode
            const categorySelect = document.getElementById('category');
            const projectOption = Array.from(categorySelect.options).find(
              opt => opt.value === 'project'
            );
            if (projectOption) {
              categorySelect.value = 'project';
              categorySelect.dispatchEvent(new Event('change'));
            }
            break;
          case 'bug':
            // Pre-fill as a high-priority task with "bug" in title
            FormHandler.open();
            const titleField = document.getElementById('title');
            if (titleField) {
              titleField.value = '🐛 Bug: ';
              titleField.focus();
              titleField.setSelectionRange(7, 7);
            }
            // Set high priority
            const prioritySelect = document.getElementById('priority');
            if (prioritySelect) {
              prioritySelect.value = 'high';
              prioritySelect.dispatchEvent(new Event('change'));
            }
            break;
        }
      });
    });
  },

  render() {
    document.getElementById('currentDateLabel').textContent = this.periodLabel();
    this._renderModeSwitcher();
    const statsRow = document.getElementById('statsRow');
    if (this.view === 'board') {
      statsRow.style.display = '';
      this._renderStats();
    } else {
      statsRow.style.display = 'none';
    }
    if (this.view === 'calendar') {
      this._renderCalendar();
    } else if (this.view === 'gantt') {
      this._renderGantt();
    } else if (this.view === 'list') {
      this._renderListView();
    } else {
      this._renderBoard();
    }
    this._renderUpcoming();
  }
}; 

/* ============================================================
   8b. SIDEBAR (expand/collapse left nav)
   ============================================================ */

const SIDENAV_KEY = 'momentum_sidenav_collapsed';

const Sidebar = {
  init(onNavigate) {
    this._onNavigate = onNavigate;
    const nav = document.getElementById('sideNav');

    const applyCollapsed = (collapsed) => {
      nav.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('nav-collapsed', collapsed);
      localStorage.setItem(SIDENAV_KEY, collapsed ? '1' : '0');
    };

    applyCollapsed(localStorage.getItem(SIDENAV_KEY) === '1');

    const toggle = () => applyCollapsed(!nav.classList.contains('collapsed'));

    // Toggle lives both inside the sidebar (desktop/tablet) and as a
    // floating button outside it (mobile) so collapsing the sidebar
    // can never remove the only way to bring it back.
    document.getElementById('sideNavToggle').addEventListener('click', toggle);
    document.getElementById('mobileNavToggle').addEventListener('click', toggle);

    document.querySelectorAll('.side-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.side-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._onNavigate(btn.dataset.view);
        // On mobile the sidebar is an overlay; close it after picking a view
        // so it doesn't sit on top of the content the user just asked for.
        if (window.innerWidth <= 900) applyCollapsed(true);
      });
    });
  },
};

/* ============================================================
   9. MODAL HANDLER
   ============================================================ */

const ModalHandler = {
  _currentId: null,

  init(onEdit, onDelete) {
    this._onEdit = onEdit;
    this._onDelete = onDelete;
    document.getElementById('modalCloseBtn').addEventListener('click', () => this.close());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') this.close();
    });
    document.getElementById('modalEditBtn').addEventListener('click', () => {
      if (this._currentId) this._onEdit(this._currentId);
    });
    document.getElementById('modalDeleteBtn').addEventListener('click', () => {
      if (this._currentId) this._onDelete(this._currentId);
    });
  },

  open(id) {
    const task = TaskStore.getById(Dashboard.mode, id);
    if (!task) return;
    this._currentId = id;

    document.getElementById('modalName').textContent = task.title;
    document.getElementById('modalTypeBadge').innerHTML = categoryTagHTML(Dashboard.mode, task.category);

    const blocked = TaskStore.isBlocked(Dashboard.mode, task);
    const dep = task.dependsOn ? TaskStore.getById(Dashboard.mode, task.dependsOn) : null;

    const fields = [
      ['Status', STATUS_META[task.status].label],
      ['Priority', PRIORITY_META[task.priority].label],
      ['Start Date', DateUtils.displayDate(TaskStore.effectiveStart(task))],
      ['Due Date', DateUtils.displayDate(task.dueDate)],
      ['Time Left', DateUtils.relativeLabel(task.dueDate, task.status)],
    ];

    let html = fields.map(([label, value]) => `
      <div class="modal-field">
        <div class="modal-field-label">${escapeHTML(label)}</div>
        <div class="modal-field-value">${escapeHTML(value)}</div>
      </div>
    `).join('');

    html += `
      <div class="modal-field full">
        <div class="modal-field-label">Depends On</div>
        <div class="modal-field-value">
          ${dep
        ? `${escapeHTML(dep.title)} ${blocked ? '<span class="task-lock"><i class="ri-lock-line"></i> Not done yet</span>' : '<span style="color:var(--success);font-weight:600;">✓ Done</span>'}`
        : 'Nothing — this task is free to start.'}
        </div>
      </div>
    `;

    if (task.notes) {
      html += `
        <div class="modal-field full">
          <div class="modal-field-label">Notes</div>
          <div class="modal-field-value">${escapeHTML(task.notes)}</div>
        </div>
      `;
    }

    document.getElementById('modalGrid').innerHTML = html;

    document.getElementById('modalOverlay').classList.add('visible');
  },

  close() {
    document.getElementById('modalOverlay').classList.remove('visible');
    this._currentId = null;
  },
};

/* ============================================================
   10. FORM HANDLER
   ============================================================ */

const FormHandler = {
  _isOpen: false,

  init(onSaved) {
    this._onSaved = onSaved;
    document.getElementById('fabBtn').addEventListener('click', () => this.open());
    document.getElementById('closeDrawerBtn').addEventListener('click', () => this.close());
    document.getElementById('cancelFormBtn').addEventListener('click', () => this.close());
    document.getElementById('drawerOverlay').addEventListener('click', () => this.close());
    document.getElementById('taskForm').addEventListener('submit', (e) => this._onSubmit(e));
    document.getElementById('dependsOn').addEventListener('change', () => this._renderDependencyDisplay());
    document.getElementById('status').addEventListener('change', () => this._renderDependencyDisplay());
  },

  _populateCategoryOptions(selected) {
    const sel = document.getElementById('category');
    sel.innerHTML = '<option value="">Select category…</option>' +
      CATEGORIES[Dashboard.mode].map(c =>
        `<option value="${c.value}" ${c.value === selected ? 'selected' : ''}>${escapeHTML(c.label)}</option>`
      ).join('');
  },

  _populateDependsOnOptions(excludeId, selected) {
    const sel = document.getElementById('dependsOn');
    const options = TaskStore.all(Dashboard.mode).filter(t => t.id !== excludeId);
    sel.innerHTML = '<option value="">None</option>' +
      options.map(t =>
        `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${escapeHTML(t.title)} (${STATUS_META[t.status].label})</option>`
      ).join('');
  },

  _renderDependencyDisplay() {
    const depId = document.getElementById('dependsOn').value;
    const display = document.getElementById('dependencyDisplay');
    if (!depId) {
      display.classList.remove('visible', 'blocked-warning');
      return;
    }
    const dep = TaskStore.getById(Dashboard.mode, depId);
    if (!dep) { display.classList.remove('visible'); return; }
    display.classList.add('visible');
    if (dep.status !== 'done') {
      display.classList.add('blocked-warning');
      display.textContent = `This task will show as Blocked until "${dep.title}" is marked Done.`;
    } else {
      display.classList.remove('blocked-warning');
      display.textContent = `"${dep.title}" is already done — this task is free to start.`;
    }
  },

  open() {
    document.getElementById('taskForm').reset();
    document.getElementById('editId').value = '';
    document.getElementById('drawerTitle').textContent = `Add ${MODE_META[Dashboard.mode].label.replace(' Mode', '')} Task`;
    document.getElementById('submitBtn').textContent = 'Save Task';
    this._populateCategoryOptions('');
    this._populateDependsOnOptions('', '');
    document.getElementById('startDate').value = DateUtils.todayISO();
    document.getElementById('dueDate').value = DateUtils.todayISO();
    this._clearErrors();
    this._renderDependencyDisplay();
    this._show();
  },

  openEdit(id) {
    const task = TaskStore.getById(Dashboard.mode, id);
    if (!task) return;
    document.getElementById('taskForm').reset();
    document.getElementById('editId').value = task.id;
    document.getElementById('drawerTitle').textContent = 'Edit Task';
    document.getElementById('submitBtn').textContent = 'Update Task';

    this._populateCategoryOptions(task.category);
    this._populateDependsOnOptions(task.id, task.dependsOn);

    document.getElementById('title').value = task.title;
    document.getElementById('priority').value = task.priority;
    document.getElementById('status').value = task.status;
    document.getElementById('startDate').value = TaskStore.effectiveStart(task);
    document.getElementById('dueDate').value = task.dueDate;
    document.getElementById('dependsOn').value = task.dependsOn || '';
    document.getElementById('notes').value = task.notes || '';

    this._clearErrors();
    this._renderDependencyDisplay();
    this._show();
  },

  _show() {
    this._isOpen = true;
    document.getElementById('formDrawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('visible');
    setTimeout(() => document.getElementById('title').focus(), 250);
  },

  close() {
    this._isOpen = false;
    document.getElementById('formDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('visible');
  },

  _clearErrors() {
    ['titleError', 'categoryError', 'startDateError', 'dueDateError', 'dependsOnError'].forEach(id => {
      document.getElementById(id).textContent = '';
    });
    ['title', 'category', 'startDate', 'dueDate', 'dependsOn'].forEach(id => {
      document.getElementById(id).classList.remove('error');
    });
  },

  _validate() {
    let valid = true;
    const setErr = (fieldId, errId, msg) => {
      document.getElementById(errId).textContent = msg;
      document.getElementById(fieldId).classList.toggle('error', !!msg);
      if (msg) valid = false;
    };

    const title = document.getElementById('title').value.trim();
    setErr('title', 'titleError', title.length < 2 ? 'Please enter a task title.' : '');

    const category = document.getElementById('category').value;
    setErr('category', 'categoryError', !category ? 'Please select a category.' : '');

    const dueDate = document.getElementById('dueDate').value;
    setErr('dueDate', 'dueDateError', !dueDate ? 'Please choose a due date.' : '');

    const startDate = document.getElementById('startDate').value;
    if (startDate && dueDate && startDate > dueDate) {
      setErr('startDate', 'startDateError', 'Start date must be on or before the due date.');
    } else {
      setErr('startDate', 'startDateError', '');
    }

    return valid;
  },

  _onSubmit(e) {
    e.preventDefault();
    if (!this._validate()) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';

    const data = {
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value,
      priority: document.getElementById('priority').value,
      status: document.getElementById('status').value,
      startDate: document.getElementById('startDate').value || document.getElementById('dueDate').value,
      dueDate: document.getElementById('dueDate').value,
      dependsOn: document.getElementById('dependsOn').value,
      notes: document.getElementById('notes').value.trim(),
    };

    setTimeout(() => {
      try {
        const editId = document.getElementById('editId').value;
        let record;
        if (editId) {
          record = TaskStore.update(Dashboard.mode, editId, data);
          Toast.show('Task updated.', 'success');
        } else {
          record = TaskStore.create(Dashboard.mode, data);
          Toast.show(`Task "${record.title}" added.`, 'success');
        }
        btn.disabled = false;
        btn.textContent = originalLabel;
        this.close();
        if (this._onSaved) this._onSaved();
        AlertSystem.checkAll();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalLabel;
        Toast.show(err.message, 'error');
      }
    }, 350);
  },
};

/* ============================================================
   11. APP BOOTSTRAP
   ============================================================ */

const App = {
  init() {
    TaskStore.init();
    AlertSystem.init();

    Dashboard.init(id => ModalHandler.open(id));
    Sidebar.init(view => { Dashboard.setView(view); this.refresh(); });
    ModalHandler.init(
      id => { ModalHandler.close(); FormHandler.openEdit(id); },
      id => this._deleteTask(id)
    );
    FormHandler.init(() => this.refresh());

    document.getElementById('prevBtn').addEventListener('click', () => {
      if (Dashboard.view === 'calendar' || Dashboard.view === 'gantt') Dashboard.calPrev();
      else Dashboard.cycleMode(-1);
      this.refresh();
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      if (Dashboard.view === 'calendar' || Dashboard.view === 'gantt') Dashboard.calNext();
      else Dashboard.cycleMode(1);
      this.refresh();
    });
    document.getElementById('todayBtn').addEventListener('click', (e) => {
      if (Dashboard.view === 'calendar' || Dashboard.view === 'gantt') {
        Dashboard.calToday();
      } else {
        Dashboard.dueTodayOnly = !Dashboard.dueTodayOnly;
        e.target.classList.toggle('active-filter', Dashboard.dueTodayOnly);
      }
      this.refresh();
    });

    document.getElementById('backupBtn').addEventListener('click', () => {
      const blob = BackupManager.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `momentum-backup-${DateUtils.todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('Data backed up successfully', 'success');
    });

    document.getElementById('restoreBtn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        if (!e.target.files[0]) return;
        try {
          await BackupManager.importData(e.target.files[0]);
          Toast.show('Data restored successfully', 'success');
          this.refresh();
          AlertSystem.checkAll();
        } catch (err) {
          Toast.show('Restore failed: ' + err.message, 'error');
        }
      };
      input.click();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ModalHandler.close();
        FormHandler.close();
        AlertSystem.close();
      }
      if (e.key === 'n' && !FormHandler._isOpen && !e.ctrlKey && !e.metaKey) {
        FormHandler.open();
      }
    });

    this._recoverSession();

    setInterval(() => {
      const anyTasks = MODES.some(m => TaskStore.all(m).length > 0);
      if (anyTasks) BackupManager.createBackup();
    }, 300000);

    this.refresh();
    AlertSystem.checkAll();
  },

  _recoverSession() {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (sessionData) {
      try {
        const data = JSON.parse(sessionData);
        if (data.tasks) {
          TaskStore._data = data.tasks;
          TaskStore._save();
          Toast.show('Recovered data from previous session', 'warning');
        }
        sessionStorage.removeItem(SESSION_KEY);
      } catch (e) { /* ignore */ }
    }
    window.addEventListener('beforeunload', () => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        tasks: TaskStore._data,
        timestamp: new Date().toISOString(),
      }));
    });
  },

  refresh() {
    Dashboard.render();
  },

  _deleteTask(id) {
    const task = TaskStore.getById(Dashboard.mode, id);
    if (!task) return;
    const confirmed = window.confirm(
      `Delete "${task.title}"?\n\nThis cannot be undone. Any tasks depending on it will be unblocked.`
    );
    if (!confirmed) return;
    TaskStore.delete(Dashboard.mode, id);
    ModalHandler.close();
    Toast.show(`"${task.title}" deleted.`, 'error');
    this.refresh();
    AlertSystem.checkAll();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());