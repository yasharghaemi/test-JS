import { sameOptions, type Classifications } from '../classifications';
import { NOT_SET, type FieldConfig } from '../config';
import { el, labelled } from '../dom';
import type { FieldControl } from '../types';

export function selectField(field: FieldConfig, current: string, id: string, onChange: () => void): FieldControl {
  const select = el('select', 'cps-select');
  select.id = id;
  let options = field.options.filter(([v]) => v !== NOT_SET);
  let committed = current || NOT_SET;

  // (Re)builds the list. Keeps the shown and committed values even when the list
  // doesn't have them, so saving or Cancel never drops a saved tag.
  const fill = () => {
    const shown = select.value || committed;
    select.replaceChildren(new Option('(not set)', NOT_SET));
    options.forEach(([value, text]) => select.add(new Option(text, value)));
    [shown, committed].forEach((value) => {
      if (value !== NOT_SET && !options.some(([v]) => v === value)
        && !Array.from(select.options).some((o) => o.value === value)) {
        select.add(new Option(value.slice(field.prefix.length), value));
      }
    });
    select.value = shown;
  };
  fill(); // empty select, so it shows the committed (saved) value
  select.addEventListener('change', onChange);
  // Detected fields (e.g. Transcluded) are set by the panel, never by hand.
  if (field.detect) {
    select.disabled = true;
    select.title = 'Set automatically from the page content';
  }

  return {
    node: labelled(field.label, select, id),
    tags: () => (select.value === NOT_SET ? [] : [select.value]),
    display: () => (select.value === NOT_SET ? '' : select.selectedOptions[0]?.textContent?.trim() || ''),
    committedTags: () => (committed === NOT_SET ? [] : [committed]),
    commit: () => { committed = select.value; },
    revert: () => { select.value = committed; },
    force: (tag) => {
      const value = tag || NOT_SET;
      if (value === committed && select.value === value) return false;
      committed = value;
      select.value = '';
      fill(); // makes sure the option exists, then shows it
      select.value = value;
      return true;
    },
    setOptions: (classifications) => {
      const found = classifications.get(field.prefix.toLowerCase());
      if (!found || sameOptions(found, options)) return;
      options = found;
      fill();
    },
  };
}
