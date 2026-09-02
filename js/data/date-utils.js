'use strict';

/* ============================================================
   DATE UTILITIES — depends on: constants.js
   ============================================================ */

/* ============================================================
   2. DATE UTILITIES
   ============================================================ */

const DateUtils = {
  parse(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
  today() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  },
  todayISO() { return this.toISO(this.today()); },
  addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  },
  daysBetween(start, end) {
    const ms = end.getTime() - start.getTime();
    return Math.round(ms / 86400000);
  },
  displayDate(iso) {
    if (!iso) return '—';
    const d = this.parse(iso);
    return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  },
  isOverdue(iso, status) {
    if (!iso || status === 'done') return false;
    return this.parse(iso) < this.today();
  },
  isToday(iso) {
    if (!iso) return false;
    return iso === this.todayISO();
  },
  isWithinDays(iso, n) {
    if (!iso) return false;
    const diff = this.daysBetween(this.today(), this.parse(iso));
    return diff >= 0 && diff <= n;
  },
  startOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  },
  /** All dates to render for a month calendar grid (incl. leading/trailing) */
  monthGridDates(year, month) {
    const first = new Date(year, month, 1);
    const start = this.startOfWeek(first);
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(this.addDays(start, i));
    return cells;
  },
  relativeLabel(iso, status) {
    if (!iso) return 'No due date';
    const diff = this.daysBetween(this.today(), this.parse(iso));
    if (status !== 'done') {
      if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
      if (diff === 0) return 'Due today';
      if (diff === 1) return 'Due tomorrow';
    }
    return this.displayDate(iso);
  },
};

