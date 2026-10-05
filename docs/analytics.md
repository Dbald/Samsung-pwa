# Analytics contract

Events are created in `src/client/analytics.ts`. With `site.analytics.endpoint: null`
(the default), nothing leaves the browser. Events are still pushed to
`window.showroomEvents` and dispatched as `showroom:event` for debugging and tests. Set
the endpoint to a same-origin path or an https URL to send them, with `sendBeacon` or a
`keepalive` POST that never delays navigation. With `requireConsent: true`, events are
queued until the page calls `window.showroom.grantConsent()`.

## Events

| Event | When |
| --- | --- |
| `product_view` | A product page loads |
| `viewer_requested` | 3D loading starts. `detail` is `auto`, `tap` or `retry` |
| `viewer_ready` | The model is displayed. `elapsedMs` is measured from the request |
| `viewer_error` | Loading failed. `detail` holds the reason |
| `ar_requested` | The user taps "View in your space". `arMode` is `webxr`, `scene-viewer`, `quick-look` or `unknown` |
| `ar_started` | A WebXR session started. Native viewers don't report this |
| `ar_failed` | AR failed where the platform reports it |
| `retailer_click` | The retailer link was followed while online |

Every event carries `eventId` (for deduplicating retries), `sessionId` (random, per
tab), `productId`, `appVersion`, `deviceClass` (`phone`, `tablet` or `desktop`) and `ts`.
Events never include camera images, room geometry or personal data.

## Metrics

- **Viewer success** = `viewer_ready` ÷ `viewer_requested`
- **Retailer handoff rate** = sessions with a `retailer_click` on a product ÷ sessions with a `product_view`
- Don't count `ar_requested` for Scene Viewer or Quick Look as a successful placement.
  Those platforms don't report completion.
- An outbound click is not a confirmed sale. Set baselines before setting uplift targets.
