// JS bridge for the local (non-npm) Android IconSwitcherPlugin — wraps the
// activity-alias-based launcher icon/name switching mechanism (see
// android/app/src/main/java/com/nemench/maxis/{IconSwitcher,IconSwitcherPlugin}.java
// and the <activity-alias> entries in AndroidManifest.xml). Only meaningful
// on native Android; calling it elsewhere rejects (guard with
// Capacitor.isNativePlatform() before use, same as any other native-only
// feature in this app).
import { registerPlugin } from "@capacitor/core";

// Must exactly match the three <activity-alias android:name> suffixes in
// AndroidManifest.xml and IconSwitcher.java's ICON_DEFAULT/ALT1/ALT2 constants.
export type IconVariant = "IconDefault" | "IconAlt1" | "IconAlt2";

export interface IconSwitcherPlugin {
  setIcon(options: { variant: IconVariant }): Promise<void>;
  getIcon(): Promise<{ variant: IconVariant }>;
}

// The string here must exactly match the Java side's
// @CapacitorPlugin(name = "IconSwitcher") annotation — a mismatch fails
// silently at runtime (every call rejects with "plugin not implemented"),
// not at compile time.
export const iconSwitcher = registerPlugin<IconSwitcherPlugin>("IconSwitcher");
