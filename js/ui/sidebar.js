'use strict';

/* ============================================================
   SIDEBAR (expand/collapse left nav) — no dependencies
   ============================================================ */

const SIDENAV_KEY = 'momentum_sidenav_collapsed';

const Sidebar = {
  init(onNavigate) {
    this._onNavigate = onNavigate;
    const nav = document.getElementById('sideNav');

    const applyCollapsed = (collapsed) => {
      nav.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('nav-collapsed', collapsed);
      localStorage.setItem(SIDENAV_KEY, collapsed ? '1' : '0');
    };

    applyCollapsed(localStorage.getItem(SIDENAV_KEY) === '1');

    const toggle = () => applyCollapsed(!nav.classList.contains('collapsed'));

    // Toggle lives both inside the sidebar (desktop/tablet) and as a
    // floating button outside it (mobile) so collapsing the sidebar
    // can never remove the only way to bring it back.
    document.getElementById('sideNavToggle').addEventListener('click', toggle);
    document.getElementById('mobileNavToggle').addEventListener('click', toggle);

    document.querySelectorAll('.side-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.side-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._onNavigate(btn.dataset.view);
        // On mobile the sidebar is an overlay; close it after picking a view
        // so it doesn't sit on top of the content the user just asked for.
        if (window.innerWidth <= 900) applyCollapsed(true);
      });
    });
  },
};
