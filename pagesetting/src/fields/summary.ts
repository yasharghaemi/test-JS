import { getOverview, putOverview } from '../api';
import { SUMMARY_MAX_LENGTH } from '../config';
import { el } from '../dom';
import type { PageData, Save } from '../types';

/**
 * Page summary with a preview mode (click or Enter to edit) and an edit mode with
 * Save / Cancel (Ctrl/Cmd+Enter saves, Escape cancels). Limited to SUMMARY_MAX_LENGTH
 * characters, MindTouch's limit for the summary meta tag; an older, longer summary
 * can't be saved again until it's shortened.
 */
export function summaryField(page: PageData, save: Save): HTMLElement {
  const wrap = el('div', 'cps-summary');
  const label = el('span', 'cps-label', 'Summary');
  label.id = 'cps-summary-label';

  // --- preview ---
  const view = el('button', 'cps-summary-view');
  view.type = 'button';
  view.setAttribute('aria-describedby', label.id);
  // Name = hidden "Edit summary: " + the visible text, so the words on screen are part
  // of the accessible name (WCAG 2.5.3 Label in Name). No aria-label on purpose.
  const viewPrefix = el('span', 'cps-sr-only', 'Edit summary: ');
  const viewText = el('span', 'cps-summary-text');
  const pencil = el('span', 'cps-summary-pencil');
  pencil.setAttribute('aria-hidden', 'true');
  pencil.append(pencilIcon());
  view.append(viewPrefix, viewText, pencil);

  // --- editor ---
  const editor = el('div', 'cps-summary-editor');
  editor.hidden = true;
  const area = el('textarea', 'cps-summary-input');
  area.id = 'cps-summary-input';
  area.rows = 4;
  area.maxLength = SUMMARY_MAX_LENGTH; // stops typing past the limit; doesn't trim old text
  area.setAttribute('aria-labelledby', label.id);
  const bar = el('div', 'cps-summary-bar');
  const count = el('span', 'cps-summary-count');
  count.id = 'cps-summary-count';
  // Screen readers hear the counter only when it matters (near / at / over the limit),
  // not on every keystroke (WCAG 4.1.3 without the noise).
  const announce = el('span', 'cps-sr-only');
  announce.setAttribute('aria-live', 'polite');
  area.setAttribute('aria-describedby', count.id);
  const cancel = el('button', 'cps-btn', 'Cancel');
  cancel.type = 'button';
  const ok = el('button', 'cps-btn cps-btn-primary', 'Save');
  ok.type = 'button';
  const actions = el('div', 'cps-summary-actions');
  actions.append(cancel, ok);
  bar.append(count, actions, announce);
  editor.append(area, bar);

  wrap.append(label, view, editor);

  let saved = page.summary;
  const over = () => area.value.length > SUMMARY_MAX_LENGTH;
  const nearAt = Math.ceil(SUMMARY_MAX_LENGTH * 0.1); // announce from 10% left
  let level = '';
  const announceLevel = () => {
    const left = SUMMARY_MAX_LENGTH - area.value.length;
    const next = left < 0 ? 'over' : left === 0 ? 'full' : left <= nearAt ? 'near' : 'ok';
    if (next === level) return;
    level = next;
    announce.textContent = next === 'over' ? `Too long: shorten to ${SUMMARY_MAX_LENGTH} characters to save`
      : next === 'full' ? `Character limit of ${SUMMARY_MAX_LENGTH} reached`
        : next === 'near' ? `${left} character${left === 1 ? '' : 's'} left` : '';
  };

  const showPreview = () => {
    viewText.textContent = saved || 'Add page summary';
    viewText.classList.toggle('cps-summary-empty', !saved);
    viewPrefix.hidden = !saved; // when empty, "Add page summary" already says it
    editor.hidden = true;
    view.hidden = false;
  };
  const updateEditor = () => {
    count.dataset.over = String(over());
    count.textContent = over()
      ? `${area.value.length} / ${SUMMARY_MAX_LENGTH} - shorten to ${SUMMARY_MAX_LENGTH} to save`
      : `${area.value.length} / ${SUMMARY_MAX_LENGTH}`;
    ok.disabled = over() || area.value === saved;
    announceLevel();
  };
  const edit = () => {
    area.value = saved;
    level = 'ok'; // reset: a summary that opens near/over the limit is announced once
    announce.textContent = '';
    updateEditor();
    view.hidden = true;
    editor.hidden = false;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  };
  const close = () => {
    showPreview();
    view.focus();
  };
  const commit = () => {
    if (ok.disabled) return;
    const text = area.value;
    const previous = saved;
    saved = text;
    close();
    // If saving fails, put the text back in the editor so nothing typed is lost.
    save(() => putOverview(page.id, text), () => {
      saved = previous;
      edit();
      area.value = text;
      updateEditor();
    });
  };

  view.addEventListener('click', edit);
  area.addEventListener('input', updateEditor);
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // close the editor, not the page editor
      close();
    }
  });
  ok.addEventListener('click', commit);
  cancel.addEventListener('click', close);

  // Load the current summary from the API (not from the template). Until it's here,
  // the preview can't be opened, so nobody edits over a summary that hasn't loaded.
  view.disabled = true;
  viewText.textContent = 'Loading summary…';
  viewText.classList.add('cps-summary-empty');
  getOverview(page.id).then(
    (text) => { saved = text; },
    (err) => console.warn('[page-settings] could not load the summary', err),
  ).then(() => {
    view.disabled = false;
    showPreview();
  });
  return wrap;
}

// Pencil icon (Material-style path), drawn inline so it needs no extra request.
function pencilIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z');
  svg.append(path);
  return svg;
}
