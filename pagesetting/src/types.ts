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

/**
 * A tag field's control as the panel sees it. The shown value can differ from the
 * committed one while a change waits for confirmation; only committed values are saved.
 */
export interface FieldControl {
  node: HTMLElement;
  /** The field's shown tag, or '' when not set. */
  value(): string;
  /** Human-readable shown value, e.g. the author's name. */
  display(): string;
  /** The last committed tag, or '' when not set. */
  committedValue(): string;
  /** Accept the shown value. */
  commit(): void;
  /** Go back to the committed value. */
  revert(): void;
}

export type StatusKind = 'ok' | 'error' | '';
export type SetStatus = (text: string, kind?: StatusKind) => void;
/** A task can return its own status line instead of the default "Saved". */
export type SaveResult = void | { text: string; kind: StatusKind };
/** Queues a save; onError runs if it fails. */
export type Save = (task: () => Promise<unknown>, onError?: () => void) => void;
