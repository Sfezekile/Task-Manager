'use strict';

/* ============================================================
   FORM HANDLER — depends on: constants.js, date-utils.js, store.js, ui/toast.js, ui/alerts.js, views/dashboard-core.js
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
