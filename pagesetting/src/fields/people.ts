import { findAuthor } from '../authors';
import type { FieldConfig } from '../config';
import { el, labelled, tagLink } from '../dom';
import type { FieldControl } from '../types';
import { authorSearch } from './authorSearch';

interface Person {
  tag: string;
  name: string;
}

/**
 * Several people for one role (field.multiple), e.g. every Book Author: one page tag
 * per person (prefix + nameKey), shown as removable chips, plus the author search box
 * to add more.
 */
export function peopleField(field: FieldConfig, current: string[], id: string, onChange: () => void): FieldControl {
  const prefix = field.prefix;
  let people: Person[] = current.map((tag) => ({ tag, name: tag.slice(prefix.length) }));
  let committed = [...people];

  const wrap = el('div', 'cps-people');
  const chips = el('ul', 'cps-people-chips');
  chips.setAttribute('aria-label', field.label);
  const combo = el('div', 'cps-combo');

  const render = () => {
    chips.replaceChildren(...people.map((p) => {
      const li = el('li', 'cps-chip');
      const remove = el('button', 'cps-chip-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${p.name} from ${field.label}`);
      remove.addEventListener('click', () => {
        people = people.filter((x) => x.tag !== p.tag);
        render();
        onChange();
        search.input.focus();
      });
      li.append(remove, tagLink(p.tag, p.name));
      return li;
    }));
    chips.hidden = !people.length;
  };

  const search = authorSearch({
    id,
    label: field.label,
    onChoose: (author) => {
      const tag = prefix + author.nameKey;
      search.input.value = '';
      if (people.some((p) => p.tag === tag)) return; // already listed
      people = [...people, { tag, name: author.name }];
      render();
      onChange();
    },
    onBlur: () => { search.input.value = ''; },
  });
  search.input.placeholder = 'Add a person…';
  combo.append(search.input, search.list, search.live);
  wrap.append(chips, combo);
  render();

  // Saved tags only carry the key: look up each person's name.
  people.forEach((p) => {
    findAuthor(p.tag.slice(prefix.length)).then((author) => {
      if (!author) return;
      const rename = (list: Person[]) => list.map((x) => (x.tag === p.tag ? { ...x, name: author.name } : x));
      people = rename(people);
      committed = rename(committed);
      render();
    });
  });

  return {
    node: labelled(field.label, wrap, id),
    tags: () => people.map((p) => p.tag),
    display: () => people.map((p) => p.name).join(', '),
    committedTags: () => committed.map((p) => p.tag),
    commit: () => { committed = [...people]; },
    revert: () => {
      people = [...committed];
      render();
    },
  };
}
