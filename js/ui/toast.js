'use strict';

/* ============================================================
   TOAST — no dependencies
   ============================================================ */

/* ============================================================
   5. TOAST
   ============================================================ */

const Toast = {
  show(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  },
};

