import './styles.css';
import { createAnalytics } from './analytics';
import { initCompare } from './compare';
import { appConfig } from './config';
import { initFinishes } from './finishes';
import { initHandoff } from './handoff';
import { initConnectivity, initInstall, initServiceWorker, renderRecent } from './pwa';
import { initSaved } from './saved';
import { initViewer } from './viewer/controller';

const config = appConfig();
const page = document.body.dataset.page;
const productId = document.body.dataset.productId ?? null;
const analytics = createAnalytics({ ...config.analytics, appVersion: config.version, productId });

initConnectivity();
initInstall();
initServiceWorker();
initSaved((id, saved) => analytics.track('product_saved', { detail: `${id}:${saved ? 'saved' : 'removed'}` }));

// Prices carry an expiry; hide any that went stale while the page sat in a cache.
for (const el of document.querySelectorAll<HTMLElement>('[data-price-expires]'))
  if (Date.parse(el.dataset.priceExpires!) < Date.now()) el.hidden = true;

if (page === 'product') {
  analytics.track('product_view');
  const viewerEl = document.querySelector<HTMLElement>('[data-viewer]');
  const viewer = viewerEl ? initViewer(viewerEl, analytics) : null;
  const handoffEl = document.querySelector<HTMLElement>('[data-handoff]');
  const handoff = handoffEl ? initHandoff(handoffEl) : null;
  const finishes = document.querySelector<HTMLElement>('[data-finishes]');
  if (finishes)
    initFinishes(finishes, (choice, initial) => {
      handoff?.refresh();
      // A shared link only preloads the tint; it doesn't force a 3D download.
      if (initial && viewer?.state === 'idle') return viewer.setFinishLater(choice.tint, choice.materials);
      viewer?.setFinish(choice.tint, choice.materials);
      if (!initial) analytics.track('finish_selected', { detail: choice.id || 'base' });
    });
  // Recorded with sendBeacon, so navigation is never delayed.
  document.querySelector('[data-retailer]')?.addEventListener('click', () => {
    if (navigator.onLine) analytics.track('retailer_click');
  });
}

if (page === 'compare') {
  const root = document.querySelector<HTMLElement>('main');
  if (root) initCompare(root);
}

if (page === 'offline') {
  const list = document.querySelector<HTMLElement>('[data-recent]');
  if (list) void renderRecent(list);
}
