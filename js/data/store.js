'use strict';

/* ============================================================
   TASK STORE — depends on: constants.js, ui/toast.js (recovery), data/backup.js (recovery)
   ============================================================ */

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

