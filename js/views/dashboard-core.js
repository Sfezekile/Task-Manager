'use strict';

/* ============================================================
   DASHBOARD SHELL — mode/view state, stats, upcoming panel
   depends on: constants.js, date-utils.js, store.js, helpers.js
   extended by: view-board.js, view-calendar.js, view-gantt.js, view-tasklist.js
   (those files each call Object.assign(Dashboard, {...}) to add their
   render method, so they must load AFTER this file and BEFORE main.js)
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

  _matchesFilter(task) {
    if (this.dueTodayOnly && !DateUtils.isToday(task.dueDate)) return false;
    if (this.statusFilter === 'all') return true;
    if (this.statusFilter === 'blocked') return TaskStore.isBlocked(this.mode, task);
    return task.status === this.statusFilter;
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

  _renderQuickAdd() {
    const quickAddBtns = document.querySelectorAll('.quick-add-btn');
    quickAddBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;

        switch (type) {
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

  // _renderBoard (view-board.js), _renderCalendar (view-calendar.js),
  // _renderGantt (view-gantt.js) and _renderListView (view-tasklist.js)
  // are attached to this object via Object.assign in their own files.
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
