import { el } from '../dom';

/** Free-form tag chips. Mutates `tags` in place and calls onChange after each edit. */
export function tagsField(tags: string[], onChange: () => void): HTMLElement {
  const wrap = el('div', 'cps-tags');
  const label = el('label', 'cps-heading', 'Tags');
  label.htmlFor = 'cps-tag-input';
  const adder = el('div', 'cps-tag-adder');
  const plus = el('span', 'cps-tag-plus', '+');
  plus.setAttribute('aria-hidden', 'true');
  const input = el('input', 'cps-tag-input');
  Object.assign(input, { id: 'cps-tag-input', type: 'text', autocomplete: 'off', placeholder: 'Add new tag here' });
  adder.append(plus, input);
  const list = el('ul', 'cps-chips');
  list.setAttribute('aria-label', 'Page tags');
  wrap.append(label, adder, list);

  const render = () => {
    list.replaceChildren(...tags.map((tag) => {
      const li = el('li', 'cps-chip');
      const remove = el('button', 'cps-chip-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove tag ${tag}`);
      remove.addEventListener('click', () => {
        tags.splice(tags.indexOf(tag), 1);
        render();
        onChange();
        input.focus();
      });
      li.append(remove, el('span', 'cps-chip-text', tag));
      return li;
    }));
  };

  // Accepts "a, b, c" so pasted lists become separate tags.
  const addFromInput = () => {
    const added = input.value.split(',').map((t) => t.trim()).filter((t) =>
      t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()));
    input.value = '';
    if (!added.length) return;
    tags.push(...new Set(added));
    render();
    onChange();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFromInput();
    }
  });
  input.addEventListener('blur', addFromInput);

  render();
  return wrap;
}
