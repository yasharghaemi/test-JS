import { LISTING_BLOCK_SELECTOR, LISTING_TYPES } from '../config';
import { el } from '../dom';

export interface ListingControl {
  node: HTMLElement;
  /** Shows the listing display if it applies to this article type ('' hides it). */
  setArticleType(tag: string): void;
}

/**
 * MindTouch's own subpage listing block (".mt-ordered-subpage-listing-type-container":
 * Simple/Detailed for a Book or Unit, Single/Tabbed with #mt-current-guide-display for
 * a Chapter), moved here from #mt-summary so its built-in behaviour and saving keep
 * working. MindTouch builds it after #mt-summary appears, so `source` (the hidden
 * #mt-summary) is watched and the block is moved in whenever it shows up.
 * It only exists for the article type the page had when the editor opened; after
 * switching to another listing type, a note asks to reopen.
 */
export function listingField(
  source: HTMLElement | null,
  articleTypeAtLoad: string,
  /** Called whenever its visibility may have changed (e.g. the block arrived late). */
  onUpdate: () => void,
): ListingControl {
  const node = el('div', 'cps-listings');
  const note = el('p', 'cps-note', 'Save the page and reopen the editor to set the listing display for this article type.');
  node.append(note);

  let block: HTMLElement | null = null;
  let tag = '';
  const apply = () => {
    const atLoadType = !!tag && tag === articleTypeAtLoad;
    if (block) block.hidden = !atLoadType;
    // While MindTouch hasn't built the block yet, show nothing rather than the note.
    note.hidden = atLoadType || !LISTING_TYPES.includes(tag);
    node.hidden = !(atLoadType && block) && note.hidden;
    onUpdate();
  };

  const adopt = () => {
    const found = source?.querySelector<HTMLElement>(LISTING_BLOCK_SELECTOR);
    if (!found) return;
    block?.remove(); // MindTouch rebuilt it: use the new one
    block = found;
    node.prepend(found);
    apply();
  };
  if (source) {
    adopt();
    new MutationObserver(adopt).observe(source, { childList: true, subtree: true });
  }

  return {
    node,
    setArticleType: (t) => {
      tag = t;
      apply();
    },
  };
}
