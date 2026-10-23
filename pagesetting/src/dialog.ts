import { el } from './dom';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  /** Optional checkbox shown above the buttons; its state is returned as `checked`. */
  checkbox?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  checked: boolean;
}

/** Modal confirm/cancel question, optionally with one checkbox. */
export function confirmDialog({ title, message, confirmText, cancelText, checkbox }: ConfirmOptions): Promise<ConfirmResult> {
  const dialog = el('dialog', 'cps-dialog');
  if (typeof dialog.showModal !== 'function') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    const checked = confirmed && !!checkbox && window.confirm(checkbox);
    return Promise.resolve({ confirmed, checked });
  }

  const heading = el('h2', 'cps-dialog-title', title);
  heading.id = 'cps-dialog-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.append(heading, el('p', 'cps-dialog-message', message));

  let box: HTMLInputElement | null = null;
  if (checkbox) {
    const label = el('label', 'cps-dialog-check');
    box = el('input');
    box.type = 'checkbox';
    label.append(box, el('span', null, checkbox));
    dialog.append(label);
  }

  const actions = el('div', 'cps-dialog-actions');
  const cancel = el('button', 'cps-btn', cancelText);
  cancel.type = 'button';
  const confirm = el('button', 'cps-btn cps-btn-primary', confirmText);
  confirm.type = 'button';
  actions.append(cancel, confirm);
  dialog.append(actions);
  document.body.append(dialog);

  const returnFocus = document.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      const checked = confirmed && !!box && box.checked;
      dialog.close();
      dialog.remove();
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
      resolve({ confirmed, checked });
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
    // keep Escape from also reaching the editor
    dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });
    dialog.showModal();
    confirm.focus();
  });
}
