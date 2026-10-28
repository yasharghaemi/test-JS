/**
 * Custom Page settings panel for the MindTouch editor.
 *
 * Replaces MindTouch's built-in Page settings (#mt-summary) with a panel built from
 * the data the PageSettings DekiScript template emits in #cps-data. Every change is
 * saved straight to the MindTouch API (page tags, the overview property and the
 * thumbnail file). #mt-summary itself is only hidden, because MindTouch builds the
 * subpage listing block into it later and the panel moves that block in.
 *
 * What the panel shows (sections, fields, options, role views, licenses, thumbnail
 * widths) comes from pagesetting.json - bundled as the default and re-read at runtime
 * (settings.ts). Each field stores its value as a page tag made of its prefix and
 * value, e.g. "article:topic" or "author@<authorKey>".
 */
import { FIELDS } from './config';
import { buildPanel } from './panel';
import { loadSettings } from './settings';
import type { PageData } from './types';

// pagesetting.json sits next to this script (jsDelivr commit, dev server or demo
// dist/); start loading it now so it's usually ready before #mt-summary appears.
const scriptBase = ((document.currentScript as HTMLScriptElement | null)?.src || '').replace(/[^/]*$/, '');
const settingsReady = scriptBase ? loadSettings(`${scriptBase}pagesetting.json`) : Promise.resolve();

// The editor renders #mt-summary on demand, so wait for both it and the data.
const tryMount = () => {
  const original = document.getElementById('mt-summary');
  const data = document.getElementById('cps-data');
  if (original && data && !data.dataset.cpsMounted) {
    data.dataset.cpsMounted = 'true';
    settingsReady.then(() => mount(original, data));
  }
};
new MutationObserver(tryMount).observe(document.documentElement, { childList: true, subtree: true });
tryMount();

// #cps-data holds the template's settings as a JSON object in its text.
function mount(original: HTMLElement, data: HTMLElement) {
  const settings = parseSettings(data.textContent || '');
  const page: PageData = {
    id: Number(settings.pageId) || 0,
    // The summary is loaded from the API by the summary field (fields/summary.ts).
    summary: '',
    thumbnail: plainText(settings.thumbnail),
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

// A text value from the template, or '' if it isn't real text: on some MindTouch
// versions a property like `.text` is a function, and json.emit writes it out as
// "function text() { [native code] }".
function plainText(value: unknown): string {
  return typeof value === 'string' && !/\[native code\]/.test(value) ? value : '';
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
