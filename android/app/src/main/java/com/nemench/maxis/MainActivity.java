package com.nemench.maxis;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // IconSwitcherPlugin is a local, app-only plugin (not a published
        // npm package), so it needs manual registration here rather than
        // Capacitor's usual npm-plugin discovery — must happen before
        // super.onCreate(), which is what actually initializes the bridge.
        registerPlugin(IconSwitcherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
