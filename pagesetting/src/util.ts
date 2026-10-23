// MindTouch wants names with "#" double-encoded in API paths (# -> %2523).
export function enc(name: string): string {
  return encodeURIComponent(encodeURIComponent(name));
}

export function hasPrefix(tag: string, prefix: string): boolean {
  return tag.toLowerCase().startsWith(prefix.toLowerCase());
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Runs fn over items with at most `limit` running at once. */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
