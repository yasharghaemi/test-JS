import { putOverview } from '../api';
import { SUMMARY_MAX_LENGTH, SUMMARY_SAVE_DELAY_MS } from '../config';
import { el } from '../dom';
import type { PageData, Save } from '../types';
import { debounce } from '../util';

export function summaryField(page: PageData, save: Save): HTMLElement {
  const wrap = el('div', 'cps-summary');
  const head = el('div', 'cps-summary-head');
  const label = el('label', 'cps-label', 'Summary');
  label.htmlFor = 'cps-summary-input';
  const count = el('span', 'cps-summary-count');
  count.id = 'cps-summary-count';
  count.setAttribute('aria-live', 'polite');
  head.append(label, count);
  const area = el('textarea', 'cps-summary-input');
  area.id = 'cps-summary-input';
  area.rows = 4;
  // MindTouch keeps at most this many characters for the summary meta tag. maxLength
  // stops typing past it, but doesn't trim an older, longer summary.
  area.maxLength = SUMMARY_MAX_LENGTH;
  area.value = page.summary;
  area.setAttribute('aria-describedby', count.id);
  wrap.append(head, area);

  const over = () => area.value.length > SUMMARY_MAX_LENGTH;
  const updateCount = () => {
    count.dataset.over = String(over());
    count.textContent = over()
      ? `${area.value.length} / ${SUMMARY_MAX_LENGTH} - shorten to ${SUMMARY_MAX_LENGTH} characters to save`
      : `${area.value.length} / ${SUMMARY_MAX_LENGTH}`;
  };
  updateCount();

  let saved = page.summary;
  const saveSummary = () => {
    const text = area.value;
    if (text === saved || over()) return; // too long: wait until it's shortened
    const previous = saved;
    saved = text;
    save(() => putOverview(page.id, text), () => { saved = previous; });
  };
  area.addEventListener('input', updateCount);
  area.addEventListener('input', debounce(saveSummary, SUMMARY_SAVE_DELAY_MS));
  area.addEventListener('blur', saveSummary);
  return wrap;
}
