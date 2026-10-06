// Finish swatches: update the product facts, retailer link, shareable URL and 3D tint.

export interface FinishChoice {
  id: string;
  finish: string;
  sku: string;
  tint: [number, number, number] | null;
  materials: string[] | null;
}

export function initFinishes(root: HTMLElement, onChange: (choice: FinishChoice, initial: boolean) => void) {
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[name="finish"]')];
  const legend = root.querySelector<HTMLElement>('[data-finish-legend]')!;
  const skuEl = document.querySelector<HTMLElement>('[data-sku]');
  const nameEl = document.querySelector<HTMLElement>('[data-finish-name]');
  const retailer = document.querySelector<HTMLAnchorElement>('a[data-retailer]');
  const materials = JSON.parse(root.dataset.tintMaterials ?? 'null') as string[] | null;

  const apply = (input: HTMLInputElement, initial: boolean) => {
    const d = input.dataset;
    legend.textContent = d.variantFinish!;
    if (nameEl) nameEl.textContent = d.variantFinish!;
    if (skuEl) skuEl.textContent = d.variantSku!;
    if (retailer && d.variantRetailer) retailer.href = d.variantRetailer;
    const url = new URL(location.href);
    if (input.value) url.searchParams.set('finish', input.value);
    else url.searchParams.delete('finish');
    history.replaceState(history.state, '', url);
    const tint = d.variantTint ? (d.variantTint.split(',').map(Number) as [number, number, number]) : null;
    onChange({ id: input.value, finish: d.variantFinish!, sku: d.variantSku!, tint, materials }, initial);
  };

  for (const r of radios) r.addEventListener('change', () => r.checked && apply(r, false));

  // Restore a finish shared through the URL or QR code.
  const wanted = new URLSearchParams(location.search).get('finish');
  const initial = radios.find((r) => r.value === wanted);
  if (initial) {
    initial.checked = true;
    apply(initial, true);
  }
}
