'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */

/* ============================================================
   1. CONSTANTS
   ============================================================ */

const STORAGE_KEY = 'momentum_tasks_v1';
const BACKUP_KEY = 'momentum_backups_v1';
const SESSION_KEY = 'momentum_session_data';
const LASTMODE_KEY = 'momentum_last_mode';

const MODES = ['student', 'personal', 'work'];

const MODE_META = {
  student: { label: 'Student Mode', icon: 'ri-graduation-cap-line' },
  personal: { label: 'Personal Mode', icon: 'ri-flask-line' },
  work: { label: 'Work Mode', icon: 'ri-briefcase-line' },
};

const CATEGORIES = {
  student: [
    { value: 'assignment', label: 'Assignment' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'exam', label: 'Exam' },
    { value: 'reading', label: 'Reading' },
    { value: 'project', label: 'Project' },
  ],
  personal: [
    { value: 'project', label: 'Project' },
    { value: 'case-study', label: 'Case Study' },
    { value: 'goal', label: 'Goal' },
    { value: 'errand', label: 'Personal Task' },
  ],
  work: [
    { value: 'commitment', label: 'Commitment' },
    { value: 'volunteer', label: 'Volunteer Work' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'deliverable', label: 'Deliverable' },
  ],
};

// Deterministic color per category (shared across modes for consistency)
const CATEGORY_COLORS = {
  assignment: '#2558D8',
  quiz: '#9333EA',
  exam: '#DC2626',
  reading: '#0891B2',
  project: '#16A34A',
  'case-study': '#D97706',
  goal: '#DB2777',
  errand: '#65A30D',
  commitment: '#7C3AED',
  volunteer: '#0EA472',
  meeting: '#B45309',
  deliverable: '#1D4ED8',
};

const STATUS_META = {
  todo: { label: 'To Do' },
  inprogress: { label: 'In Progress' },
  done: { label: 'Done' },
};

const PRIORITY_META = {
  high: { label: 'High', cls: 'priority-high' },
  medium: { label: 'Medium', cls: 'priority-medium' },
  low: { label: 'Low', cls: 'priority-low' },
};

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

