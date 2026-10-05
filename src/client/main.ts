import './styles.css';
import { createAnalytics } from './analytics';
import { appConfig } from './config';
import { initHandoff } from './handoff';
import { initConnectivity, initInstall, initServiceWorker, renderRecent } from './pwa';
import { initViewer } from './viewer/controller';

const config = appConfig();
const page = document.body.dataset.page;
const productId = document.body.dataset.productId ?? null;
const analytics = createAnalytics({ ...config.analytics, appVersion: config.version, productId });

initConnectivity();
initInstall();
initServiceWorker();

// Prices carry an expiry; hide any that went stale while the page sat in a cache.
for (const el of document.querySelectorAll<HTMLElement>('[data-price-expires]'))
  if (Date.parse(el.dataset.priceExpires!) < Date.now()) el.hidden = true;

if (page === 'product') {
  analytics.track('product_view');
  const viewer = document.querySelector<HTMLElement>('[data-viewer]');
  if (viewer) initViewer(viewer, analytics);
  const handoff = document.querySelector<HTMLElement>('[data-handoff]');
  if (handoff) initHandoff(handoff);
  // Recorded with sendBeacon, so navigation is never delayed.
  document.querySelector('[data-retailer]')?.addEventListener('click', () => {
    if (navigator.onLine) analytics.track('retailer_click');
  });
}

if (page === 'offline') {
  const list = document.querySelector<HTMLElement>('[data-recent]');
  if (list) void renderRecent(list);
}
