import { Capacitor } from "@capacitor/core";

// The Android app kills the WebView process on ordinary backgrounding, which
// clears sessionStorage — that would log the stock-taker out far more often
// than intended. Use localStorage (survives app restarts) only inside the
// native app; browser/Electron kiosk terminals keep sessionStorage so closing
// the tab/window still logs out, as intended for shared counter/kitchen PCs.
const KEY = "kot-token";
const store = Capacitor.isNativePlatform() ? localStorage : sessionStorage;

export const tokenStorage = {
  get: (): string | null => store.getItem(KEY),
  set: (token: string): void => store.setItem(KEY, token),
  clear: (): void => store.removeItem(KEY)
};
