import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nemench.maxis',
  // Matches the default site name (server/database.ts's 'siteName' seed).
  // This is baked into the app at build time (also mirrored in
  // android/app/src/main/res/values/strings.xml's app_name/title_activity_main) —
  // if an admin changes the site name in Settings, the launcher label won't
  // follow automatically; update both here and rebuild to match.
  appName: 'MAXIS',
  webDir: 'dist',
  // No `server.url` here — the app bundles the web build locally (from
  // webDir) instead of loading the LAN server's page directly, so Capacitor
  // serves it from its own secure internal origin (https://localhost by
  // default). This is required for camera-based barcode scanning: browsers
  // (and Android's WebView, same rules) only expose getUserMedia/BarcodeDetector
  // in a "secure context", which a plain-HTTP LAN address never qualifies as.
  // The API's actual LAN address now lives in src/shared/nativeServer.ts —
  // edit that file (not this one) if the server's address changes.
  android: {
    // The bundled page (https://localhost) fetching the LAN server's plain
    // HTTP API is "mixed content" — allowed here because this app only ever
    // talks to one specific trusted LAN host (see android/app/src/main/res/
    // xml/network_security_config.xml, which scopes cleartext to that host
    // specifically, same as this scopes mixed content to this one app).
    allowMixedContent: true
  }
};

export default config;
