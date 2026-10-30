import { findAuthor } from '../authors';
import { NOT_SET, type FieldConfig } from '../config';
import { el, labelled } from '../dom';
import type { FieldControl } from '../types';
import { authorSearch } from './authorSearch';

/** One person: a searchable author box; its value is prefix + the author's nameKey. */
export function authorField(field: FieldConfig, current: string, id: string, onChange: () => void): FieldControl {
  const prefix = field.prefix;
  const known = new Map(field.options.filter(([v]) => v !== NOT_SET));
  let value = current;
  let name = value ? known.get(value) || value.slice(prefix.length) : '';
  let committed = { value, name };

  const wrap = el('div', 'cps-combo');
  // No placeholder while blurred: an empty box shows a visual-only "—" (screen readers
  // would read a "—" placeholder as "em dash"; they say "blank" instead).
  const dash = el('span', 'cps-combo-dash', '—');
  dash.setAttribute('aria-hidden', 'true');
  const clear = el('button', 'cps-combo-clear', '×');
  clear.type = 'button';
  clear.setAttribute('aria-label', `Clear ${field.label}`);

  const show = () => {
    search.input.value = name;
    clear.hidden = !name;
    dash.hidden = !!name || document.activeElement === search.input;
  };
  const search = authorSearch({
    id,
    label: field.label,
    onChoose: (author) => {
      value = prefix + author.nameKey;
      name = author.name;
      show();
      onChange();
    },
    onInput: () => { clear.hidden = !search.input.value; },
    // Don't leave half-typed text that looks like a saved value.
    onBlur: () => { show(); search.input.placeholder = ''; dash.hidden = !!name; },
  });
  search.input.addEventListener('focus', () => { search.input.placeholder = 'Search people…'; dash.hidden = true; });
  wrap.append(search.input, dash, clear, search.list, search.live);
  show();

  // A saved author missing from the known list only has its key; look up the name.
  if (value && !known.has(value)) {
    findAuthor(value.slice(prefix.length)).then((author) => {
      if (committed.value === current && author) committed.name = author.name;
      if (!author || value !== current) return;
      name = author.name;
      if (document.activeElement !== search.input) show();
    });
  }

  clear.addEventListener('click', () => {
    value = '';
    name = '';
    show();
    search.close();
    onChange();
    search.input.focus();
  });

  return {
    node: labelled(field.label, wrap, id),
    tags: () => (value ? [value] : []),
    display: () => name,
    committedTags: () => (committed.value ? [committed.value] : []),
    commit: () => { committed = { value, name }; },
    revert: () => {
      ({ value, name } = committed);
      show();
    },
  };
}
