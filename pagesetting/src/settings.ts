import { applySettings, currentSettings, type PanelView, type Settings } from './config';

/**
 * pagesetting.json is loaded at runtime from next to the script (the same jsDelivr
 * commit, the dev server, or the demo's dist/), so editing it changes the panel
 * without a rebuild. Each top-level key is checked on its own: a missing or invalid
 * key keeps the built-in value, and the problems are logged.
 */
export async function loadSettings(url: string, timeoutMs = 4000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { settings, problems } = validateSettings(await res.json(), currentSettings());
    problems.forEach((p) => console.warn(`[page-settings] ${url}: ${p}; using the built-in value`));
    applySettings(settings);
  } catch (err) {
    console.warn(`[page-settings] could not load ${url}; using the built-in settings`, err);
  } finally {
    clearTimeout(timer);
  }
}

const VIEWS: PanelView[] = ['full', 'editor', 'author'];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isPair = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(isString);
const isPairs = (v: unknown) => Array.isArray(v) && v.every(isPair);
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);
const isBool = (v: unknown) => typeof v === 'boolean';

/** Checks each key of `raw`; invalid or missing keys keep the value from `base`. */
export function validateSettings(raw: unknown, base: Settings): { settings: Settings; problems: string[] } {
  const problems: string[] = [];
  const settings: Settings = { ...base };
  if (!isObject(raw)) return { settings, problems: ['not a JSON object'] };

  // Returns the first problem in a list, naming the item, or '' if all are fine.
  const firstProblem = (list: unknown, check: (item: unknown) => string): string => {
    if (!Array.isArray(list)) return 'must be a list';
    for (let i = 0; i < list.length; i++) {
      const p = check(list[i]);
      if (p) return `item ${i + 1}: ${p}`;
    }
    return '';
  };
  const take = <K extends keyof Settings>(key: K, problem: string) => {
    if (raw[key] === undefined) return;
    if (problem) problems.push(`"${key}" ${problem}`);
    else settings[key] = raw[key] as Settings[K];
  };

  take('groups', firstProblem(raw.groups, (g) => {
    if (!isObject(g)) return 'must be an object';
    if (!isString(g.id) || !isString(g.title)) return 'needs "id" and "title" text';
    if (g.summary !== 'count' && g.summary !== 'values') return '"summary" must be "count" or "values"';
    if (!optional(g.open, isBool) || !optional(g.wide, isBool)) return '"open"/"wide" must be true or false';
    if (!optional(g.articleTypes, (t) => Array.isArray(t) && t.every(isString))) return '"articleTypes" must be a list of article tags';
    return '';
  }));

  const groupIds = new Set(settings.groups.map((g) => g.id));
  take('fields', firstProblem(raw.fields, (f) => {
    if (!isObject(f)) return 'must be an object';
    const name = isString(f.label) ? `"${f.label}"` : '';
    if (!isString(f.label) || !isString(f.prefix) || !f.prefix) return 'needs "label" and a non-empty "prefix"';
    if (!isPairs(f.options)) return `${name} "options" must be a list of ["tag", "label"] pairs`;
    if (!optional(f.type, (t) => t === 'select' || t === 'author' || t === 'license')) return `${name} "type" must be "select", "author" or "license"`;
    if (f.type === 'license' && !isString(f.versionPrefix)) return `${name} a license field needs "versionPrefix"`;
    if (!optional(f.group, (g) => isString(g) && groupIds.has(g))) return `${name} "group" must be one of the groups' ids`;
    if (!optional(f.detect, (d) => d === 'transclusion')) return `${name} "detect" must be "transclusion"`;
    if (f.multiple !== undefined && (f.type !== 'author' || !isBool(f.multiple))) return `${name} "multiple" must be true or false, on an "author" field`;
    for (const flag of ['askApplyToSubpages', 'forAuthors', 'hiddenForEditors']) {
      if (!optional(f[flag], isBool)) return `${name} "${flag}" must be true or false`;
    }
    return '';
  }));

  take('roleViews', isObject(raw.roleViews) && Object.values(raw.roleViews).every((v) => VIEWS.includes(v as PanelView))
    ? '' : `must map roles to one of ${VIEWS.join(', ')}`);
  take('defaultView', VIEWS.includes(raw.defaultView as PanelView) ? '' : `must be one of ${VIEWS.join(', ')}`);

  take('licenses', firstProblem(raw.licenses, (l) => {
    if (!isObject(l) || !isString(l.key) || !isString(l.text)) return 'needs "key" and "text"';
    if (!isPairs(l.versions)) return `"${l.key}" "versions" must be a list of ["key", "label"] pairs`;
    return '';
  }));

  take('thumbnailWidths', isObject(raw.thumbnailWidths)
    && Object.values(raw.thumbnailWidths).every((w) => typeof w === 'number' && w > 0)
    ? '' : 'must map article types to a width in px');
  take('transclusionMarkers', Array.isArray(raw.transclusionMarkers) && raw.transclusionMarkers.every((m) => isString(m) && m)
    ? '' : 'must be a list of non-empty texts');
  take('summaryMaxLength', Number.isInteger(raw.summaryMaxLength) && (raw.summaryMaxLength as number) > 0
    ? '' : 'must be a whole number above 0');

  // Fields may point at groups that were rejected above: drop that grouping.
  settings.fields = settings.fields.map((f) =>
    (f.group && !settings.groups.some((g) => g.id === f.group) ? { ...f, group: undefined } : f));
  return { settings, problems };
}
