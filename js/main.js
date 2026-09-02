'use strict';

/* ============================================================
   APP BOOTSTRAP — depends on: everything else, loaded last
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
