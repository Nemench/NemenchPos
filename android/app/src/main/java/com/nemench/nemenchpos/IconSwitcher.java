package com.nemench.nemenchpos;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

/**
 * Switches the app's launcher icon and display name at runtime using the
 * activity-alias technique (see AndroidManifest.xml's <activity-alias>
 * entries) — the same approach WhatsApp/Instagram use for their seasonal/
 * alternate icons. Only one alias may be enabled at a time; the disabled
 * ones simply don't appear on the home screen.
 *
 * NOTE: most launchers require a home-screen refresh (or occasionally a
 * short delay, a device restart, or removing/re-adding the shortcut) before
 * the new icon/name is visually reflected — this is normal Android/launcher
 * caching behavior, not a bug in this code. The underlying enabled-state
 * change itself is applied immediately.
 */
public final class IconSwitcher {

    /** Must match the android:name suffixes of the <activity-alias> entries in the manifest. */
    public static final String ICON_DEFAULT = "IconDefault";
    public static final String ICON_ALT1 = "IconAlt1";
    public static final String ICON_ALT2 = "IconAlt2";

    private static final String[] ALL_ALIASES = { ICON_DEFAULT, ICON_ALT1, ICON_ALT2 };

    private IconSwitcher() {}

    /**
     * Enables the given alias (icon + name variant) and disables every other
     * known alias, so exactly one is ever active. Uses DONT_KILL_APP since
     * this is typically called while the app is running (e.g. from a
     * Settings screen) — killing the process here would be jarring.
     *
     * Enables the target BEFORE disabling the rest, so there's never a
     * window where zero aliases are enabled (which would remove the app's
     * launcher icon entirely, however briefly) — a short overlap where two
     * aliases are technically enabled is preferable to that.
     */
    public static void setAppIconAndName(Context context, String alias) {
        if (java.util.Arrays.asList(ALL_ALIASES).indexOf(alias) < 0) {
            throw new IllegalArgumentException("Unknown icon alias: " + alias);
        }

        PackageManager pm = context.getPackageManager();
        String packageName = context.getPackageName();

        setAliasEnabled(pm, packageName, alias, true);

        for (String other : ALL_ALIASES) {
            if (!other.equals(alias)) {
                setAliasEnabled(pm, packageName, other, false);
            }
        }
    }

    private static void setAliasEnabled(PackageManager pm, String packageName, String alias, boolean enabled) {
        ComponentName component = new ComponentName(packageName, packageName + "." + alias);
        pm.setComponentEnabledSetting(
            component,
            enabled ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        );
    }
}
