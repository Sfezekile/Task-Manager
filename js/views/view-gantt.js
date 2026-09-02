'use strict';

/* ============================================================
   VIEW — GANTT CHART
   depends on: constants.js, date-utils.js, store.js, helpers.js,
               views/dashboard-core.js (must load first)
   ============================================================ */

Object.assign(Dashboard, {

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

});
