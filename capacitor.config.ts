import type { CapacitorConfig } from '@capacitor/cli';

// EDIT THIS before building the Android app: your MAXIS server's LAN address
// (whatever you'd type into a browser on the shop WiFi to reach the site today,
// e.g. "http://192.168.1.50" or "http://maxis-server.local"). No port needed if
// the server is reachable on 80 via Caddy; include one (":3000") if it's not.
const SERVER_URL = 'http://192.168.68.204:3000';

const config: CapacitorConfig = {
  appId: 'com.nemench.maxis',
  // Matches the default site name (server/database.ts's 'siteName' seed).
  // This is baked into the app at build time (also mirrored in
  // android/app/src/main/res/values/strings.xml's app_name/title_activity_main) —
  // if an admin changes the site name in Settings, the launcher label won't
  // follow automatically; update both here and rebuild to match.
  appName: 'MAXIS',
  webDir: 'dist',
  server: {
    url: SERVER_URL,
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;
