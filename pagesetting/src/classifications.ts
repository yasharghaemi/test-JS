import { NOT_SET } from './config';

/** Classification options by tag prefix (lower case, with ":"), e.g. "stage:". */
export type Classifications = Map<string, Array<[string, string]>>;

/**
 * Reads the site's classification options from MindTouch's own (hidden) Page settings
 * panel, which renders one <select data-prefix="..."> per classification. Fields use
 * these instead of the options in config.ts when their prefix is found here.
 */
export function readClassifications(root: ParentNode | null): Classifications {
  const map: Classifications = new Map();
  root?.querySelectorAll<HTMLSelectElement>('select[data-prefix]').forEach((select) => {
    const options = Array.from(select.options)
      .filter((o) => o.value && o.value !== NOT_SET)
      .map((o): [string, string] => [o.value, (o.textContent || '').trim()]);
    if (options.length) map.set(`${select.dataset.prefix}:`.toLowerCase(), options);
  });
  return map;
}

/** Same options in the same order? (Avoids rebuilding a select for nothing.) */
export function sameOptions(a: Array<[string, string]>, b: Array<[string, string]>): boolean {
  return a.length === b.length && a.every(([v, t], i) => v === b[i][0] && t === b[i][1]);
}
