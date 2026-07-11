import type { CapacitorConfig } from '@capacitor/cli';
import { NATIVE_SERVER_URL } from './src/shared/nativeServer';

const config: CapacitorConfig = {
  appId: 'com.nemench.nemenchpos',
  // Matches the default site name (server/database.ts's 'siteName' seed).
  // This is baked into the app at build time (also mirrored in
  // android/app/src/main/res/values/strings.xml's app_name/title_activity_main) —
  // if an admin changes the site name in Settings, the launcher label won't
  // follow automatically; update both here and rebuild to match.
  appName: 'NemenchPos',
  webDir: 'dist',
  // Live-loads the actual LAN server page directly — a "closed browser"
  // shell, not a bundled copy of the web app. This is what makes ordinary
  // web deploys show up automatically next time the app is opened, with no
  // APK rebuild/resideload. `webDir`/`dist` above is still needed (Capacitor
  // still syncs the native bridge JS from it via `npx cap sync`), but its
  // contents are no longer what actually gets displayed.
  //
  // `cleartext: true` is required because NATIVE_SERVER_URL is plain HTTP
  // (see src/shared/nativeServer.ts) — Android otherwise refuses to load an
  // insecure top-level page. This used to also be a problem for camera-based
  // barcode scanning (the web getUserMedia/BarcodeDetector APIs require a
  // secure context, which this plain-HTTP page can never be) — that's now
  // solved by scanning through a native Capacitor plugin instead
  // (@capacitor-mlkit/barcode-scanning, see src/ui/useBarcodeScan.ts), which
  // doesn't run inside the WebView and so isn't subject to that restriction.
  server: {
    url: NATIVE_SERVER_URL,
    cleartext: true
  }
};

export default config;
