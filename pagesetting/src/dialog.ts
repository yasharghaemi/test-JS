import { el } from './dom';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

/** Modal yes/no question. Resolves true only when the confirm button is pressed. */
export function confirmDialog({ title, message, confirmText, cancelText }: ConfirmOptions): Promise<boolean> {
  const dialog = el('dialog', 'cps-dialog');
  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  const heading = el('h2', 'cps-dialog-title', title);
  heading.id = 'cps-dialog-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  const actions = el('div', 'cps-dialog-actions');
  const cancel = el('button', 'cps-btn', cancelText);
  cancel.type = 'button';
  const confirm = el('button', 'cps-btn cps-btn-primary', confirmText);
  confirm.type = 'button';
  actions.append(cancel, confirm);
  dialog.append(heading, el('p', 'cps-dialog-message', message), actions);
  document.body.append(dialog);

  const returnFocus = document.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
      resolve(result);
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
    // keep Escape from also reaching the editor
    dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });
    dialog.showModal();
    cancel.focus(); // the safe choice is the default
  });
}
