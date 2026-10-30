export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string | null,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function setAttrs(node: Element, attrs: Record<string, string>): void {
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
}

export function labelled(text: string, control: HTMLElement, id: string): HTMLDivElement {
  const wrap = el('div', 'cps-field');
  const label = el('label', 'cps-heading', `${text}:`);
  label.htmlFor = id;
  wrap.append(label, control);
  return wrap;
}

/**
 * A badge's text as a link to the site's search for pages with that tag, e.g.
 * /Special:Search?tags=translator%40yashar-ghaemi&type=wiki&query=. Opens in a new tab
 * so unsaved edits in the editor aren't lost; screen readers are told so.
 */
export function tagLink(tag: string, text: string): HTMLAnchorElement {
  const link = el('a', 'cps-chip-text cps-chip-link', text);
  link.href = `${location.origin}/Special:Search?tags=${encodeURIComponent(tag)}&type=wiki&query=`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.append(el('span', 'cps-sr-only', ' (search pages with this tag, opens in a new tab)'));
  return link;
}
