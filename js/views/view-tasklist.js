'use strict';

/* ============================================================
   VIEW — TASK LIST (sortable table)
   depends on: constants.js, date-utils.js, store.js, helpers.js,
               ui/modal.js, ui/form.js, views/dashboard-core.js (must load first)
   ============================================================ */

Object.assign(Dashboard, {

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

});
