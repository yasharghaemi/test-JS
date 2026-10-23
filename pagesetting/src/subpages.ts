import { getDescendantIds, replaceFieldTag } from './api';
import { SUBPAGE_CONCURRENCY, type FieldConfig } from './config';
import { confirmDialog } from './dialog';
import type { FieldControl, SetStatus } from './types';
import { runPool } from './util';

const descendantsCache = new Map<number, Promise<string[]>>();
// Offers run one after another, so changing two fields quickly shows one dialog at a time.
let offers: Promise<void> = Promise.resolve();

function descendants(pageId: number): Promise<string[]> {
  let ids = descendantsCache.get(pageId);
  if (!ids) {
    ids = getDescendantIds(pageId);
    descendantsCache.set(pageId, ids);
    ids.catch(() => descendantsCache.delete(pageId)); // retry next time
  }
  return ids;
}

/**
 * After a field changes, asks whether to give every subpage the same value and,
 * if so, updates them. Does nothing when the page has no subpages.
 */
export function offerApplyToSubpages(
  pageId: number,
  field: FieldConfig,
  control: FieldControl,
  setStatus: SetStatus,
): Promise<void> {
  const tag = control.value();
  offers = offers.then(() => offer(pageId, field, control, setStatus, tag));
  return offers;
}

async function offer(
  pageId: number,
  field: FieldConfig,
  control: FieldControl,
  setStatus: SetStatus,
  tag: string,
): Promise<void> {
  // The value changed again while this offer waited its turn; that change asks.
  if (control.value() !== tag) return;
  let ids: string[];
  try {
    ids = await descendants(pageId);
  } catch (err) {
    console.warn('[page-settings] could not list subpages', err);
    return;
  }
  // Nothing to ask, or the value changed again while the list loaded (that change asks).
  if (!ids.length || control.value() !== tag) return;

  const label = field.label.toLowerCase();
  const pages = `${ids.length} subpage${ids.length === 1 ? '' : 's'}`;
  const apply = await confirmDialog(tag
    ? {
      title: `Apply ${label} to subpages?`,
      message: `This page has ${pages}. Set their ${label} to “${control.display()}” too?`,
      confirmText: `Apply to ${pages}`,
      cancelText: 'Only this page',
    }
    : {
      title: `Clear ${label} on subpages?`,
      message: `This page has ${pages}. Clear their ${label} too?`,
      confirmText: `Clear on ${pages}`,
      cancelText: 'Only this page',
    });
  if (!apply) return;

  let done = 0;
  const failed: string[] = [];
  setStatus(`Updating subpages 0/${ids.length}…`);
  await runPool(ids, SUBPAGE_CONCURRENCY, async (id) => {
    try {
      await replaceFieldTag(id, field.prefix, tag);
    } catch (err) {
      failed.push(id);
      console.warn(`[page-settings] could not update subpage ${id}`, err);
    }
    done++;
    setStatus(`Updating subpages ${done}/${ids.length}…`);
  });
  if (failed.length) {
    setStatus(`Updated ${ids.length - failed.length} of ${pages}; ${failed.length} failed.`, 'error');
  } else {
    setStatus(`Updated ${pages}.`, 'ok');
  }
}
