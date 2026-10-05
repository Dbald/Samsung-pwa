// Same-product handoff: a QR code on desktop and a copyable link everywhere.

export function initHandoff(section: HTMLElement) {
  const input = section.querySelector<HTMLInputElement>('[data-share-url]')!;
  const copy = section.querySelector<HTMLButtonElement>('[data-copy]')!;
  const status = section.querySelector<HTMLElement>('[data-copy-status]')!;
  const qrBox = section.querySelector<HTMLElement>('[data-qr]')!;
  const qrText = section.querySelector<HTMLElement>('[data-qr-text]')!;

  // Absolute URL to this product, without query or hash, so it opens without context.
  const url = new URL(input.value, location.origin).href;
  input.value = url;

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Link copied.';
    } catch {
      input.focus();
      input.select();
      status.textContent = 'Press Ctrl+C or ⌘C to copy the selected link.';
    }
  });

  const desktop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');
  const render = async () => {
    if (!desktop.matches || qrBox.childElementCount) return;
    const { default: qrcode } = await import('qrcode-generator');
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    qrText.hidden = false;
  };
  desktop.addEventListener('change', render);
  void render();
}
