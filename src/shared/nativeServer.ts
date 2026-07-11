// Single source of truth for the LAN address of the MAXIS server. Used by:
//  - capacitor.config.ts's server.url — the native Android app live-loads
//    this page directly (a "closed browser" shell), rather than bundling a
//    copy of the web build into the APK. Every ordinary web deploy is then
//    live in the app automatically on next open, no APK rebuild needed.
//
// Since the app's page origin now literally IS this address, no other file
// needs to know about it — src/ui/api.ts's apiOrigin just uses
// window.location.origin on every platform, native included.
//
// EDIT THIS to match your MAXIS server's LAN address, then rebuild and
// resideload the app once (capacitor.config.ts is baked in at build time,
// unlike the web app itself).
export const NATIVE_SERVER_URL = "http://192.168.68.204:3000";
