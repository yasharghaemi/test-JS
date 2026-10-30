import { putTags, sourceContains } from './api';
import { ARTICLE_PREFIX, DEFAULT_VIEW, GROUPS, OPEN_STATE_KEY, ROLE_VIEWS, TRANSCLUSION_MARKERS, type PanelView, fieldPrefixes, TAG_SAVE_DELAY_MS, type FieldConfig, type GroupConfig } from './config';
import { el } from './dom';
import { authorField } from './fields/author';
import { peopleField } from './fields/people';
import { listingField } from './fields/listing';
import { licenseField } from './fields/license';
import { selectField } from './fields/select';
import { summaryField } from './fields/summary';
import { tagsField } from './fields/tags';
import { thumbnailField } from './fields/thumbnail';
import { readClassifications } from './classifications';
import { applyToSubpages, confirmFieldChange } from './subpages';
import type { FieldControl, PageData, Save, SaveResult, SetStatus } from './types';
import { debounce, hasPrefix } from './util';

interface FieldState {
  field: FieldConfig;
  /** The tags the field held when the panel opened. */
  current: string[];
  control: FieldControl;
}

interface Group {
  config: GroupConfig;
  details: HTMLDetailsElement;
  info: HTMLSpanElement;
  grid: HTMLDivElement;
  states: FieldState[];
}

export function buildPanel(page: PageData, fields: FieldConfig[], mindtouchPanel: HTMLElement | null = null): HTMLElement {
  const panel = el('section', 'cps-panel');
  panel.setAttribute('aria-label', 'Page settings');

  const header = el('div', 'cps-header');
  const toggle = el('button', 'cps-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'true');
  const toggleIcon = el('span', 'cps-toggle-icon', '−');
  toggleIcon.setAttribute('aria-hidden', 'true');
  toggle.append(toggleIcon, el('span', null, 'Page settings'));
  const status = el('span', 'cps-status');
  status.setAttribute('role', 'status');
  // Expand all / Collapse all for the section cards; wired up once they exist.
  const toggleAll = el('button', 'cps-toggle-all');
  toggleAll.type = 'button';
  toggleAll.hidden = true;
  let refreshToggleAll = () => {};
  header.append(toggle, status, toggleAll);

  const body = el('div', 'cps-body');
  body.id = 'cps-body';
  toggle.setAttribute('aria-controls', body.id);
  toggle.addEventListener('click', () => {
    const opening = body.hidden;
    body.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    toggleIcon.textContent = opening ? '−' : '+';
    refreshToggleAll();
  });
  panel.append(header, body);

  if (!page.id) {
    body.append(el('p', 'cps-note', 'Save the page once to edit its settings.'));
    return panel;
  }

  // Saves run one at a time, in order, so a slow request can't overwrite a newer one.
  let queue: Promise<unknown> = Promise.resolve();
  const setStatus: SetStatus = (text, kind = '') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };
  const save: Save = (task, onError) => {
    setStatus('Saving…');
    queue = queue.then(task).then(
      (result) => {
        // Only a real SaveResult ({ text: string, kind }) sets its own message. Most
        // tasks resolve to a fetch Response, whose .text is a function - don't show it.
        const r = result as SaveResult;
        if (r && typeof r.text === 'string') setStatus(r.text, r.kind);
        else setStatus('Saved', 'ok');
      },
      (err) => {
        console.warn('[page-settings]', err);
        setStatus("Couldn't save. Try again.", 'error');
        if (onError) onError();
      },
    );
  };

  // What this role sees (see ROLE_VIEWS). Hidden parts are still built, so their tags
  // keep being saved unchanged.
  const view: PanelView = ROLE_VIEWS[page.userRole.trim().toLowerCase()] ?? DEFAULT_VIEW;
  const hiddenInView = (field: FieldConfig) =>
    view === 'author' ? !field.forAuthors : view === 'editor' && !!field.hiddenForEditors;

  // --- thumbnail + summary ---
  const top = el('div', 'cps-top');
  top.hidden = view === 'author';
  const thumbnail = thumbnailField(page, save, setStatus);
  top.append(thumbnail.node, summaryField(page, save));

  // --- tag fields ---
  const scheduleTags = debounce(() => save(() => putTags(page.id, collectTags())), TAG_SAVE_DELAY_MS);

  const row = el('div', 'cps-fields');

  // Foldable sections (Page type, Display & status, Attribution, License), in
  // GROUPS order; each header summarises its fields.
  const groups = new Map(GROUPS.map((config): [string, Group] => {
    const details = el('details', config.wide ? 'cps-group cps-group-wide' : 'cps-group');
    const summary = el('summary', 'cps-group-summary');
    // A heading per card so screen-reader users can jump between sections.
    const title = el('h3', 'cps-group-title', config.title);
    const info = el('span', 'cps-group-info');
    summary.append(title, info);
    const grid = el('div', 'cps-group-fields');
    details.append(summary, grid);
    return [config.id, { config, details, info, grid, states: [] }];
  }));

  const fieldStates = fields.map((field, i): FieldState => {
    // For each prefix the field owns, the first matching tag ('' if none) - or, for a
    // multi-person field, every matching tag.
    const current = field.multiple
      ? page.tags.filter((t) => hasPrefix(t, field.prefix))
      : fieldPrefixes(field).map((p) => page.tags.find((t) => hasPrefix(t, p)) || '');
    const id = `cps-field-${i}`;
    const onChange = () => {
      updateArticleType();
      updateGroupSummaries();
      if (!field.askApplyToSubpages) {
        control.commit();
        scheduleTags();
        return;
      }
      // Nothing is saved until the user confirms; Cancel puts the old value back.
      confirmFieldChange(page.id, field, control).then((decision) => {
        if (!decision) return;
        if (!decision.confirmed) {
          control.revert();
          updateArticleType();
          updateGroupSummaries();
          return;
        }
        control.commit();
        save(() => putTags(page.id, collectTags()));
        const ids = decision.subpageIds;
        const tags = control.committedTags();
        if (ids.length) save(() => applyToSubpages(ids, field, tags, (text) => setStatus(text)));
      });
    };
    const control: FieldControl = field.type === 'license'
      ? licenseField(field, current, id, onChange)
      : field.type === 'author' && field.multiple
        ? peopleField(field, current, id, onChange)
        : field.type === 'author'
        ? authorField(field, current[0], id, onChange)
        : selectField(field, current[0], id, onChange);
    if (hiddenInView(field)) control.node.hidden = true;
    const state = { field, current: current.filter(Boolean), control };
    const group = field.group ? groups.get(field.group) : undefined;
    if (group) group.states.push(state);
    (group ? group.grid : row).append(control.node);
    return state;
  });

  function updateGroupSummaries() {
    groups.forEach(({ config, info, states }) => {
      const parts = config.summary === 'count'
        ? [`${states.filter((s) => s.control.tags().length).length} of ${states.length} set`]
        : states.map((s) => s.control.display()).filter(Boolean);
      if (!parts.length) parts.push('not set');
      // Show "· a · b", but have screen readers say ", a, b" (no "dot").
      const shown = el('span', null, `· ${parts.join(' · ')}`);
      shown.setAttribute('aria-hidden', 'true');
      info.replaceChildren(shown, el('span', 'cps-sr-only', `, ${parts.join(', ')}`));
    });
  }
  updateGroupSummaries();

  // Options from the site's classifications (read from MindTouch's hidden panel)
  // replace the config.ts ones where found. MindTouch may fill its panel in late,
  // so look again whenever it changes.
  const applyClassifications = () => {
    const classifications = readClassifications(mindtouchPanel);
    if (!classifications.size) return;
    fieldStates.forEach((s) => s.control.setOptions?.(classifications));
    updateGroupSummaries();
  };
  applyClassifications();
  if (mindtouchPanel) {
    new MutationObserver(debounce(applyClassifications, 100)).observe(mindtouchPanel, { childList: true, subtree: true });
  }

  // Open state: what this person last chose (per browser), else the default.
  // Authors have few fields, so by default everything they see starts unfolded.
  const openState = readOpenState();
  groups.forEach((g) => {
    const stored = openState[g.config.id];
    let known = typeof stored === 'boolean' ? stored : view === 'author' || !!g.config.open;
    g.details.open = known;
    g.details.addEventListener('toggle', () => {
      refreshToggleAll();
      if (g.details.open === known) return; // the initial, programmatic open
      known = g.details.open;
      openState[g.config.id] = known;
      writeOpenState(openState);
    });
  });

  const visibleGroups = () => [...groups.values()].filter((g) => !g.details.hidden);
  refreshToggleAll = () => {
    const visible = visibleGroups();
    toggleAll.hidden = body.hidden || visible.length < 2;
    toggleAll.textContent = visible.some((g) => !g.details.open) ? 'Expand all' : 'Collapse all';
  };
  toggleAll.addEventListener('click', () => {
    const visible = visibleGroups();
    const open = visible.some((g) => !g.details.open);
    visible.forEach((g) => { g.details.open = open; });
    refreshToggleAll();
  });

  // --- subpage listing display: depends on the article type; not for authors ---
  const articleState = fieldStates.find((s) => s.field.prefix.toLowerCase() === ARTICLE_PREFIX);
  const articleType = () => (articleState ? articleState.control.tags()[0] || '' : '');
  // MindTouch builds its listing block (in mindtouchPanel) for the article type at load.
  const listing = listingField(mindtouchPanel, articleState?.current[0] || '', () => updateSectionVisibility());
  // It belongs with Article type, in the Page type section.
  const articleGroup = articleState?.field.group ? groups.get(articleState.field.group) : undefined;
  (articleGroup ? articleGroup.grid : row).append(listing.node);

  // The listing display and the thumbnail rule both follow the article type.
  function updateArticleType() {
    listing.setArticleType(view === 'author' ? '' : articleType());
    thumbnail.setArticleType(articleType());
    updateSectionVisibility();
  }

  // A section (or the main row) with nothing visible for this role disappears.
  // (Function declarations: the listing control can call this while it's being built.)
  function anyVisible(parent: HTMLElement) {
    return Array.from(parent.children).some((c) => !(c as HTMLElement).hidden);
  }
  function updateSectionVisibility() {
    // ...and a section limited to some article types (articleTypes) hides on others.
    const type = articleType();
    groups.forEach((g) => {
      const forType = !g.config.articleTypes || g.config.articleTypes.includes(type);
      g.details.hidden = !forType || !anyVisible(g.grid);
    });
    row.hidden = !anyVisible(row);
    refreshToggleAll();
  }
  updateArticleType();

  // --- free tags: everything except the tags the fields above hold ---
  const fieldTags = new Set(fieldStates.flatMap((s) => s.current));
  const freeTags = page.tags.filter((t) => !fieldTags.has(t));
  const tagsNode = tagsField(freeTags, scheduleTags);

  function collectTags(): string[] {
    const all = [...freeTags];
    fieldStates.forEach((s) => all.push(...s.control.committedTags()));
    return [...new Set(all)];
  }

  tagsNode.hidden = view === 'author';

  // Detected fields: "yes" if the page source shows transclusion, otherwise not set.
  // If the saved tag doesn't match, fix it right away.
  fieldStates.filter((s) => s.field.detect === 'transclusion').forEach((s) => {
    sourceContains(page.id, TRANSCLUSION_MARKERS).then((transcluded) => {
      if (!s.control.force?.(transcluded ? `${s.field.prefix}yes` : '')) return;
      updateGroupSummaries();
      save(() => putTags(page.id, collectTags()));
    }, (err) => console.warn('[page-settings] could not check the page for transclusion', err));
  });
  // Cards sit in one grid: wide ones span it, the rest pair up on wide screens.
  const groupsBox = el('div', 'cps-groups');
  groupsBox.append(...[...groups.values()].map((g) => g.details));
  body.append(top, row, groupsBox, tagsNode);
  return panel;
}

// The open-cards memory is only a convenience: storage may be unavailable.
function readOpenState(): Record<string, boolean> {
  try {
    const state = JSON.parse(localStorage.getItem(OPEN_STATE_KEY) || '{}');
    return state && typeof state === 'object' ? state : {};
  } catch {
    return {};
  }
}

function writeOpenState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(OPEN_STATE_KEY, JSON.stringify(state));
  } catch {
    // private mode, blocked storage, ...: just don't remember
  }
}
