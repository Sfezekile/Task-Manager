'use strict';

/* ============================================================
   MODAL HANDLER — depends on: constants.js, date-utils.js, store.js, helpers.js, views/dashboard-core.js (Dashboard.mode)
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
