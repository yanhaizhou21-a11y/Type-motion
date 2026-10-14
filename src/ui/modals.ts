export class ModalManager {
  private spritesModal: HTMLElement | null;
  private texModal: HTMLElement | null;
  private stackModal: HTMLElement | null;
  private toastEl: HTMLElement | null;
  private toastTimeout: number | null = null;
  private onModalCloseCallback?: () => void;

  constructor(onModalClose?: () => void) {
    this.onModalCloseCallback = onModalClose;
    this.spritesModal = document.getElementById('tg-modal-sprites');
    this.texModal = document.getElementById('tg-modal-tex');
    this.stackModal = document.getElementById('tg-modal-stack');
    this.toastEl = document.getElementById('tg-toast');

    this.bindEvents();
  }

  private bindEvents(): void {
    // Sprites modal
    document.getElementById('tg-btn-custom-quick')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal(this.spritesModal);
    });
    document.getElementById('tg-close-sprites')?.addEventListener('click', () => {
      this.closeModal(this.spritesModal);
    });

    // Textures modal
    document.getElementById('tg-btn-tex-quick')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal(this.texModal);
    });
    document.getElementById('tg-close-tex')?.addEventListener('click', () => {
      this.closeModal(this.texModal);
    });

    // Stack prompt modal
    document.getElementById('tg-mode-stack')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal(this.stackModal);
    });
    document.getElementById('tg-close-stack')?.addEventListener('click', () => {
      this.closeModal(this.stackModal);
    });

    // Copy prompt button
    document.getElementById('tg-copy-prompt')?.addEventListener('click', () => {
      const content = document.getElementById('tg-prompt-content')?.textContent || '';
      navigator.clipboard.writeText(content).then(() => {
        const btn = document.getElementById('tg-copy-prompt');
        if (btn) {
          const old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = old;
          }, 1800);
        }
        this.showToast('Master prompt copied to clipboard!');
      }).catch(() => {});
    });

    // Backdrop click closures
    [this.spritesModal, this.texModal, this.stackModal].forEach((m) => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) this.closeModal(m);
      });
    });
  }

  public openModal(modal: HTMLElement | null): void {
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  public closeModal(modal: HTMLElement | null): void {
    if (modal) {
      modal.style.display = 'none';
      if (this.onModalCloseCallback) {
        this.onModalCloseCallback();
      }
    }
  }

  public isAnyModalOpen(): boolean {
    return (
      this.spritesModal?.style.display === 'flex' ||
      this.texModal?.style.display === 'flex' ||
      this.stackModal?.style.display === 'flex'
    );
  }

  public showToast(msg: string, duration = 2400): void {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastEl.style.transform = 'translate(-50%, 0)';
    if (this.toastTimeout != null) clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      if (this.toastEl) {
        this.toastEl.style.opacity = '0';
        this.toastEl.style.transform = 'translate(-50%, 12px)';
      }
    }, duration);
  }
}
