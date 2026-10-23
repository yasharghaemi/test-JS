// MindTouch API calls. No auth token is put in the page: the signed-in user's
// session cookie, sent via credentials: 'same-origin', authenticates them.
import { DEKI, DEKI_HEADERS, OVERVIEW_PROPERTY } from './config';
import { enc, hasPrefix } from './util';

interface RequestOptions {
  body?: BodyInit;
  type?: string;
  headers?: Record<string, string>;
}

export async function deki(method: string, path: string, { body, type, headers }: RequestOptions = {}): Promise<Response> {
  const res = await fetch(DEKI + path, {
    method,
    body,
    credentials: 'same-origin',
    headers: { ...DEKI_HEADERS, ...(type ? { 'Content-Type': type } : {}), ...headers },
  });
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
  return res;
}

async function dekiJson(path: string): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?';
  return (await deki('GET', `${path}${sep}dream.out.format=json`)).json();
}

/** MindTouch JSON gives a single object instead of a one-item array. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

export async function getTags(pageId: number | string): Promise<string[]> {
  const data = (await dekiJson(`/pages/${pageId}/tags`)) as { tag?: Array<{ '@value'?: string }> | { '@value'?: string } };
  return asArray(data.tag).map((t) => t['@value'] || '').filter(Boolean);
}

export function putTags(pageId: number | string, tags: string[]): Promise<Response> {
  const doc = document.implementation.createDocument(null, 'tags', null);
  tags.forEach((tag) => {
    const node = doc.createElement('tag');
    node.setAttribute('value', tag);
    doc.documentElement.appendChild(node);
  });
  return deki('PUT', `/pages/${pageId}/tags`, {
    body: new XMLSerializer().serializeToString(doc),
    type: 'application/xml',
  });
}

/**
 * Sets a page's field tag the way the panel would: replaces the first tag with
 * `prefix` by `tag`, adds `tag` if none matched, or removes it when `tag` is ''.
 */
export async function replaceFieldTag(pageId: number | string, prefix: string, tag: string): Promise<void> {
  const tags = await getTags(pageId);
  const i = tags.findIndex((t) => hasPrefix(t, prefix));
  if (i >= 0) {
    if (tags[i] === tag) return;
    if (tag) tags.splice(i, 1, tag); else tags.splice(i, 1);
  } else {
    if (!tag) return;
    tags.push(tag);
  }
  await putTags(pageId, [...new Set(tags)]);
}

// Updating an existing property needs its current ETag; a new one doesn't.
export async function putOverview(pageId: number, text: string): Promise<Response> {
  const path = `/pages/${pageId}/properties/${enc(OVERVIEW_PROPERTY)}`;
  const current = await fetch(DEKI + path, { credentials: 'same-origin', headers: DEKI_HEADERS });
  const etag = current.ok ? current.headers.get('ETag') : null;
  return deki('PUT', path, {
    body: text,
    type: 'text/plain; charset=utf-8',
    headers: etag ? { ETag: etag } : {},
  });
}

/** IDs of every page below pageId, at any depth. */
export async function getDescendantIds(pageId: number): Promise<string[]> {
  const ids = new Set<string>();
  collectPageIds(await dekiJson(`/pages/${pageId}/tree`), ids);
  ids.delete(String(pageId));
  return [...ids];
}

// The tree comes back as nested page objects under "page", "subpages" or
// "page.subpage" keys, each a single object or an array; take every "@id".
function collectPageIds(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectPageIds(n, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj['@id'] != null) out.add(String(obj['@id']));
  for (const key of ['page', 'pages', 'subpages', 'page.subpage']) {
    if (key in obj) collectPageIds(obj[key], out);
  }
}
