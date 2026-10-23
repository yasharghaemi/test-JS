import { putOverview } from '../api';
import { SUMMARY_SAVE_DELAY_MS } from '../config';
import { el } from '../dom';
import type { PageData, Save } from '../types';
import { debounce } from '../util';

export function summaryField(page: PageData, save: Save): HTMLElement {
  const wrap = el('div', 'cps-summary');
  const label = el('label', 'cps-label', 'Summary');
  label.htmlFor = 'cps-summary-input';
  const area = el('textarea', 'cps-summary-input');
  area.id = 'cps-summary-input';
  area.rows = 4;
  area.value = page.summary;
  wrap.append(label, area);

  let saved = page.summary;
  const saveSummary = () => {
    const text = area.value;
    if (text === saved) return;
    const previous = saved;
    saved = text;
    save(() => putOverview(page.id, text), () => { saved = previous; });
  };
  area.addEventListener('input', debounce(saveSummary, SUMMARY_SAVE_DELAY_MS));
  area.addEventListener('blur', saveSummary);
  return wrap;
}
