# CLAUDE.md

Front-end scripts for a MindTouch (LibreTexts-style) site, served to the site from
this GitHub repo through jsDelivr. There is no server code here.

## Layout

- `authorAutoComp.js` — standalone author autocomplete for MindTouch's own
  `#live-tag-authorname-select`. Plain JS, no build. Leave it as is; new work goes in
  `pagesetting/`.
- `index.html` — local test page for `authorAutoComp.js`.
- `pagesetting/` — custom Page settings panel that replaces MindTouch's `#mt-summary`
  in the editor. TypeScript, bundled with esbuild.
  - `pagesetting.json` — **what the panel shows**: `groups` (sections, order, open,
    wide), `fields` (order, labels, prefixes, options, type, group, flags),
    `roleViews`/`defaultView`, `licenses` (with versions), `thumbnailWidths`. Edit this
    to add/remove/reorder/change settings — no code change needed.
  - `src/` — sources. `index.ts` mounts the panel; `config.ts` has the types, fixed
    constants and the live settings bindings (`FIELDS`, `GROUPS`, …) filled from
    `pagesetting.json`; `settings.ts` loads and validates the JSON at runtime;
    `api.ts` has every MindTouch API call; `fields/` has one module per panel section;
    `subpages.ts` asks to apply a field change to all subpages.
  - `dist/pagesetting.min.js` (+ `.map`), `dist/pagesetting.min.css` and
    `dist/pagesetting.json` — build output. **Committed**, because jsDelivr serves it.
  - `scripts/dev.mjs` — the dev server behind `npm run dev`.
  - `pagesetting.css` — panel styles source (minified into `dist/` by the build).
  - `loader.html` — the only code pasted into the site (Custom HTML): calls the
    DekiScript template and loads the `dist/` files only once `#mt-summary` appears.
  - `PageSettings.dekiscript` — code for the `Template:Custom/Views/PageSettings`
    template; writes page data as JSON into a hidden `#cps-data` element.
  - `demo.html` — local test page with a fake `/@api/deki` (via a `fetch` override).

## Commands (run in `pagesetting/`)

- `npm install` — once, installs esbuild and typescript.
- `npm run build` — minified, ASCII-only `dist/pagesetting.min.js` (IIFE, ES2019,
  with source map), `dist/pagesetting.min.css`, and a checked copy of
  `pagesetting.json` as `dist/pagesetting.json` (build fails if it isn't valid JSON).
- `npm run watch` — rebuild the JS on change.
- `npm run dev` — local dev server at `http://localhost:8000` (unminified
  `pagesetting.js` / `pagesetting.css` rebuilt on save, plus `pagesetting.json` copied
  on save when valid; output in git-ignored `.dev/`).
  The site's loader uses it only in a browser where `localStorage.cpsDev = 1` is set
  (falls back to the released files if the server isn't running); CSS updates live,
  JS after a reload. Lets you try changes on the dev site without pushing.
- `npm run dev:sandbox` — same, listening on `0.0.0.0` for a CodeSandbox Devbox;
  `.codesandbox/tasks.json` installs and starts it (preview port 8000). Point the
  loader at it with `localStorage.cpsDev = 'https://<devbox>-8000.csb.app/'`.
- `npm run typecheck` — `tsc --noEmit`.

Always run `npm run typecheck && npm run build` after editing `src/` or the CSS, and
commit the updated `dist/` files together with the source change.

## Deploying

Don't paste the bundle into MindTouch templates (it would ship in every page's HTML
and pasted text gets mangled). The site has `loader.html` pasted once into Custom
HTML; it loads
`https://cdn.jsdelivr.net/gh/yasharghaemi/test-JS@<commit>/pagesetting/dist/pagesetting.min.{js,css}`
only in the editor. After pushing, tell the user the new commit hash to put in the
loader's `BASE`; a branch URL (`@main`) is cached by jsDelivr for up to ~12 h.

## Conventions and gotchas

- **No auth token in the page.** Never emit `user.authtoken` from DekiScript or put a
  token in HTML/JS. API calls go to same-origin `/@api/deki` with
  `credentials: 'same-origin'`, so the session cookie authenticates them.
- **DekiScript reads `-` as subtraction** in XML-literal attribute names, so no
  `data-*` attributes there. Emit data as JSON text (`json.emit(...)`) instead.
- **Tag conventions:** a field's value is the first page tag starting with its
  `prefix` (prefix includes the separator, e.g. `article:`, `author@`). Other tags
  matching the prefix stay in the free tag list. Author is stored as
  `author@<nameKey>`; older `author:` / `authorname:` tags are shown as plain tags.
- **Foldable sections** come from `groups` in `pagesetting.json` (`<details class="cps-group">`,
  closed at first; header shows a count or the chosen values). A field joins one via
  `group: '<id>'`.
- **License** section: one `type: 'license'` field (`fields/license.ts`) that owns two
  tags, `license:<key>` and `licenseversion:<key>` (e.g. `license:ccbysa`,
  `licenseversion:40`). `licenses` in `pagesetting.json` (from the site's own list) defines
  each license and the versions it allows; the version dropdown only offers those, and
  changing the license keeps a still-valid version or picks the newest. Fields can own
  several tags: `FieldControl.tags()/committedTags()` return arrays and
  `fieldPrefixes(field)` lists every prefix a field owns.
- **Editor view:** DekiScript has no `user.role`, so the template reads the role from
  the user's API document: `xml.text(wiki.api(user.api), "//permissions.user/role")`,
  sent as `userRole` in `#cps-data`. `roleViews` in `pagesetting.json` maps role (lower
  case) to a view: `admin` → full; `editor` → everything except Article type
  (`hiddenForEditors`); `author` → only `forAuthors`
  fields — Stage (`stage:`), Show Page TOC (`showtoc:`), Autonumber Section Headings
  (`autonumheader:`) and License + version. Unlisted roles get `DEFAULT_VIEW`
  (full). Hidden parts are built but hidden, so their tags are still saved unchanged.
- **Layout:** thumbnail + summary, then section cards from `GROUPS` — Page type
  (Article type + listing display), Display & status (Stage, Show Page TOC,
  Autonumber, Override Autonumber), License, Attribution Manager, Publishing (Cover
  Page, OER program, Transcluded, Student Analytics), Print (columns, PrintOptions,
  Print CSS) — then a Tags card. Cards are an accordion (chosen over tabs: headers
  show each section's state at a glance) in a `.cps-groups` grid: `wide` cards span
  it, narrow ones pair up two-across on wide screens, so list narrow cards in pairs
  between wide ones. The header has Expand all / Collapse all; which cards are open
  is remembered per browser in localStorage (`OPEN_STATE_KEY`, best-effort). Site-defined settings (`stage:`, `showtoc:`, `autonumheader:`,
  `override:`, `coverpage:`, `program:`, `transcluded:`, `studentanalytics:`,
  `columns:`, `printoptions:`, `cssprint:`) copy the site's options; the ones the site
  marks `recursive` have `askApplyToSubpages: true`. A card hides itself when nothing in it is visible for the role. Field values for these come from the site's
  own settings, but Attribution and License keep this project's design (`role@key`
  tags, `LICENSES` with matching versions), not MindTouch's default panel.
- **Options from classifications:** select fields take their options and labels from
  the site's classifications, read from MindTouch's hidden panel (its
  `<select data-prefix="…">` elements, `classifications.ts`); the `options` in
  `FIELDS` are only the fallback when a prefix isn't found. Re-read whenever
  MindTouch changes its panel (it may fill it in late); current and committed values
  are kept. **Exceptions:** author fields (authors API) and License (`LICENSES`, with
  its per-license versions) never use classifications.
- **Thumbnail** follows the Article type via `thumbnailWidths` in `pagesetting.json`:
  Book or Unit (`article:topic-category`) 500px wide, Chapter (`article:topic-guide`)
  250px; other types have no thumbnail (field hidden unless an old one is left to
  remove). Uploads are scaled down in the browser (`src/image.ts`, never upscaled).
- **Attribution Manager** (foldable `<details>`, starts closed): one person per role,
  stored as `author@`, `editor@`, `remixer@`, `translator@`, `contributor@`,
  `illustrator@`, `reviewedBy@` (Reviewer) + `<nameKey>`. Roles are `FIELDS` entries
  with `group: 'attribution'` and `askApplyToSubpages: true`. A change to such a
  field is **not saved until confirmed**: the dialog has Cancel (reverts the field) /
  Save, plus an "Also apply to the N subpages" checkbox when there are subpages.
  Fields keep a committed value (`FieldControl.commit/revert/committedValue`); tag
  saves use only committed values. Dialogs are queued so they never stack.
- MindTouch API quirks: names containing `#` are double-encoded in paths
  (`util.enc`, e.g. `mindtouch.page%2523overview`); JSON responses give a single
  object instead of a one-item array (`asArray` in `api.ts`); updating an existing
  property needs its `ETag`.
- **Subpage listing display** is MindTouch's own block
  (`.mt-ordered-subpage-listing-type-container`, radios named
  `mt-ordered-subpage-listing-type`): Book or Unit → Simple/Detailed, Chapter →
  Single/Tabbed with `#mt-current-guide-display`, Section → none. Its behaviour and
  saving live in MindTouch's script, which builds the block into `#mt-summary`
  *after* it appears. So `#mt-summary` is **hidden, not removed** (`index.ts`: inline
  `display:none !important`, re-applied if MindTouch changes its style, plus
  `html.cps-active #mt-summary { display:none !important }` in the CSS, which also
  covers a rebuilt element; `cps-active` is only set once our panel mounts), and
  `fields/listing.ts` watches it and moves the block into the Page type card whenever
  it shows up — don't rebuild it. MindTouch renders it only for the article type at load;
  after switching to another listing type the card shows a "save and reopen" note.
  Shown to admins and editors, not authors. Reference HTML of MindTouch's panels
  (incl. `chapter-sample`) is in `.document/` (git-ignored).
- Authors API: `https://knitcanvas.fun/api/v1/authors/search?q=<q>&limit=<n>` →
  `{ err, authors: [{ nameKey, name, campusName, isGroup }] }`.
- Nothing here has automated tests; verify UI changes in `pagesetting/demo.html`.
