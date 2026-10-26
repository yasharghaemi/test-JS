import { putTags } from './api';
import { ARTICLE_PREFIX, DEFAULT_VIEW, GROUPS, ROLE_VIEWS, type PanelView, fieldPrefixes, TAG_SAVE_DELAY_MS, type FieldConfig, type GroupConfig } from './config';
import { el } from './dom';
import { authorField } from './fields/author';
import { listingField } from './fields/listing';
import { licenseField } from './fields/license';
import { selectField } from './fields/select';
import { summaryField } from './fields/summary';
import { tagsField } from './fields/tags';
import { thumbnailField } from './fields/thumbnail';
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

export function buildPanel(page: PageData, fields: FieldConfig[], listingSource: HTMLElement | null = null): HTMLElement {
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
  header.append(toggle, status);

  const body = el('div', 'cps-body');
  toggle.addEventListener('click', () => {
    const opening = body.hidden;
    body.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    toggleIcon.textContent = opening ? '−' : '+';
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
        const r = result as SaveResult;
        if (r) setStatus(r.text, r.kind); else setStatus('Saved', 'ok');
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

  // Foldable sections (Page type, Display & status, Attribution Manager, License), in
  // GROUPS order; each header summarises its fields.
  const groups = new Map(GROUPS.map((config): [string, Group] => {
    const details = el('details', 'cps-group');
    const summary = el('summary', 'cps-group-summary');
    const info = el('span', 'cps-group-info');
    summary.append(el('span', null, config.title), info);
    const grid = el('div', 'cps-group-fields');
    details.append(summary, grid);
    return [config.id, { config, details, info, grid, states: [] }];
  }));

  const fieldStates = fields.map((field, i): FieldState => {
    // For each prefix the field owns, the first matching tag ('' if none).
    const current = fieldPrefixes(field).map((p) => page.tags.find((t) => hasPrefix(t, p)) || '');
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
      if (config.summary === 'count') {
        const set = states.filter((s) => s.control.tags().length).length;
        info.textContent = `· ${set} of ${states.length} set`;
      } else {
        const values = states.map((s) => s.control.display()).filter(Boolean);
        info.textContent = `· ${values.length ? values.join(' · ') : 'not set'}`;
      }
    });
  }
  updateGroupSummaries();
  // Authors have few fields, so everything they see starts unfolded.
  groups.forEach((g) => { g.details.open = view === 'author' || !!g.config.open; });

  // --- subpage listing display: depends on the article type; not for authors ---
  const articleState = fieldStates.find((s) => s.field.prefix.toLowerCase() === ARTICLE_PREFIX);
  const articleType = () => (articleState ? articleState.control.tags()[0] || '' : '');
  // MindTouch builds its listing block (in listingSource) for the article type at load.
  const listing = listingField(listingSource, articleState?.current[0] || '', () => updateSectionVisibility());
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
    groups.forEach((g) => { g.details.hidden = !anyVisible(g.grid); });
    row.hidden = !anyVisible(row);
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
  body.append(top, row, ...[...groups.values()].map((g) => g.details), tagsNode);
  return panel;
}
