import { putTags } from './api';
import { ARTICLE_PREFIX, EDITOR_ROLE, GROUPS, fieldPrefixes, GUIDE_TABBED_TAG, GUIDE_TAG, TAG_SAVE_DELAY_MS, type FieldConfig, type GroupConfig } from './config';
import { el, radio } from './dom';
import { authorField } from './fields/author';
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

export function buildPanel(page: PageData, fields: FieldConfig[]): HTMLElement {
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

  // Editors (authors) get a reduced panel: only `forEditors` fields. Everything else is
  // still built, just hidden, so its tags keep being saved unchanged.
  const limited = page.userRole.trim().toLowerCase() === EDITOR_ROLE;

  // --- thumbnail + summary ---
  const top = el('div', 'cps-top');
  top.hidden = limited;
  const thumbnail = thumbnailField(page, save, setStatus);
  top.append(thumbnail.node, summaryField(page, save));

  // --- tag fields ---
  const scheduleTags = debounce(() => save(() => putTags(page.id, collectTags())), TAG_SAVE_DELAY_MS);

  const row = el('div', 'cps-fields');

  // Foldable sections (Attribution Manager, License, ...); closed at first, with a summary.
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
      updateGuide();
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
          updateGuide();
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
    if (limited && !field.forEditors) control.node.hidden = true;
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
        info.textContent = `· ${values.length ? values.join(' ') : 'not set'}`;
      }
    });
  }
  updateGroupSummaries();
  groups.forEach((g) => {
    g.details.hidden = !g.states.some((s) => !s.control.node.hidden);
    g.details.open = limited; // editors have few fields, so show them unfolded
  });

  // --- guide listing display (only for guides) ---
  const guide = el('fieldset', 'cps-guide');
  guide.append(el('legend', 'cps-heading', 'Guide listing display :'));
  const single = radio('cps-guide', 'single', 'Single', 'Topic hierarchy');
  const tabbed = radio('cps-guide', 'tabbed', 'Tabbed');
  (page.tags.includes(GUIDE_TABBED_TAG) ? tabbed : single).input.checked = true;
  [single, tabbed].forEach((r) => r.input.addEventListener('change', scheduleTags));
  guide.append(single.node, tabbed.node);
  const articleState = fieldStates.find((s) => s.field.prefix.toLowerCase() === ARTICLE_PREFIX);
  const articleType = () => (articleState ? articleState.control.tags()[0] || '' : '');
  const isGuide = () => articleType() === GUIDE_TAG;
  // Guide display and the thumbnail rule both follow the article type.
  function updateGuide() {
    guide.hidden = limited || !isGuide();
    thumbnail.setArticleType(articleType());
  }
  updateGuide();

  // --- free tags: everything except the tags the fields above hold ---
  const fieldTags = new Set(fieldStates.flatMap((s) => s.current));
  const freeTags = page.tags.filter((t) => !fieldTags.has(t) && t !== GUIDE_TABBED_TAG);
  const tagsNode = tagsField(freeTags, scheduleTags);

  function collectTags(): string[] {
    const all = [...freeTags];
    fieldStates.forEach((s) => all.push(...s.control.committedTags()));
    if (isGuide() && tabbed.input.checked) all.push(GUIDE_TABBED_TAG);
    return [...new Set(all)];
  }

  tagsNode.hidden = limited;
  body.append(top, guide, row, ...[...groups.values()].map((g) => g.details), tagsNode);
  return panel;
}
