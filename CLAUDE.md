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
  - `src/` — sources. `index.ts` mounts the panel; `config.ts` holds `FIELDS` and all
    constants; `api.ts` has every MindTouch API call; `fields/` has one module per
    panel section; `subpages.ts` asks to apply a field change to all subpages.
  - `dist/pagesetting.min.js` (+ `.map`) and `dist/pagesetting.min.css` — minified
    build output. **Committed**, because jsDelivr serves it.
  - `pagesetting.css` — panel styles source (minified into `dist/` by the build).
  - `loader.html` — the only code pasted into the site (Custom HTML): calls the
    DekiScript template and loads the `dist/` files only once `#mt-summary` appears.
  - `PageSettings.dekiscript` — code for the `Template:Custom/Views/PageSettings`
    template; writes page data as JSON into a hidden `#cps-data` element.
  - `demo.html` — local test page with a fake `/@api/deki` (via a `fetch` override).

## Commands (run in `pagesetting/`)

- `npm install` — once, installs esbuild and typescript.
- `npm run build` — minified, ASCII-only `dist/pagesetting.min.js` (IIFE, ES2019,
  with source map) and `dist/pagesetting.min.css`.
- `npm run watch` — rebuild the JS on change.
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
- **Foldable sections** come from `GROUPS` in `config.ts` (`<details class="cps-group">`,
  closed at first; header shows a count or the chosen values). A field joins one via
  `group: '<id>'`.
- **License** section: one `type: 'license'` field (`fields/license.ts`) that owns two
  tags, `license:<key>` and `licenseversion:<key>` (e.g. `license:ccbysa`,
  `licenseversion:40`). `LICENSES` in `config.ts` (from the site's own list) defines
  each license and the versions it allows; the version dropdown only offers those, and
  changing the license keeps a still-valid version or picks the newest. Fields can own
  several tags: `FieldControl.tags()/committedTags()` return arrays and
  `fieldPrefixes(field)` lists every prefix a field owns.
- **Thumbnail** follows the Article type via `THUMBNAIL_WIDTHS` in `config.ts`:
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
- `GUIDE_TABBED_TAG` (`guide:tabbed`) is a placeholder — not confirmed against the site.
- Authors API: `https://knitcanvas.fun/api/v1/authors/search?q=<q>&limit=<n>` →
  `{ err, authors: [{ nameKey, name, campusName, isGroup }] }`.
- Nothing here has automated tests; verify UI changes in `pagesetting/demo.html`.
