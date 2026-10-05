// Drives the product viewer UI: poster → loading → ready | error, plus AR entry.
// The poster and all product facts stay usable whatever happens to the 3D view.
import type { Analytics } from '../analytics';
import type { CreateViewer, ViewerAdapter, ViewerOptions } from './types';

type State = 'idle' | 'loading' | 'ready' | 'error';

const MESSAGES = {
  loading: 'Loading the 3D model…',
  ready: '3D view ready.',
  errorOnline: "The 3D model couldn't load. The product image and details are still available.",
  errorOffline: "You're offline and this 3D model isn't saved on this device. Reconnect to inspect it in 3D.",
  arOffline: 'In-room preview needs an internet connection.',
  arUnsupported: "This device or browser doesn't support in-room preview. The 3D view and details are still available.",
  arFailed: "In-room preview couldn't start. You can keep inspecting the product here.",
  arTest: 'AR test mode: the model scale has not been verified.',
} as const;

const loadDefault: () => Promise<CreateViewer> = () => import('./model-viewer-adapter').then((m) => m.createModelViewer);

export function initViewer(section: HTMLElement, analytics: Analytics, loadAdapter: () => Promise<CreateViewer> = loadDefault) {
  const $ = <T extends HTMLElement>(sel: string) => section.querySelector<T>(sel)!;
  const stage = $('[data-stage]');
  const poster = $<HTMLImageElement>('.viewer__poster');
  const status = $('[data-status]');
  const progress = $('[data-progress]');
  const hint = $('[data-hint]');
  const arNote = section.querySelector<HTMLElement>('[data-ar-note]');
  const buttons = {
    load: $<HTMLButtonElement>('[data-action="load"]'),
    reset: $<HTMLButtonElement>('[data-action="reset"]'),
    retry: $<HTMLButtonElement>('[data-action="retry"]'),
    ar: $<HTMLButtonElement>('[data-action="ar"]'),
  };

  const arTestMode = new URLSearchParams(location.search).has('ar-test');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const d = section.dataset;
  const options: ViewerOptions = {
    src: d.model!,
    iosSrc: d.usdz ?? null,
    poster: d.poster!,
    alt: poster.alt,
    cameraOrbit: d.orbit!,
    ar: (d.ar === 'true' || arTestMode) && d.placement !== 'none',
    placement: d.placement === 'wall' ? 'wall' : 'floor',
    reducedMotion,
  };

  let state: State = 'idle';
  let adapter: ViewerAdapter | null = null;
  let requestedAt = 0;
  let attempt = 0;

  function render(next: State, message = '') {
    state = next;
    section.dataset.state = next;
    status.textContent = message;
    buttons.load.hidden = next !== 'idle';
    buttons.retry.hidden = next !== 'error';
    buttons.reset.hidden = next !== 'ready';
    hint.hidden = next !== 'ready';
    progress.hidden = next !== 'loading';
    poster.hidden = next === 'ready';
    if (next !== 'ready') buttons.ar.hidden = true;
  }

  function teardown() {
    adapter?.destroy();
    adapter = null;
  }

  function fail(reason: string) {
    if (state === 'error') return;
    teardown();
    render('error', navigator.onLine ? MESSAGES.errorOnline : MESSAGES.errorOffline);
    analytics.track('viewer_error', { detail: reason, elapsedMs: performance.now() - requestedAt });
  }

  function updateAr() {
    if (state !== 'ready' || !adapter) return;
    const supported = adapter.canActivateAR;
    buttons.ar.hidden = !supported;
    buttons.ar.disabled = !navigator.onLine;
    if (arNote) arNote.hidden = !supported;
    if (supported && !navigator.onLine) status.textContent = MESSAGES.arOffline;
    if (supported && arTestMode && d.ar !== 'true') status.textContent = MESSAGES.arTest;
  }

  async function load(trigger: 'tap' | 'auto' | 'retry') {
    if (state === 'loading' || state === 'ready') return;
    const current = ++attempt;
    render('loading', MESSAGES.loading);
    setProgress(0);
    requestedAt = performance.now();
    analytics.track('viewer_requested', { detail: trigger });
    try {
      const create = await loadAdapter();
      if (current !== attempt) return;
      // model-viewer memoizes failed loads per URL, so a retry needs a distinct URL.
      const src = trigger === 'retry' ? `${options.src}${options.src.includes('?') ? '&' : '?'}retry=${current}` : options.src;
      adapter = await create(stage, { ...options, src }, {
        onProgress: setProgress,
        onReady() {
          if (current !== attempt || state !== 'loading') return;
          render('ready', MESSAGES.ready);
          analytics.track('viewer_ready', { elapsedMs: performance.now() - requestedAt });
          // canActivateAR settles a moment after load.
          updateAr();
          setTimeout(updateAr, 300);
        },
        onError: (reason) => current === attempt && fail(reason),
        onArStatus(s) {
          if (s === 'started') analytics.track('ar_started', { arMode: 'webxr' });
          if (s === 'failed') {
            status.textContent = MESSAGES.arFailed;
            analytics.track('ar_failed');
          }
          if (s === 'ended') buttons.ar.focus();
        },
      });
    } catch (e) {
      if (current === attempt) fail(e instanceof Error ? `init: ${e.message}` : 'init');
    }
  }

  function setProgress(fraction: number) {
    const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    progress.setAttribute('aria-valuenow', String(pct));
    (progress.firstElementChild as HTMLElement).style.width = `${pct}%`;
  }

  buttons.load.addEventListener('click', () => load('tap'));
  buttons.retry.addEventListener('click', () => {
    render('idle');
    void load('retry');
  });
  buttons.reset.addEventListener('click', () => {
    adapter?.reset();
    status.textContent = 'View reset.';
  });
  buttons.ar.addEventListener('click', async () => {
    if (!adapter) return;
    if (!navigator.onLine) {
      status.textContent = MESSAGES.arOffline;
      return;
    }
    if (!adapter.canActivateAR) {
      status.textContent = MESSAGES.arUnsupported;
      return;
    }
    // Native viewers (Scene Viewer, Quick Look) don't report placement back, so
    // only the request is recorded for them.
    analytics.track('ar_requested', { arMode: await adapter.arMode() });
    try {
      await adapter.activateAR();
    } catch {
      status.textContent = MESSAGES.arFailed;
      analytics.track('ar_failed');
    }
  });
  addEventListener('online', updateAr);
  addEventListener('offline', updateAr);

  // Free the GPU context when the page is hidden in the back/forward cache.
  addEventListener('pagehide', () => {
    if (state === 'idle') return;
    attempt++;
    teardown();
    render('idle');
  });

  // Load automatically when the viewer is (nearly) on screen, unless the user saves data.
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!saveData && 'IntersectionObserver' in window) {
    const start = () => {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            if (state === 'idle') void load('auto');
          }
        },
        { rootMargin: '200px' },
      );
      io.observe(section);
    };
    // Let the poster and product text paint first.
    if (document.readyState === 'complete') start();
    else addEventListener('load', start, { once: true });
  }

  render('idle');
  return { load, get state() { return state; } };
}
