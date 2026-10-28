import bundledSettings from '../pagesetting.json';

export const DEKI = '/@api/deki';
export const DEKI_HEADERS: Record<string, string> = {
  'X-Deki-Client': 'mindtouch-martian',
  'X-Deki-Requested-With': 'XMLHttpRequest',
};
export const AUTHORS_API = 'https://knitcanvas.fun/api/v1/authors/search';
export const OVERVIEW_PROPERTY = 'mindtouch.page#overview';
export const THUMBNAIL_FILE = 'mindtouch.page#thumbnail';
export const NOT_SET = 'not-set';
export const ARTICLE_PREFIX = 'article:';

/**
 * Article types that have a subpage listing display (Book or Unit: Simple/Detailed;
 * Chapter: Single/Tabbed). The control itself is MindTouch's own block, moved out of
 * #mt-summary (see fields/listing.ts).
 */
export const LISTING_TYPES = ['article:topic-category', 'article:topic-guide'];
/** MindTouch's listing block inside #mt-summary. */
export const LISTING_BLOCK_SELECTOR = '.mt-ordered-subpage-listing-type-container';

export interface FieldConfig {
  label: string;
  /** Tag prefix including its separator, e.g. "article:" or "author@". */
  prefix: string;
  /**
   * 'author' makes the field the author search box; 'license' makes it the license +
   * version pair (see LICENSES); anything else is a select.
   */
  type?: 'select' | 'author' | 'license';
  /** License fields only: prefix of the version tag, e.g. "licenseversion:". */
  versionPrefix?: string;
  /** [tag, label] pairs; each tag starts with `prefix`. For an author field they just name known authors. */
  options: Array<[string, string]>;
  /** Confirm each change before saving, with an option to apply it to every subpage. */
  askApplyToSubpages?: boolean;
  /** Id of a GROUPS entry: puts the field in that foldable section instead of the main row. */
  group?: string;
  /** Shown in the 'author' view, which shows only these fields. */
  forAuthors?: boolean;
  /** Hidden in the 'editor' view. */
  hiddenForEditors?: boolean;
  /**
   * 'transclusion': the value is set automatically, not by people - "yes" if the
   * page's source contains one of the transclusionMarkers, otherwise not set.
   */
  detect?: 'transclusion';
}

/**
 * How much of the panel a role sees:
 * - 'full': everything.
 * - 'editor': everything except Article type.
 * - 'author': only fields marked `forAuthors`.
 * Hidden parts are still built, so their tags keep being saved unchanged.
 */
export type PanelView = 'full' | 'editor' | 'author';

/** A foldable section (card) of fields; its header summarises the fields. */
export interface GroupConfig {
  id: string;
  title: string;
  /** 'count' shows "· 3 of 7 set"; 'values' shows the chosen values, e.g. "· CC BY-SA 4.0". */
  summary: 'count' | 'values';
  /** Start unfolded (authors always see their sections unfolded). */
  open?: boolean;
  /** Span the full width; other cards pair up two-across on wide screens. */
  wide?: boolean;
}

export interface LicenseOption {
  /** Saved as license:<key>. */
  key: string;
  text: string;
  /** [key, label] pairs, oldest first; saved as licenseversion:<key>. Empty = no versions. */
  versions: Array<[string, string]>;
}

/**
 * What the panel shows, from pagesetting.json (see settings.ts):
 * - groups: sections in display order. List narrow cards in pairs between wide ones
 *   so they sit side by side on wide screens.
 * - fields: tag fields in display order. A field's value is the first page tag
 *   starting with its prefix; other matching tags stay in the tag list.
 * - roleViews / defaultView: MindTouch role (lower case) -> view; others get defaultView.
 * - licenses: licenses and the versions each allows.
 * - thumbnailWidths: thumbnail width (px) per article type; types not listed have none.
 * - transclusionMarkers: text that marks a page's source as transcluded (for fields
 *   with "detect": "transclusion"), matched case-insensitively.
 * - summaryMaxLength: most characters the summary may have (MindTouch allows 500).
 */
export interface Settings {
  groups: GroupConfig[];
  fields: FieldConfig[];
  roleViews: Record<string, PanelView>;
  defaultView: PanelView;
  licenses: LicenseOption[];
  thumbnailWidths: Record<string, number>;
  transclusionMarkers: string[];
  summaryMaxLength: number;
}

// The settings in use. They start as pagesetting.json as it was at build time, and
// applySettings() swaps in the runtime copy before the panel is built. These are live
// bindings, so importers always see the current values.
const bundled = bundledSettings as unknown as Settings;
export let GROUPS: GroupConfig[] = bundled.groups;
export let FIELDS: FieldConfig[] = bundled.fields;
export let ROLE_VIEWS: Record<string, PanelView> = bundled.roleViews;
export let DEFAULT_VIEW: PanelView = bundled.defaultView;
export let LICENSES: LicenseOption[] = bundled.licenses;
export let THUMBNAIL_WIDTHS: Record<string, number> = bundled.thumbnailWidths;
export let TRANSCLUSION_MARKERS: string[] = bundled.transclusionMarkers;
export let SUMMARY_MAX_LENGTH: number = bundled.summaryMaxLength;

export function currentSettings(): Settings {
  return { groups: GROUPS, fields: FIELDS, roleViews: ROLE_VIEWS, defaultView: DEFAULT_VIEW, licenses: LICENSES, thumbnailWidths: THUMBNAIL_WIDTHS, transclusionMarkers: TRANSCLUSION_MARKERS, summaryMaxLength: SUMMARY_MAX_LENGTH };
}

export function applySettings(s: Settings): void {
  GROUPS = s.groups;
  FIELDS = s.fields;
  ROLE_VIEWS = s.roleViews;
  DEFAULT_VIEW = s.defaultView;
  LICENSES = s.licenses;
  THUMBNAIL_WIDTHS = s.thumbnailWidths;
  TRANSCLUSION_MARKERS = s.transclusionMarkers;
  SUMMARY_MAX_LENGTH = s.summaryMaxLength;
}

/** Every tag prefix a field owns: its own, plus the version prefix for a license field. */
export function fieldPrefixes(field: FieldConfig): string[] {
  return field.versionPrefix ? [field.prefix, field.versionPrefix] : [field.prefix];
}

/** localStorage key remembering which cards each person had open (per browser). */
export const OPEN_STATE_KEY = 'cps-open-groups';

export const TAG_SAVE_DELAY_MS = 600;
export const SUMMARY_SAVE_DELAY_MS = 1500;
export const AUTHOR_LIMIT = 10;
export const AUTHOR_MIN_CHARS = 2;
export const AUTHOR_DEBOUNCE_MS = 250;
/** How many subpages are updated at once when applying a field to subpages. */
export const SUBPAGE_CONCURRENCY = 4;
