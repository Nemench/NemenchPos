package com.nemench.nemenchpos;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges IconSwitcher's activity-alias mechanism to JS (see
 * src/ui/iconSwitcher.ts) — a local, app-only plugin, not a published npm
 * package, so it's registered directly in MainActivity.onCreate rather than
 * through Capacitor's usual npm-plugin discovery.
 */
@CapacitorPlugin(name = "IconSwitcher")
public class IconSwitcherPlugin extends Plugin {

    @PluginMethod
    public void setIcon(PluginCall call) {
        String variant = call.getString("variant");
        if (variant == null) {
            call.reject("Missing 'variant' parameter");
            return;
        }
        try {
            IconSwitcher.setAppIconAndName(getContext(), variant);
            call.resolve();
        } catch (IllegalArgumentException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String packageName = getContext().getPackageName();
        String current = IconSwitcher.ICON_DEFAULT;
        for (String alias : new String[] { IconSwitcher.ICON_DEFAULT, IconSwitcher.ICON_ALT1, IconSwitcher.ICON_ALT2 }) {
            ComponentName component = new ComponentName(packageName, packageName + "." + alias);
            int state = pm.getComponentEnabledSetting(component);
            // DEFAULT counts as enabled for IconDefault specifically, since
            // that's the alias left enabled="true" in the manifest itself
            // (the app's out-of-the-box state, before setIcon is ever called).
            boolean enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && alias.equals(IconSwitcher.ICON_DEFAULT));
            if (enabled) {
                current = alias;
                break;
            }
        }
        JSObject result = new JSObject();
        result.put("variant", current);
        call.resolve(result);
    }
}
