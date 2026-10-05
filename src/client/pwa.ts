// Installation, service worker updates and connectivity status.
import { appConfig } from './config';

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function initInstall() {
  const button = document.querySelector<HTMLButtonElement>('[data-install]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-install-dialog]');
  if (!button || !dialog || isStandalone()) return;
  let deferred: BeforeInstallPromptEvent | null = null;

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    button.hidden = false;
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    button.hidden = true;
  });

  // iOS has no install prompt; explain the Share sheet route instead.
  if (isIOS()) {
    const steps = dialog.querySelector('[data-install-steps]')!;
    steps.innerHTML = 'Tap the <strong>Share</strong> button in Safari, then choose <strong>Add to Home Screen</strong>.';
    button.hidden = false;
  }

  button.addEventListener('click', async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') button.hidden = true;
      deferred = null;
    } else dialog.showModal();
  });
}

export function initConnectivity() {
  const banner = document.querySelector<HTMLElement>('[data-net-status]');
  const retailer = document.querySelector<HTMLAnchorElement>('[data-retailer]');
  const retailerOffline = document.querySelector<HTMLElement>('[data-retailer-offline]');
  const update = () => {
    const offline = !navigator.onLine;
    document.documentElement.classList.toggle('is-offline', offline);
    if (banner) {
      banner.hidden = !offline;
      banner.textContent = offline
        ? "You're offline. Saved pages and images still work. 3D models you haven't opened, in-room preview and the retailer need a connection."
        : '';
    }
    if (retailer) retailer.setAttribute('aria-disabled', String(offline));
    if (retailerOffline) retailerOffline.hidden = !offline;
  };
  // The retailer is never cached, so stop the browser showing its own error page.
  retailer?.addEventListener('click', (e) => {
    if (!navigator.onLine) {
      e.preventDefault();
      retailerOffline?.removeAttribute('hidden');
    }
  });
  addEventListener('online', update);
  addEventListener('offline', update);
  update();
}

export function initServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const { base } = appConfig();
  const toast = document.querySelector<HTMLElement>('[data-update-toast]');
  let reloading = false;

  const offerUpdate = (worker: ServiceWorker) => {
    if (!toast) return;
    toast.hidden = false;
    toast.querySelector('[data-update-reload]')!.addEventListener(
      'click',
      () => {
        reloading = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
      { once: true },
    );
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload();
  });

  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base })
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      // Check for a new deploy whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    })
    .catch(() => undefined);
}

/** Offline page: list recently viewed products saved by the service worker. */
export async function renderRecent(list: HTMLElement) {
  if (!('caches' in window)) return;
  const names = (await caches.keys()).filter((n) => n.startsWith('pages-'));
  const items: { url: string; title: string }[] = [];
  for (const name of names) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) {
      const res = await cache.match(req);
      const html = res ? await res.text() : '';
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.split(' | ')[0] ?? new URL(req.url).pathname;
      items.push({ url: new URL(req.url).pathname, title });
    }
  }
  for (const item of items.reverse()) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.url;
    a.textContent = new DOMParser().parseFromString(item.title, 'text/html').documentElement.textContent ?? item.url;
    li.append(a);
    list.append(li);
  }
}
