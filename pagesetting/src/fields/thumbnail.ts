import { deki } from '../api';
import { DEKI, THUMBNAIL_FILE } from '../config';
import { el } from '../dom';
import type { PageData, Save, SetStatus } from '../types';
import { enc } from '../util';

export function thumbnailField(page: PageData, save: Save, setStatus: SetStatus): HTMLElement {
  const wrap = el('div', 'cps-thumb');
  wrap.append(el('span', 'cps-label', 'Thumbnail'));

  const box = el('div', 'cps-thumb-box');
  const pick = el('button', 'cps-thumb-pick');
  pick.type = 'button';
  const img = el('img', 'cps-thumb-img');
  img.alt = '';
  const text = el('span', 'cps-thumb-text', 'Add page thumbnail');
  pick.append(img, text);
  const remove = el('button', 'cps-thumb-remove', '×');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove thumbnail');
  const file = el('input');
  Object.assign(file, { type: 'file', accept: 'image/*', hidden: true });
  box.append(pick, remove, file);
  wrap.append(box);

  let current = page.thumbnail;
  const show = (src: string) => {
    img.hidden = !src;
    if (src) img.src = src; else img.removeAttribute('src');
    text.hidden = !!src;
    remove.hidden = !src;
    pick.setAttribute('aria-label', src ? 'Change page thumbnail' : 'Add page thumbnail');
  };
  show(current);

  const path = `/pages/${page.id}/files/=${enc(THUMBNAIL_FILE)}`;
  pick.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const chosen = file.files && file.files[0];
    file.value = '';
    if (!chosen) return;
    if (!chosen.type.startsWith('image/')) return setStatus('Thumbnail must be an image.', 'error');
    const previous = current;
    show(URL.createObjectURL(chosen));
    save(async () => {
      await deki('PUT', path, { body: chosen, type: chosen.type });
      current = `${DEKI}${path}?t=${Date.now()}`;
    }, () => show(previous));
  });
  remove.addEventListener('click', () => {
    const previous = current;
    show('');
    save(async () => {
      await deki('DELETE', path);
      current = '';
    }, () => show(previous));
    pick.focus();
  });
  return wrap;
}
