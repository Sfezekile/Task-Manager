'use strict';

/* ============================================================
   VIEW — KANBAN BOARD
   depends on: constants.js, date-utils.js, store.js, helpers.js,
               views/dashboard-core.js (must load first)
   ============================================================ */

Object.assign(Dashboard, {

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

});
