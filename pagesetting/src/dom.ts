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
