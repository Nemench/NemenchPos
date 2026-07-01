// Single source of truth for the LAN address of the MAXIS server. Used by:
//  - capacitor.config.ts, to decide what the native app's fetches target
//  - src/ui/api.ts, to build absolute request/asset URLs on native platforms
//
// The native Android app bundles the web build locally (webDir) rather than
// loading this server's URL directly as the page itself — Capacitor serves
// bundled content from its own secure internal origin (https://localhost),
// which is required for camera access (barcode scanning needs a "secure
// context" that a plain-HTTP LAN address can never be). That means the
// app's page origin and the API's origin are now different, so every API
// call and every server-served asset (uploaded logo, etc.) needs this
// absolute base URL instead of a same-origin relative path.
//
// EDIT THIS to match your MAXIS server's LAN address (same value that used
// to live in capacitor.config.ts's SERVER_URL).
export const NATIVE_SERVER_URL = "http://192.168.68.204:3000";
