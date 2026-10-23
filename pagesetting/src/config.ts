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
export const GUIDE_TAG = 'article:topic-guide';
// Tag added when a guide is set to "Tabbed". Check what your site uses and change it here.
export const GUIDE_TABBED_TAG = 'guide:tabbed';

export interface FieldConfig {
  label: string;
  /** Tag prefix including its separator, e.g. "article:" or "author@". */
  prefix: string;
  /** 'author' makes the field the author search box; anything else is a select. */
  type?: 'select' | 'author';
  /** [tag, label] pairs; each tag starts with `prefix`. For an author field they just name known authors. */
  options: Array<[string, string]>;
  /** After a change, offer to apply the same value to every subpage. */
  askApplyToSubpages?: boolean;
  /** 'attribution' puts the field in the foldable Attribution Manager instead of the main row. */
  group?: 'attribution';
}

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
    label: 'Article type', prefix: 'article:', options: [
      ['article:topic', 'Topic'], ['article:topic-guide', 'Guide'],
      ['article:topic-category', 'Category'],
    ],
  },
  role('Author', 'author@'),
  role('Editor', 'editor@'),
  role('Remixer', 'remixer@'),
  role('Translator', 'translator@'),
  role('Contributor', 'contributor@'),
  role('Illustrator', 'illustrator@'),
  role('Reviewer', 'reviewedBy@'),
];

export const TAG_SAVE_DELAY_MS = 600;
export const SUMMARY_SAVE_DELAY_MS = 1500;
export const AUTHOR_LIMIT = 10;
export const AUTHOR_MIN_CHARS = 2;
export const AUTHOR_DEBOUNCE_MS = 250;
/** How many subpages are updated at once when applying a field to subpages. */
export const SUBPAGE_CONCURRENCY = 4;
