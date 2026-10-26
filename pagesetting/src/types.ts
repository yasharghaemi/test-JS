import type { Classifications } from './classifications';

export interface PageData {
  id: number;
  summary: string;
  thumbnail: string;
  tags: string[];
  /** The viewer's MindTouch role from their API document, e.g. "Editor"; '' if unknown. */
  userRole: string;
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
  /** The field's shown tags; [] when not set. Most fields hold one, License holds two. */
  tags(): string[];
  /** Human-readable shown value, e.g. the author's name or "CC BY-SA 4.0". */
  display(): string;
  /** The last committed tags. */
  committedTags(): string[];
  /** Accept the shown value. */
  commit(): void;
  /** Go back to the committed value. */
  revert(): void;
  /** Take options from the site's classifications, if it has some for this field. */
  setOptions?(classifications: Classifications): void;
}

export type StatusKind = 'ok' | 'error' | '';
export type SetStatus = (text: string, kind?: StatusKind) => void;
/** A task can return its own status line instead of the default "Saved". */
export type SaveResult = void | { text: string; kind: StatusKind };
/** Queues a save; onError runs if it fails. */
export type Save = (task: () => Promise<unknown>, onError?: () => void) => void;
