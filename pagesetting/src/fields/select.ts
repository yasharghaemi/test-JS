import { NOT_SET, type FieldConfig } from '../config';
import { el, labelled } from '../dom';
import type { FieldControl } from '../types';

export function selectField(field: FieldConfig, current: string, id: string, onChange: () => void): FieldControl {
  const select = el('select', 'cps-select');
  select.id = id;
  const options: Array<[string, string]> = field.options.some(([v]) => v === NOT_SET)
    ? field.options
    : [[NOT_SET, '(not set)'], ...field.options];
  options.forEach(([value, text]) => select.add(new Option(text, value)));
  // Keep a saved value the site no longer lists, so saving doesn't drop it.
  if (current && !options.some(([v]) => v === current)) {
    select.add(new Option(current.slice(field.prefix.length), current));
  }
  select.value = current || NOT_SET;
  let committed = select.value;
  select.addEventListener('change', onChange);
  return {
    node: labelled(field.label, select, id),
    tags: () => (select.value === NOT_SET ? [] : [select.value]),
    display: () => (select.value === NOT_SET ? '' : select.selectedOptions[0]?.textContent?.trim() || ''),
    committedTags: () => (committed === NOT_SET ? [] : [committed]),
    commit: () => { committed = select.value; },
    revert: () => { select.value = committed; },
  };
}
