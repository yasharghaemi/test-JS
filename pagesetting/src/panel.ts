import { putTags } from './api';
import { ARTICLE_PREFIX, GUIDE_TABBED_TAG, GUIDE_TAG, TAG_SAVE_DELAY_MS, type FieldConfig } from './config';
import { el, radio } from './dom';
import { authorField } from './fields/author';
import { selectField } from './fields/select';
import { summaryField } from './fields/summary';
import { tagsField } from './fields/tags';
import { thumbnailField } from './fields/thumbnail';
import { applyToSubpages, confirmFieldChange } from './subpages';
import type { FieldControl, PageData, Save, SaveResult, SetStatus } from './types';
import { debounce, hasPrefix } from './util';

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

  // --- thumbnail + summary ---
  const top = el('div', 'cps-top');
  top.append(thumbnailField(page, save, setStatus), summaryField(page, save));

  // --- tag fields ---
  const scheduleTags = debounce(() => save(() => putTags(page.id, collectTags())), TAG_SAVE_DELAY_MS);

  const row = el('div', 'cps-fields');

  // Foldable Attribution Manager; starts closed and shows how many roles are set.
  const attribution = el('details', 'cps-attribution');
  const attributionSummary = el('summary', 'cps-attribution-summary');
  const attributionCount = el('span', 'cps-attribution-count');
  attributionSummary.append(el('span', null, 'Attribution Manager'), attributionCount);
  const roles = el('div', 'cps-roles');
  attribution.append(attributionSummary, roles);

  const fieldStates = fields.map((field, i) => {
    const current = page.tags.find((t) => hasPrefix(t, field.prefix)) || '';
    const id = `cps-field-${i}`;
    const onChange = () => {
      updateGuide();
      updateAttributionCount();
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
          updateAttributionCount();
          return;
        }
        control.commit();
        save(() => putTags(page.id, collectTags()));
        const ids = decision.subpageIds;
        const tag = control.committedValue();
        if (ids.length) save(() => applyToSubpages(ids, field, tag, (text) => setStatus(text)));
      });
    };
    const control: FieldControl = field.type === 'author'
      ? authorField(field, current, id, onChange)
      : selectField(field, current, id, onChange);
    (field.group === 'attribution' ? roles : row).append(control.node);
    return { field, current, control };
  });

  const roleStates = fieldStates.filter((s) => s.field.group === 'attribution');
  function updateAttributionCount() {
    const set = roleStates.filter((s) => s.control.value()).length;
    attributionCount.textContent = `· ${set} of ${roleStates.length} set`;
  }
  updateAttributionCount();
  attribution.hidden = !roleStates.length;

  // --- guide listing display (only for guides) ---
  const guide = el('fieldset', 'cps-guide');
  guide.append(el('legend', 'cps-heading', 'Guide listing display :'));
  const single = radio('cps-guide', 'single', 'Single', 'Topic hierarchy');
  const tabbed = radio('cps-guide', 'tabbed', 'Tabbed');
  (page.tags.includes(GUIDE_TABBED_TAG) ? tabbed : single).input.checked = true;
  [single, tabbed].forEach((r) => r.input.addEventListener('change', scheduleTags));
  guide.append(single.node, tabbed.node);
  const articleState = fieldStates.find((s) => s.field.prefix.toLowerCase() === ARTICLE_PREFIX);
  const isGuide = () => !!articleState && articleState.control.value() === GUIDE_TAG;
  function updateGuide() { guide.hidden = !isGuide(); }
  updateGuide();

  // --- free tags: everything except the tags the fields above hold ---
  const fieldTags = new Set(fieldStates.map((s) => s.current).filter(Boolean));
  const freeTags = page.tags.filter((t) => !fieldTags.has(t) && t !== GUIDE_TABBED_TAG);
  const tagsNode = tagsField(freeTags, scheduleTags);

  function collectTags(): string[] {
    const all = [...freeTags];
    fieldStates.forEach((s) => { const v = s.control.committedValue(); if (v) all.push(v); });
    if (isGuide() && tabbed.input.checked) all.push(GUIDE_TABBED_TAG);
    return [...new Set(all)];
  }

  body.append(top, guide, row, attribution, tagsNode);
  return panel;
}
