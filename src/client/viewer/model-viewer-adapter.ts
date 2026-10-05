import '@google/model-viewer';
import type { ArMode } from '../analytics';
import type { CreateViewer } from './types';

// Minimal surface of the <model-viewer> element we rely on.
interface ModelViewerElement extends HTMLElement {
  canActivateAR: boolean;
  activateAR(): Promise<void>;
  jumpCameraToGoal(): void;
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
}

export const isAppleMobile = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const createModelViewer: CreateViewer = async (stage, opts, cb) => {
  const mv = document.createElement('model-viewer') as ModelViewerElement;
  const attrs: Record<string, string> = {
    src: opts.src,
    poster: opts.poster,
    alt: opts.alt,
    'camera-controls': '',
    'camera-orbit': opts.cameraOrbit,
    'touch-action': 'pan-y',
    'interaction-prompt': opts.reducedMotion ? 'none' : 'auto',
    'shadow-intensity': '1',
    exposure: '1.05',
    'tone-mapping': 'neutral',
    loading: 'eager',
    reveal: 'auto',
    class: 'viewer__model',
  };
  if (opts.ar) {
    Object.assign(attrs, { ar: '', 'ar-modes': 'webxr scene-viewer quick-look', 'ar-scale': 'fixed', 'ar-placement': opts.placement });
    if (opts.iosSrc) attrs['ios-src'] = opts.iosSrc;
  }
  for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
  // Replace the built-in AR button and progress bar: the page provides its own controls.
  for (const slot of ['ar-button', 'progress-bar']) {
    const el = document.createElement('span');
    el.slot = slot;
    el.hidden = true;
    mv.append(el);
  }

  mv.addEventListener('progress', (e) => cb.onProgress((e as unknown as CustomEvent<{ totalProgress: number }>).detail.totalProgress));
  mv.addEventListener('load', () => cb.onReady());
  mv.addEventListener('error', (e) => cb.onError((e as unknown as CustomEvent<{ type?: string }>).detail?.type ?? 'loadfailure'));
  mv.addEventListener('ar-status', (e) => {
    const status = (e as CustomEvent<{ status: string }>).detail.status;
    if (status === 'session-started') cb.onArStatus('started');
    else if (status === 'object-placed') cb.onArStatus('placed');
    else if (status === 'not-presenting') cb.onArStatus('ended');
    else if (status === 'failed') cb.onArStatus('failed');
  });

  stage.append(mv);
  await customElements.whenDefined('model-viewer');

  return {
    get canActivateAR() {
      return opts.ar && mv.canActivateAR;
    },
    async arMode(): Promise<ArMode> {
      if (isAppleMobile()) return 'quick-look';
      try {
        if (await navigator.xr?.isSessionSupported('immersive-ar')) return 'webxr';
      } catch {
        /* fall through */
      }
      return /Android/i.test(navigator.userAgent) ? 'scene-viewer' : 'unknown';
    },
    activateAR: () => mv.activateAR(),
    reset() {
      mv.cameraOrbit = opts.cameraOrbit;
      mv.cameraTarget = 'auto auto auto';
      mv.fieldOfView = 'auto';
      if (opts.reducedMotion) mv.jumpCameraToGoal();
    },
    destroy() {
      mv.remove();
    },
  };
};

declare global {
  interface Navigator {
    xr?: { isSessionSupported(mode: string): Promise<boolean> };
  }
}
