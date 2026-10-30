import { findAuthor } from '../authors';
import type { FieldConfig } from '../config';
import { el } from '../dom';
import type { FieldControl } from '../types';
import { authorSearch } from './authorSearch';

interface Person {
  tag: string;
  name: string;
}

interface Role {
  field: FieldConfig;
  people: Person[];
  committed: Person[];
  onChange(): void;
}

export interface PeopleTable {
  node: HTMLElement;
  /** Adds one role (a multi-person author field); returns its control for the panel. */
  addRole(field: FieldConfig, current: string[], onChange: () => void): FieldControl;
}

/**
 * Several multi-person roles shown as one table (group "layout": "table", e.g. Book
 * attribution): a row per role (Role | People), each person a badge with its own
 * remove button, and one add row below -
 * pick a role, search a person, and they're added. Tags are unchanged: one per
 * person, <role prefix><nameKey>. Each role still gets its own FieldControl, so the
 * panel saves, summarises and filters it like any other field.
 */
export function peopleTable(caption: string, idBase: string): PeopleTable {
  const roles: Role[] = [];
  const node = el('div', 'cps-people-table');

  const table = el('table');
  const cap = el('caption', 'cps-sr-only', caption);
  const head = el('tr');
  const thRole = el('th', null, 'Role');
  const thPeople = el('th', null, 'People');
  [thRole, thPeople].forEach((th) => th.setAttribute('scope', 'col'));
  head.append(thRole, thPeople);
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  table.append(cap, thead, tbody);

  // --- add row: role + person search ---
  const add = el('div', 'cps-people-add');
  const roleId = `${idBase}-role`;
  const roleWrap = el('div', 'cps-people-add-role');
  const roleLabel = el('label', 'cps-heading', 'Role');
  roleLabel.htmlFor = roleId;
  const roleSelect = el('select', 'cps-select');
  roleSelect.id = roleId;
  roleWrap.append(roleLabel, roleSelect);

  const searchId = `${idBase}-search`;
  const personWrap = el('div', 'cps-people-add-person');
  const personLabel = el('label', 'cps-heading', 'Person to add');
  personLabel.htmlFor = searchId;
  const combo = el('div', 'cps-combo');
  const announce = el('div', 'cps-sr-only');
  announce.setAttribute('aria-live', 'polite');
  const search = authorSearch({
    id: searchId,
    label: caption,
    onChoose: (author) => {
      search.input.value = '';
      const role = roles[roleSelect.selectedIndex];
      if (!role) return;
      const tag = role.field.prefix + author.nameKey;
      if (role.people.some((p) => p.tag === tag)) {
        announce.textContent = `${author.name} is already listed as ${role.field.label}`;
        return;
      }
      role.people = [...role.people, { tag, name: author.name }];
      render();
      announce.textContent = `${author.name} added as ${role.field.label}`;
      role.onChange();
    },
    onBlur: () => { search.input.value = ''; },
  });
  search.input.placeholder = 'Search a person to add…';
  combo.append(search.input, search.list, search.live);
  personWrap.append(personLabel, combo);
  add.append(roleWrap, personWrap);
  node.append(table, add, announce);

  // One row per role that has people (config order); each person is a badge with its
  // own remove button, in tag order.
  function render(focusButton?: number) {
    const rows: HTMLTableRowElement[] = [];
    const buttons: HTMLButtonElement[] = [];
    roles.filter((role) => role.people.length).forEach((role) => {
      const badges = el('ul', 'cps-people-badges');
      badges.setAttribute('aria-label', role.field.label);
      role.people.forEach((p) => {
        const remove = el('button', 'cps-chip-remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${p.name} as ${role.field.label}`);
        const at = buttons.push(remove) - 1;
        remove.addEventListener('click', () => {
          role.people = role.people.filter((x) => x.tag !== p.tag);
          render(at);
          announce.textContent = `${p.name} removed as ${role.field.label}`;
          role.onChange();
        });
        const badge = el('li', 'cps-chip');
        badge.append(remove, el('span', 'cps-chip-text', p.name));
        badges.append(badge);
      });
      const people = el('td', 'cps-people-name');
      people.append(badges);
      const tr = el('tr');
      tr.append(el('td', 'cps-people-role', role.field.label), people);
      rows.push(tr);
    });
    if (!rows.length) {
      const empty = el('td', 'cps-people-empty', 'No one credited yet.');
      empty.colSpan = 2;
      const tr = el('tr');
      tr.append(empty);
      rows.push(tr);
    }
    tbody.replaceChildren(...rows);
    // After a removal, keep keyboard focus nearby: the badge that took its place (or
    // the one before it), else the search box.
    if (focusButton !== undefined) {
      (buttons.length ? buttons[Math.min(focusButton, buttons.length - 1)] : search.input).focus();
    }
  }
  render();

  return {
    node,
    addRole(field, current, onChange) {
      const role: Role = {
        field,
        people: current.map((tag) => ({ tag, name: tag.slice(field.prefix.length) })),
        committed: [],
        onChange,
      };
      role.committed = [...role.people];
      roles.push(role);
      roleSelect.add(new Option(field.label, field.prefix));
      render();

      // Saved tags only carry the key: look up each person's name.
      role.people.forEach((p) => {
        findAuthor(p.tag.slice(field.prefix.length)).then((author) => {
          if (!author) return;
          const rename = (list: Person[]) => list.map((x) => (x.tag === p.tag ? { ...x, name: author.name } : x));
          role.people = rename(role.people);
          role.committed = rename(role.committed);
          render();
        });
      });

      // The panel places field nodes itself; this role's UI lives in the table, so
      // its own node is an empty, hidden placeholder.
      const placeholder = el('span');
      placeholder.hidden = true;
      return {
        node: placeholder,
        tags: () => role.people.map((p) => p.tag),
        display: () => role.people.map((p) => p.name).join(', '),
        committedTags: () => role.committed.map((p) => p.tag),
        commit: () => { role.committed = [...role.people]; },
        revert: () => {
          role.people = [...role.committed];
          render();
        },
      };
    },
  };
}
