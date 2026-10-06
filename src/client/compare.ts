// Narrows the statically rendered comparison to `?ids=a,b` or the saved list.
import { savedIds, setSaved } from './saved';

export function initCompare(root: HTMLElement) {
  const intro = root.querySelector<HTMLElement>('[data-compare-intro]')!;
  const empty = root.querySelector<HTMLElement>('[data-compare-empty]')!;
  const table = root.querySelector<HTMLElement>('.compare')!;
  const all = [...new Set([...root.querySelectorAll<HTMLElement>('[data-col]')].map((el) => el.dataset.col!))];

  const render = () => {
    const fromUrl = new URLSearchParams(location.search).get('ids');
    const wanted = fromUrl ? fromUrl.split(',').filter(Boolean) : savedIds();
    const shown = wanted.length ? all.filter((id) => wanted.includes(id)) : all;
    for (const el of root.querySelectorAll<HTMLElement>('[data-col]')) el.hidden = !shown.includes(el.dataset.col!);
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-remove]')) b.hidden = !!fromUrl || !wanted.length;
    table.hidden = shown.length === 0;
    empty.hidden = shown.length > 0;
    intro.textContent = !wanted.length
      ? 'Showing every appliance. Save products to compare only those.'
      : fromUrl
        ? `Comparing ${shown.length} shared appliance${shown.length === 1 ? '' : 's'}.`
        : `Comparing your ${shown.length} saved appliance${shown.length === 1 ? '' : 's'}.`;
  };

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (b) setSaved(b.dataset.remove!, false);
  });
  addEventListener('showroom:saved', render);
  render();
}
