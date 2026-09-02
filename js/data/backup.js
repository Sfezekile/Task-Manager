'use strict';

/* ============================================================
   BACKUP MANAGER — depends on: constants.js, data/store.js
   ============================================================ */

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

