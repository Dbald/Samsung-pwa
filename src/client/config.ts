import type { ClientConfig } from '../render/pages';

let cached: ClientConfig | undefined;

/** Build-time configuration embedded by the page renderer as non-executable JSON. */
export function appConfig(): ClientConfig {
  if (!cached) {
    const el = document.getElementById('app-config');
    cached = el ? (JSON.parse(el.textContent ?? '{}') as ClientConfig) : { version: 'unknown', base: '/', analytics: { endpoint: null, requireConsent: false } };
  }
  return cached;
}
