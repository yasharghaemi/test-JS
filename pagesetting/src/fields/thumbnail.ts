import { deki } from '../api';
import { DEKI, THUMBNAIL_FILE, THUMBNAIL_WIDTHS } from '../config';
import { el } from '../dom';
import { resizeToWidth } from '../image';
import type { PageData, Save, SetStatus } from '../types';
import { enc } from '../util';

export interface ThumbnailControl {
  node: HTMLElement;
  /** Applies the article type's thumbnail rule (width, or no thumbnail). */
  setArticleType(tag: string): void;
}

export function thumbnailField(page: PageData, save: Save, setStatus: SetStatus): ThumbnailControl {
  const wrap = el('div', 'cps-thumb');
  const hint = el('span', 'cps-thumb-hint');
  const label = el('span', 'cps-label', 'Thumbnail');
  label.append(hint);
  wrap.append(label);

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
  // Target width for the current article type; null = this type has no thumbnail.
  let width: number | null = null;

  const show = (src: string) => {
    img.hidden = !src;
    if (src) img.src = src; else img.removeAttribute('src');
    text.hidden = !!src;
    remove.hidden = !src;
    pick.setAttribute('aria-label', src ? 'Change page thumbnail' : 'Add page thumbnail');
    applyRule();
  };
  // No thumbnail for this type: hide the field, unless an old one is left to remove.
  const applyRule = () => {
    wrap.hidden = !width && !current;
    pick.disabled = !width;
    hint.textContent = width ? ` (${width}px wide)` : ' (not used for this article type)';
  };
  show(current);

  const path = `/pages/${page.id}/files/=${enc(THUMBNAIL_FILE)}`;
  pick.addEventListener('click', () => { if (width) file.click(); });
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    file.value = '';
    if (!chosen || !width) return;
    if (!chosen.type.startsWith('image/')) return setStatus('Thumbnail must be an image.', 'error');
    let upload: Blob;
    try {
      upload = await resizeToWidth(chosen, width);
    } catch (err) {
      console.warn('[page-settings]', err);
      return setStatus("Couldn't read that image.", 'error');
    }
    const previous = current;
    show(URL.createObjectURL(upload));
    save(async () => {
      await deki('PUT', path, { body: upload, type: upload.type });
      current = `${DEKI}${path}?t=${Date.now()}`;
    }, () => { current = previous; show(previous); });
  });
  remove.addEventListener('click', () => {
    const previous = current;
    current = '';
    show('');
    save(() => deki('DELETE', path), () => { current = previous; show(previous); });
    if (!wrap.hidden) pick.focus();
  });

  return {
    node: wrap,
    setArticleType: (tag) => {
      width = THUMBNAIL_WIDTHS[tag] ?? null;
      applyRule();
    },
  };
}
