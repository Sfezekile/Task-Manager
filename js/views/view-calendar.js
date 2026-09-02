'use strict';

/* ============================================================
   VIEW — CALENDAR (month grid)
   depends on: constants.js, date-utils.js, store.js, helpers.js,
               views/dashboard-core.js (must load first)
   ============================================================ */

Object.assign(Dashboard, {

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

});
