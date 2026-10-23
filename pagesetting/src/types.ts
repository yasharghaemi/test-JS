export interface PageData {
  id: number;
  summary: string;
  thumbnail: string;
  tags: string[];
}

export interface Author {
  nameKey: string;
  name: string;
  nameURL?: string;
  campusName?: string;
  isGroup?: boolean;
}

/** A tag field's control as the panel sees it. */
export interface FieldControl {
  node: HTMLElement;
  /** The field's tag, or '' when not set. */
  value(): string;
  /** Human-readable value, e.g. the author's name. */
  display(): string;
}

export type StatusKind = 'ok' | 'error' | '';
export type SetStatus = (text: string, kind?: StatusKind) => void;
/** Queues a save; onError runs if it fails. */
export type Save = (task: () => Promise<unknown>, onError?: () => void) => void;
