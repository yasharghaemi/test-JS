import { searchAuthors } from '../authors';
import { AUTHOR_DEBOUNCE_MS, AUTHOR_MIN_CHARS } from '../config';
import { el, setAttrs } from '../dom';
import type { Author } from '../types';
import { debounce } from '../util';

export interface AuthorSearch {
  input: HTMLInputElement;
  /** The suggestion list and its screen-reader announcer; add them next to the input. */
  list: HTMLUListElement;
  live: HTMLDivElement;
  close(): void;
}

/**
 * The author search box shared by the single-person and multi-person author fields:
 * a combobox (ARIA 1.2 pattern) that searches the authors API as you type and calls
 * onChoose with the picked author. Arrow keys move through suggestions, Enter picks,
 * Escape closes the list (not the page editor).
 */
export function authorSearch(opts: {
  id: string;
  label: string;
  onChoose(author: Author): void;
  onInput?(): void;
  onBlur?(): void;
}): AuthorSearch {
  const listId = `${opts.id}-list`;
  const input = el('input', 'cps-input');
  input.id = opts.id;
  Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false });
  setAttrs(input, {
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
  });
  const list = el('ul', 'cps-combo-list');
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', `${opts.label} suggestions`);
  list.hidden = true;
  const live = el('div', 'cps-sr-only');
  live.setAttribute('aria-live', 'polite');

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
  const choose = (author: Author) => {
    results = [];
    close();
    opts.onChoose(author);
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
    const items = list.querySelectorAll<HTMLElement>('.cps-combo-option');
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((o, j) => {
      o.classList.toggle('cps-active', j === active);
      o.setAttribute('aria-selected', String(j === active));
    });
    input.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  };

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
    opts.onInput?.();
    const q = input.value.trim();
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
  input.addEventListener('blur', () => {
    close();
    opts.onBlur?.();
  });

  return { input, list, live, close };
}
