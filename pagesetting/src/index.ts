/**
 * Custom Page settings panel for the MindTouch editor.
 *
 * Replaces MindTouch's built-in Page settings (#mt-summary) with a panel built from
 * the data the PageSettings DekiScript template emits in #cps-data. Every change is
 * saved straight to the MindTouch API (page tags, the overview property and the
 * thumbnail file). #mt-summary itself is only hidden, because MindTouch builds the
 * subpage listing block into it later and the panel moves that block in.
 *
 * The tag fields (Article type, Author, ...) are defined in FIELDS in config.ts.
 * Each field stores its value as a page tag made of its prefix and value, e.g.
 * "article:topic" or "author@<authorKey>".
 */
import { FIELDS } from './config';
import { buildPanel } from './panel';
import type { PageData } from './types';

// The editor renders #mt-summary on demand, so wait for both it and the data.
const tryMount = () => {
  const original = document.getElementById('mt-summary');
  const data = document.getElementById('cps-data');
  if (original && data && !data.dataset.cpsMounted) {
    data.dataset.cpsMounted = 'true';
    mount(original, data);
  }
};
new MutationObserver(tryMount).observe(document.documentElement, { childList: true, subtree: true });
tryMount();

// #cps-data holds the template's settings as a JSON object in its text.
function mount(original: HTMLElement, data: HTMLElement) {
  const settings = parseSettings(data.textContent || '');
  const page: PageData = {
    id: Number(settings.pageId) || 0,
    summary: String(settings.summary || ''),
    thumbnail: String(settings.thumbnail || ''),
    tags: Array.isArray(settings.tags) ? settings.tags.map(String).filter(Boolean) : [],
    userRole: String(settings.userRole || ''),
  };
  // #mt-summary is hidden, not removed: MindTouch builds its listing block into it
  // after it appears, and the panel moves that block in (see fields/listing.ts).
  original.before(buildPanel(page, FIELDS, original));
  // Hide MindTouch's panel for good: the cps-active rule in pagesetting.css hides
  // #mt-summary with !important, even if MindTouch restyles or rebuilds it. It only
  // applies once our panel exists, so a failed load leaves MindTouch's panel usable.
  document.documentElement.classList.add('cps-active');
  const hide = () => {
    if (original.style.display === 'none' && original.style.getPropertyPriority('display') === 'important') return;
    original.style.setProperty('display', 'none', 'important');
  };
  hide();
  // ...and if MindTouch sets an inline style of its own (even !important), hide again.
  new MutationObserver(hide).observe(original, { attributes: true, attributeFilter: ['style'] });
  original.setAttribute('aria-hidden', 'true');
}

function parseSettings(json: string): Record<string, unknown> {
  try {
    const settings = JSON.parse(json.trim() || '{}');
    return settings && typeof settings === 'object' ? settings : {};
  } catch (err) {
    console.warn('[page-settings] could not read page settings', err);
    return {};
  }
}
