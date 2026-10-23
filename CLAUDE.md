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
  - `dist/pagesetting.js` — build output. **Committed**, because jsDelivr serves it.
  - `pagesetting.css` — panel styles, served as is (not bundled).
  - `PageSettings.dekiscript` — code for the `Template:Custom/Views/PageSettings`
    template; writes page data as JSON into a hidden `#cps-data` element.
  - `demo.html` — local test page with a fake `/@api/deki` (via a `fetch` override).

## Commands (run in `pagesetting/`)

- `npm install` — once, installs esbuild and typescript.
- `npm run build` — bundles `src/index.ts` to `dist/pagesetting.js` (IIFE, ES2019).
- `npm run watch` — rebuild on change.
- `npm run typecheck` — `tsc --noEmit`.

Always run `npm run typecheck && npm run build` after editing `src/`, and commit the
updated `dist/pagesetting.js` together with the source change.

## Deploying

The site loads files pinned to a commit:
`https://cdn.jsdelivr.net/gh/yasharghaemi/test-JS@<commit>/pagesetting/dist/pagesetting.js`
(and `.../pagesetting/pagesetting.css`). After pushing, give the user the new
commit-pinned URLs; a branch URL (`@main`) is cached by jsDelivr for up to ~12 h.

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
- **Attribution Manager** (foldable `<details>`, starts closed): one person per role,
  stored as `author@`, `editor@`, `remixer@`, `translator@`, `contributor@`,
  `illustrator@`, `reviewedBy@` (Reviewer) + `<nameKey>`. Roles are `FIELDS` entries
  with `group: 'attribution'`; each change offers to apply it to all subpages
  (offers are queued so dialogs never stack).
- MindTouch API quirks: names containing `#` are double-encoded in paths
  (`util.enc`, e.g. `mindtouch.page%2523overview`); JSON responses give a single
  object instead of a one-item array (`asArray` in `api.ts`); updating an existing
  property needs its `ETag`.
- `GUIDE_TABBED_TAG` (`guide:tabbed`) is a placeholder — not confirmed against the site.
- Authors API: `https://knitcanvas.fun/api/v1/authors/search?q=<q>&limit=<n>` →
  `{ err, authors: [{ nameKey, name, campusName, isGroup }] }`.
- Nothing here has automated tests; verify UI changes in `pagesetting/demo.html`.
