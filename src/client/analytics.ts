// Analytics contract (docs/analytics.md). Events carry no personal data, camera
// imagery or room geometry. Without a configured endpoint nothing leaves the page;
// events are still exposed on window.showroomEvents for debugging and tests.

export type EventName =
  | 'product_view'
  | 'viewer_requested'
  | 'viewer_ready'
  | 'viewer_error'
  | 'ar_requested'
  | 'ar_started'
  | 'ar_failed'
  | 'retailer_click';

export type ArMode = 'webxr' | 'scene-viewer' | 'quick-look' | 'unknown';
export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export interface AnalyticsEvent {
  name: EventName;
  /** Unique per event; receivers deduplicate retried deliveries on it. */
  eventId: string;
  sessionId: string;
  productId: string | null;
  appVersion: string;
  deviceClass: DeviceClass;
  elapsedMs?: number;
  arMode?: ArMode;
  detail?: string;
  ts: string;
}

export interface AnalyticsOptions {
  endpoint: string | null;
  requireConsent: boolean;
  appVersion: string;
  productId: string | null;
  /** Injectable for tests. */
  send?: (endpoint: string, body: string) => boolean | Promise<unknown>;
}

declare global {
  interface Window {
    showroomEvents?: AnalyticsEvent[];
    showroom?: { grantConsent(): void };
  }
}

export function deviceClass(): DeviceClass {
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (!coarse) return 'desktop';
  return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
}

function randomId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('showroom.session');
    if (!id) sessionStorage.setItem('showroom.session', (id = randomId()));
    return id;
  } catch {
    return 'no-storage';
  }
}

function defaultSend(endpoint: string, body: string): boolean | Promise<unknown> {
  const blob = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.(endpoint, blob)) return true;
  return fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
}

export function createAnalytics(opts: AnalyticsOptions) {
  const session = sessionId();
  const device = deviceClass();
  const send = opts.send ?? defaultSend;
  let consented = !opts.requireConsent;
  const pending: AnalyticsEvent[] = [];
  window.showroomEvents ??= [];

  const deliver = (event: AnalyticsEvent) => {
    if (!opts.endpoint) return;
    if (!consented) {
      pending.push(event);
      return;
    }
    try {
      void send(opts.endpoint, JSON.stringify(event));
    } catch {
      /* analytics must never break shopping */
    }
  };

  window.showroom = {
    grantConsent() {
      consented = true;
      pending.splice(0).forEach(deliver);
    },
  };

  return {
    track(name: EventName, data: Partial<Pick<AnalyticsEvent, 'elapsedMs' | 'arMode' | 'detail'>> = {}): AnalyticsEvent {
      const event: AnalyticsEvent = {
        name,
        eventId: randomId(),
        sessionId: session,
        productId: opts.productId,
        appVersion: opts.appVersion,
        deviceClass: device,
        ...data,
        ts: new Date().toISOString(),
      };
      if (event.elapsedMs !== undefined) event.elapsedMs = Math.round(event.elapsedMs);
      window.showroomEvents!.push(event);
      window.dispatchEvent(new CustomEvent('showroom:event', { detail: event }));
      deliver(event);
      return event;
    },
  };
}

export type Analytics = ReturnType<typeof createAnalytics>;
