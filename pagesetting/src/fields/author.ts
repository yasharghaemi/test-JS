import { findAuthor, searchAuthors } from '../authors';
import { AUTHOR_DEBOUNCE_MS, AUTHOR_MIN_CHARS, NOT_SET, type FieldConfig } from '../config';
import { el, labelled, setAttrs } from '../dom';
import type { Author, FieldControl } from '../types';
import { debounce } from '../util';

/** Searchable author combobox; its value is prefix + the author's nameKey. */
export function authorField(field: FieldConfig, current: string, id: string, onChange: () => void): FieldControl {
  const prefix = field.prefix;
  const known = new Map(field.options.filter(([v]) => v !== NOT_SET));
  const listId = `${id}-list`;
  let value = current;
  let name = value ? known.get(value) || value.slice(prefix.length) : '';
  let committed = { value, name };

  const wrap = el('div', 'cps-combo');
  const input = el('input', 'cps-input');
  input.id = id;
  // "—" reads as "not set"; the hint appears once the box is focused.
  Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false, placeholder: '—' });
  input.addEventListener('focus', () => { input.placeholder = 'Search people…'; });
  setAttrs(input, {
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
  });
  const clear = el('button', 'cps-combo-clear', '×');
  clear.type = 'button';
  clear.setAttribute('aria-label', `Clear ${field.label}`);
  const list = el('ul', 'cps-combo-list');
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  const live = el('div', 'cps-sr-only');
  live.setAttribute('aria-live', 'polite');
  wrap.append(input, clear, list, live);

  const show = () => {
    input.value = name;
    clear.hidden = !name;
  };
  show();

  // A saved author missing from the known list only has its key; look up the name.
  if (value && !known.has(value)) {
    findAuthor(value.slice(prefix.length)).then((author) => {
      if (committed.value === current && author) committed.name = author.name;
      if (!author || value !== current) return;
      name = author.name;
      if (document.activeElement !== input) show();
    });
  }

  let results: Author[] = [];
  let active = -1;
  let controller: AbortController | null = null;

  const open = () => { list.hidden = false; input.setAttribute('aria-expanded', 'true'); };
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const message = (text: string) => {
    list.replaceChildren(el('li', 'cps-combo-msg', text));
    live.textContent = text;
    open();
  };
  const renderList = () => {
    if (!results.length) return message('No authors found');
    list.replaceChildren(...results.map((a, i) => {
      const li = el('li', 'cps-combo-option');
      li.id = `${listId}-opt-${i}`;
      setAttrs(li, { role: 'option', 'aria-selected': 'false' });
      li.append(el('span', 'cps-combo-name', a.name + (a.isGroup ? ' (group)' : '')));
      if (a.campusName) li.append(el('span', 'cps-combo-campus', a.campusName));
      // mousedown + preventDefault keeps focus in the input so blur doesn't close first
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(results[i]); });
      return li;
    }));
    live.textContent = `${results.length} author${results.length === 1 ? '' : 's'} found`;
    open();
  };
  const setActive = (i: number) => {
    const opts = list.querySelectorAll<HTMLElement>('.cps-combo-option');
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach((o, j) => {
      o.classList.toggle('cps-active', j === active);
      o.setAttribute('aria-selected', String(j === active));
    });
    input.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  };

  function choose(author: Author) {
    value = prefix + author.nameKey;
    name = author.name;
    show();
    close();
    onChange();
  }

  const search = debounce(async (q: string) => {
    if (controller) controller.abort();
    controller = new AbortController();
    message('Searching…');
    try {
      results = await searchAuthors(q, controller.signal);
      renderList();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.warn('[page-settings]', err);
      message('Could not load authors. Try again.');
    }
  }, AUTHOR_DEBOUNCE_MS);

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clear.hidden = !input.value;
    if (q.length < AUTHOR_MIN_CHARS) {
      if (controller) controller.abort();
      results = [];
      close();
      return;
    }
    search(q);
  });
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (list.hidden && results.length) renderList();
        setActive(active + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(active - 1);
        break;
      case 'Enter':
        // never let Enter submit the editor form from this field
        e.preventDefault();
        if (!list.hidden && active >= 0 && results[active]) choose(results[active]);
        break;
      case 'Escape':
        if (!list.hidden) {
          e.preventDefault();
          e.stopPropagation(); // close the list, not the editor
          close();
        }
        break;
    }
  });
  // Don't leave half-typed text that looks like a saved value.
  input.addEventListener('blur', () => { close(); show(); input.placeholder = '—'; });
  clear.addEventListener('click', () => {
    value = '';
    name = '';
    results = [];
    show();
    close();
    onChange();
    input.focus();
  });

  return {
    node: labelled(field.label, wrap, id),
    value: () => value,
    display: () => name,
    committedValue: () => committed.value,
    commit: () => { committed = { value, name }; },
    revert: () => {
      ({ value, name } = committed);
      show();
    },
  };
}
