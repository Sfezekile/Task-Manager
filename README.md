# Momentum — split by layer

`app.js` and `style.css` are now split into layered folders. No behavior
changed — every line of the originals was moved, not rewritten (verified
byte-for-byte for CSS; every top-level JS identifier confirmed to exist in
exactly one new file, and the full JS load order was smoke-tested).

## JS (`js/`) — plain scripts, shared global scope, order matters

```
js/data/        constants, date-utils, store, backup      (state layer)
js/ui/          toast, alerts, sidebar, modal, form        (UI components)
js/views/       dashboard-core + view-board/calendar/gantt/tasklist
js/helpers.js   escapeHTML / categoryLabel / categoryTagHTML
js/main.js      App bootstrap — loaded last
```

These are **not** ES modules — like the original single file, everything
still shares one global scope. `dashboard-core.js` defines the `Dashboard`
object; each `views/view-*.js` file adds its render method with
`Object.assign(Dashboard, { ... })`, so `dashboard-core.js` must load
*before* the four `view-*.js` files, which must load before `main.js`.
`index.html` already lists the `<script>` tags in the right order.

## CSS (`css/`) — plain stylesheets, order doesn't matter (no overlapping specificity issues)

```
css/base/         tokens, layout, shared states (tags/FAB/empty/spinner), base responsive
css/components/   sidebar, alerts, legend/upcoming panel, form drawer, modal, toast
css/views/         dashboard-shell (mode switcher + stats), board, calendar, gantt, tasklist
```

## Adding a new view or component later

- New UI component (e.g. a settings panel) → `js/ui/settings.js` +
  `css/components/settings.css`, then add both tags to `index.html`.
- New dashboard view (e.g. a timeline view) → `js/views/view-timeline.js`
  using the same `Object.assign(Dashboard, {...})` pattern, loaded after
  `dashboard-core.js`, plus `css/views/timeline.css`.
