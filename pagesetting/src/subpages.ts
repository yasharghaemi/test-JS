import { getDescendantIds, replaceFieldTags } from './api';
import { SUBPAGE_CONCURRENCY, fieldPrefixes, type FieldConfig } from './config';
import { confirmDialog } from './dialog';
import type { FieldControl, SaveResult } from './types';
import { runPool } from './util';

const descendantsCache = new Map<number, Promise<string[]>>();
// Confirmations run one after another, so changing two fields quickly shows one dialog at a time.
let confirmations: Promise<unknown> = Promise.resolve();

function descendants(pageId: number): Promise<string[]> {
  let ids = descendantsCache.get(pageId);
  if (!ids) {
    ids = getDescendantIds(pageId);
    descendantsCache.set(pageId, ids);
    ids.catch(() => descendantsCache.delete(pageId)); // retry next time
  }
  return ids;
}

export interface ChangeDecision {
  confirmed: boolean;
  /** Subpages to give the same value; empty unless the user ticked the box. */
  subpageIds: string[];
}

/**
 * Asks the user to confirm a field change. When the page has subpages the dialog
 * also offers to apply the change to all of them. Resolves null when the field was
 * changed again before its turn came (that later change asks instead).
 */
export function confirmFieldChange(pageId: number, field: FieldConfig, control: FieldControl): Promise<ChangeDecision | null> {
  const shown = snapshot(control);
  const result = confirmations.then(() => ask(pageId, field, control, shown));
  confirmations = result.catch(() => undefined);
  return result;
}

const snapshot = (control: FieldControl) => control.tags().join('\n');

async function ask(pageId: number, field: FieldConfig, control: FieldControl, shown: string): Promise<ChangeDecision | null> {
  if (snapshot(control) !== shown) return null;
  let ids: string[] = [];
  try {
    ids = await descendants(pageId);
  } catch (err) {
    console.warn('[page-settings] could not list subpages', err); // still confirm, without the option
  }
  if (snapshot(control) !== shown) return null;

  const label = field.label.toLowerCase();
  const pages = `${ids.length} subpage${ids.length === 1 ? '' : 's'}`;
  const { confirmed, checked } = await confirmDialog({
    title: `Change ${label}?`,
    message: shown ? `Set the ${label} of this page to “${control.display()}”.` : `Clear the ${label} of this page.`,
    confirmText: 'Save',
    cancelText: 'Cancel',
    checkbox: ids.length ? `Also apply to the ${pages} under this page` : undefined,
  });
  return { confirmed, subpageIds: confirmed && checked ? ids : [] };
}

/** Gives every listed subpage the field's tags (clearing any the field no longer has). */
export async function applyToSubpages(ids: string[], field: FieldConfig, tags: string[], onProgress: (text: string) => void): Promise<SaveResult> {
  const pages = `${ids.length} subpage${ids.length === 1 ? '' : 's'}`;
  let done = 0;
  let failed = 0;
  onProgress(`Updating subpages 0/${ids.length}…`);
  await runPool(ids, SUBPAGE_CONCURRENCY, async (id) => {
    try {
      await replaceFieldTags(id, fieldPrefixes(field), tags);
    } catch (err) {
      failed++;
      console.warn(`[page-settings] could not update subpage ${id}`, err);
    }
    done++;
    onProgress(`Updating subpages ${done}/${ids.length}…`);
  });
  return failed
    ? { text: `Saved. Updated ${ids.length - failed} of ${pages}; ${failed} failed.`, kind: 'error' }
    : { text: `Saved, and updated ${pages}.`, kind: 'ok' };
}
