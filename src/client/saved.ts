// Saved products, kept per browser without an account. Storage can be missing or
// blocked (private mode, previews), so every access degrades to an in-memory list.

const KEY = 'showroom.saved';
let memory: string[] = [];

export function savedIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return memory;
  }
}

function write(ids: string[]) {
  memory = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* in-memory only */
  }
  dispatchEvent(new CustomEvent('showroom:saved', { detail: ids }));
}

export function setSaved(id: string, saved: boolean) {
  const ids = savedIds().filter((x) => x !== id);
  write(saved ? [...ids, id] : ids);
}

/** Wires every [data-save] button and the header "Saved" link on the page. */
export function initSaved(onToggle?: (id: string, saved: boolean) => void) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-save]')];
  const link = document.querySelector<HTMLElement>('[data-saved-link]');
  const count = document.querySelector<HTMLElement>('[data-saved-count]');

  const render = () => {
    const ids = savedIds();
    for (const b of buttons) {
      const on = ids.includes(b.dataset.save!);
      b.hidden = false;
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('.save-btn__icon')!.textContent = on ? '♥' : '♡';
      b.querySelector('.save-btn__text')!.textContent = on ? 'Saved' : 'Save';
    }
    if (link && count) {
      link.hidden = ids.length === 0;
      count.textContent = String(ids.length);
      link.setAttribute('aria-label', `Saved appliances: ${ids.length}`);
    }
  };

  for (const b of buttons)
    b.addEventListener('click', () => {
      const id = b.dataset.save!;
      const next = !savedIds().includes(id);
      setSaved(id, next);
      onToggle?.(id, next);
    });
  addEventListener('showroom:saved', render);
  // Keep tabs in sync.
  addEventListener('storage', (e) => e.key === KEY && render());
  render();
}
