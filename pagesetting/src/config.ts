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
}

/**
 * How much of the panel a role sees:
 * - 'full': everything.
 * - 'editor': everything except Article type.
 * - 'author': only fields marked `forAuthors`.
 * Hidden parts are still built, so their tags keep being saved unchanged.
 */
export type PanelView = 'full' | 'editor' | 'author';

/** MindTouch role (lower case) -> view. Roles not listed get DEFAULT_VIEW. */
export const ROLE_VIEWS: Record<string, PanelView> = {
  admin: 'full',
  editor: 'editor',
  author: 'author',
};
export const DEFAULT_VIEW: PanelView = 'full';

/** A foldable section (card) of fields; its header summarises the fields. */
export interface GroupConfig {
  id: string;
  title: string;
  /** 'count' shows "· 3 of 7 set"; 'values' shows the chosen values, e.g. "· CC BY-SA 4.0". */
  summary: 'count' | 'values';
  /** Start unfolded (authors always see their sections unfolded). */
  open?: boolean;
}

// Sections in display order, below the thumbnail and summary and above the tags.
export const GROUPS: GroupConfig[] = [
  { id: 'type', title: 'Page type', summary: 'values', open: true },
  { id: 'display', title: 'Display & status', summary: 'values', open: true },
  { id: 'attribution', title: 'Attribution Manager', summary: 'count' },
  { id: 'license', title: 'License', summary: 'values' },
  { id: 'publishing', title: 'Publishing', summary: 'values' },
  { id: 'print', title: 'Print', summary: 'values' },
];

// One attribution role: a person search box saving `<prefix><nameKey>`.
const role = (label: string, prefix: string): FieldConfig => ({
  label, prefix, type: 'author', group: 'attribution', askApplyToSubpages: true, options: [],
});

// The panel's tag fields, in display order. The first tag matching a field's prefix
// is its value; any other matching tags stay in the tag list below.
// To add a field, copy an entry, e.g.
//   { label: 'Override', prefix: 'override:', options: [['override:yes', 'Yes']] },
export const FIELDS: FieldConfig[] = [
  {
    label: 'Article type', prefix: 'article:', group: 'type', hiddenForEditors: true, options: [
      ['article:topic-category', 'Book or Unit'],
      ['article:topic-guide', 'Chapter'],
      ['article:topic', 'Section or Page'],
      ['article:howto', 'N/A'],
      ['article:reference', 'N/A'],
    ],
  },
  {
    label: 'Stage', prefix: 'stage:', group: 'display', forAuthors: true, options: [
      ['stage:stub', 'Stub'], ['stage:draft', 'Draft'], ['stage:review', 'Review'],
      ['stage:final', 'Final'], ['stage:outdated', 'Outdated'], ['stage:obsolete', 'Obsolete'],
    ],
  },
  {
    label: 'Show Page TOC', prefix: 'showtoc:', group: 'display', forAuthors: true, askApplyToSubpages: true, options: [
      ['showtoc:yes', 'yes on page'], ['showtoc:no', 'no on page'],
    ],
  },
  {
    label: 'Autonumber Section Headings', prefix: 'autonumheader:', group: 'display', forAuthors: true, askApplyToSubpages: true, options: [
      ['autonumheader:yes1', 'title with space delimiters'],
      ['autonumheader:yes2', 'title with colon delimiters'],
      ['autonumheader:yes3', 'title with dash delimiters'],
    ],
  },
  {
    label: 'Override Autonumber', prefix: 'override:', group: 'display', options: [
      ['override:yes', 'yes'], ['override:no', 'no'],
    ],
  },
  // Publishing and print settings; options and labels match the site's own page settings.
  // askApplyToSubpages marks the ones the site applies to subpages.
  {
    label: 'Cover Page', prefix: 'coverpage:', group: 'publishing', options: [
      ['coverpage:yes', 'Set Cover Page/Add to Download Center'],
      ['coverpage:toc', 'Set Cover Page/Not in Download Center'],
    ],
  },
  {
    label: 'OER program or Publisher', prefix: 'program:', group: 'publishing', askApplyToSubpages: true, options: [
      ['program:ztccoc', 'College of the Canyons - Zero Textbook Cost Program'],
      ['program:oeri', 'ASCCC OERI Program'],
      ['program:ck12', 'CK-12'],
      ['program:openstax', 'OpenStax'],
      ['program:galileo', 'GALILEO'],
      ['program:opensuny', 'OpenSUNY'],
      ['program:mitocw', 'MIT OpenCourseWare'],
      ['program:virginiatech', "Virginia Tech Libraries' Open Education Initiative"],
      ['program:hidden', 'The Publisher Who Must Not Be Named'],
      ['program:ecampusontario', 'eCampusOntario'],
      ['program:wac', 'WAC Clearinghouse'],
      ['program:bcc', 'BC Campus'],
      ['program:lumen', 'Lumen'],
      ['program:openoregon', 'Open Oregon'],
      ['program:openstaxcnx', 'OpenStax CNX'],
      ['program:pdxopen', 'PDXOpen'],
      ['program:clc-innovators', 'CLC Innovators'],
    ],
  },
  {
    label: 'Transcluded', prefix: 'transcluded:', group: 'publishing', askApplyToSubpages: true, options: [
      ['transcluded:yes', 'yes'],
    ],
  },
  {
    label: 'Student Analytics', prefix: 'studentanalytics:', group: 'publishing', askApplyToSubpages: true, options: [
      ['studentanalytics:yes', 'yes'],
    ],
  },
  {
    label: 'Number of Print Columns', prefix: 'columns:', group: 'print', askApplyToSubpages: true, options: [
      ['columns:two', 'Two'], ['columns:three', 'Three'],
    ],
  },
  {
    label: 'PrintOptions', prefix: 'printoptions:', group: 'print', options: [
      ['printoptions:no-header', 'No Header/Footer'],
      ['printoptions:no-title', 'No Title'],
      ['printoptions:no-header-title', 'No Header/Footer/Title'],
    ],
  },
  {
    label: 'Print CSS', prefix: 'cssprint:', group: 'print', askApplyToSubpages: true, options: [
      ['cssprint:default', 'Default'], ['cssprint:dense', 'Dense'],
    ],
  },
  role('Author', 'author@'),
  role('Editor', 'editor@'),
  role('Remixer', 'remixer@'),
  role('Translator', 'translator@'),
  role('Contributor', 'contributor@'),
  role('Illustrator', 'illustrator@'),
  role('Reviewer', 'reviewedBy@'),
  {
    label: 'License', prefix: 'license:', versionPrefix: 'licenseversion:', type: 'license',
    group: 'license', askApplyToSubpages: true, forAuthors: true, options: [],
  },
];

/** Every tag prefix a field owns: its own, plus the version prefix for a license field. */
export function fieldPrefixes(field: FieldConfig): string[] {
  return field.versionPrefix ? [field.prefix, field.versionPrefix] : [field.prefix];
}

export interface LicenseOption {
  /** Saved as license:<key>. */
  key: string;
  text: string;
  /** [key, label] pairs, oldest first; saved as licenseversion:<key>. Empty = no versions. */
  versions: Array<[string, string]>;
}

const CC_VERSIONS: Array<[string, string]> = [['10', '1.0'], ['20', '2.0'], ['25', '2.5'], ['30', '3.0'], ['40', '4.0']];

// Licenses and the versions each one allows.
export const LICENSES: LicenseOption[] = [
  { key: 'arr', text: 'All Rights Reserved', versions: [] },
  { key: 'ccby', text: 'CC BY', versions: CC_VERSIONS },
  { key: 'ccbync', text: 'CC BY-NC', versions: CC_VERSIONS },
  { key: 'ccbyncnd', text: 'CC BY-NC-ND', versions: CC_VERSIONS },
  { key: 'ccbyncsa', text: 'CC BY-NC-SA', versions: CC_VERSIONS },
  { key: 'ccbynd', text: 'CC BY-ND', versions: CC_VERSIONS },
  { key: 'ccbysa', text: 'CC BY-SA', versions: CC_VERSIONS },
  { key: 'gnu', text: 'GNU', versions: [] },
  { key: 'gnudsl', text: 'GNU DSL', versions: [['10', '1.0']] },
  { key: 'gnufdl', text: 'GNU FDL', versions: [['11', '1.1'], ['12', '1.2'], ['13', '1.3']] },
  { key: 'gnugpl', text: 'GNU GPL', versions: [['10', '1.0'], ['20', '2.0'], ['30', '3.0']] },
  { key: 'publicdomain', text: 'Public Domain', versions: [] },
  { key: 'ck12', text: 'CK-12 License', versions: [] },
  { key: 'mixed', text: 'Multiple Licenses', versions: [] },
];

// Thumbnail width (px) per article type; uploads are scaled down to it. Article types
// not listed don't use a thumbnail.
export const THUMBNAIL_WIDTHS: Record<string, number> = {
  'article:topic-category': 500, // Book or Unit
  'article:topic-guide': 250, // Chapter
};

export const TAG_SAVE_DELAY_MS = 600;
export const SUMMARY_SAVE_DELAY_MS = 1500;
export const AUTHOR_LIMIT = 10;
export const AUTHOR_MIN_CHARS = 2;
export const AUTHOR_DEBOUNCE_MS = 250;
/** How many subpages are updated at once when applying a field to subpages. */
export const SUBPAGE_CONCURRENCY = 4;
