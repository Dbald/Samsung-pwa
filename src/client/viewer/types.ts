// The viewer adapter keeps product data and page UI independent of the 3D library.
// Swapping <model-viewer> for another renderer means writing one new adapter.
import type { ArMode } from '../analytics';

export interface ViewerOptions {
  src: string;
  iosSrc: string | null;
  poster: string;
  alt: string;
  cameraOrbit: string;
  ar: boolean;
  placement: 'floor' | 'wall';
  reducedMotion: boolean;
}

export type ArStatus = 'started' | 'placed' | 'ended' | 'failed';

export interface ViewerCallbacks {
  onProgress(fraction: number): void;
  onReady(): void;
  onError(reason: string): void;
  onArStatus(status: ArStatus): void;
}

export interface ViewerAdapter {
  /** True once a model is loaded and this device has a supported AR route. */
  readonly canActivateAR: boolean;
  /** Best guess of the route activateAR() will take on this device. */
  arMode(): Promise<ArMode>;
  activateAR(): Promise<void>;
  /** Restores the approved framing. */
  reset(): void;
  /** Removes the renderer and releases its resources. */
  destroy(): void;
}

export type CreateViewer = (stage: HTMLElement, options: ViewerOptions, callbacks: ViewerCallbacks) => Promise<ViewerAdapter>;
