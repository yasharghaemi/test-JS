// Authors API: GET https://knitcanvas.fun/api/v1/authors/search?q=<query>&limit=<n>
//   -> { err: false, authors: [{ nameKey, name, nameURL, campusName, isGroup }] }
import { AUTHORS_API, AUTHOR_LIMIT } from './config';
import type { Author } from './types';

export async function searchAuthors(q: string, signal?: AbortSignal): Promise<Author[]> {
  const res = await fetch(`${AUTHORS_API}?q=${encodeURIComponent(q)}&limit=${AUTHOR_LIMIT}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.err) throw new Error('API returned err');
  return Array.isArray(data.authors) ? data.authors.filter((a: Author) => a && a.nameKey) : [];
}

export async function findAuthor(key: string): Promise<Author | null> {
  try {
    return (await searchAuthors(key)).find((a) => a.nameKey === key) || null;
  } catch (err) {
    console.warn('[page-settings] could not resolve saved author', err);
    return null;
  }
}
