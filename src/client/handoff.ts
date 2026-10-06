// Same-product handoff: a QR code on desktop and a copyable link everywhere.

export function initHandoff(section: HTMLElement) {
  const input = section.querySelector<HTMLInputElement>('[data-share-url]')!;
  const copy = section.querySelector<HTMLButtonElement>('[data-copy]')!;
  const status = section.querySelector<HTMLElement>('[data-copy-status]')!;
  const qrBox = section.querySelector<HTMLElement>('[data-qr]')!;
  const qrText = section.querySelector<HTMLElement>('[data-qr-text]')!;

  // Absolute URL to this product. Only the finish survives from the query, so the
  // link opens the same product and finish without other context.
  const path = new URL(input.value, location.origin);
  let url = '';
  const currentUrl = () => {
    const u = new URL(path);
    const finish = new URLSearchParams(location.search).get('finish');
    if (finish) u.searchParams.set('finish', finish);
    return u.href;
  };

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = 'Link copied.';
    } catch {
      input.focus();
      input.select();
      status.textContent = 'Press Ctrl+C or ⌘C to copy the selected link.';
    }
  });

  const desktop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');
  const render = async () => {
    const next = currentUrl();
    input.value = next;
    if (!desktop.matches || (next === url && qrBox.childElementCount)) return;
    url = next;
    const { default: qrcode } = await import('qrcode-generator');
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    qrText.hidden = false;
  };
  desktop.addEventListener('change', render);
  void render();
  return { refresh: () => void render() };
}
