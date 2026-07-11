// Syncs this instance's business profile from the control plane every 15
// minutes. This module must never be the reason the app fails to start or
// operate — every network/DB operation here is wrapped in try/catch with
// only console.warn/console.error, nothing here throws into
// server/index.ts's bootstrap. On any failure (network error, control
// plane down, 401, etc.) it falls through to whatever's already cached, or
// the hardcoded safe default if nothing has ever synced.
import { db } from "./index.js";

export interface BusinessProfile {
  id: string;
  business_name: string;
  logo_url: string | null;
  primary_color: string | null;
  vat_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  license_status: "active" | "pending_suspension" | "suspended" | "trial";
  grace_period_ends_at: string | null;
  feature_flags: Record<string, boolean>;
  whatsapp_number_id: string | null;
  whatsapp_templates: unknown;
  maxis_version: string | null;
  created_at: string;
  updated_at: string;
}

// Used on a fresh install that's never reached the control plane (or ever
// been configured to) — generic branding, every feature flag off except
// core POS, license_status "trial" so nothing looks suspended/broken.
const SAFE_DEFAULT_PROFILE: BusinessProfile = {
  id: "local-default",
  business_name: "MAXIS",
  logo_url: null,
  primary_color: null,
  vat_number: null,
  contact_email: null,
  contact_phone: null,
  license_status: "trial",
  grace_period_ends_at: null,
  feature_flags: { inventory: false, whatsapp: false, multi_till: false },
  whatsapp_number_id: null,
  whatsapp_templates: null,
  maxis_version: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString()
};

// Module-level in-memory cache — loaded once from the DB at startup,
// refreshed in memory whenever a sync succeeds. getBusinessProfile() is a
// synchronous read of this, never a DB/network call itself, so the rest of
// the app (any request handler) can call it cheaply and never block on it.
let cachedProfile: BusinessProfile = SAFE_DEFAULT_PROFILE;

export function getBusinessProfile(): BusinessProfile {
  return cachedProfile;
}

function loadFromDb(): void {
  try {
    const row = db.getCachedProfile();
    if (row) cachedProfile = JSON.parse(row.profile_json) as BusinessProfile;
  } catch (err) {
    console.error("[control-plane-sync] failed to load cached profile from DB, using safe default:", err);
  }
}

// Reads package.json's version at runtime rather than hardcoding/importing
// it, so this doesn't need updating every release.
function getMaxisVersion(): string {
  return process.env.npm_package_version ?? "unknown";
}

async function syncOnce(): Promise<void> {
  const baseUrl = process.env.MAXIS_CONTROL_PLANE_URL;
  const apiKey = process.env.MAXIS_CONTROL_API_KEY;
  if (!baseUrl || !apiKey) return; // not configured — silently stay on cache/default, this is a valid (offline-only) deployment mode

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/sync/profile?maxis_version=${encodeURIComponent(getMaxisVersion())}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal });
    if (!res.ok) {
      console.warn(`[control-plane-sync] sync failed: HTTP ${res.status}`);
      return;
    }
    const profile = await res.json() as BusinessProfile;
    const now = new Date().toISOString();
    db.setCachedProfile(JSON.stringify(profile), now);
    cachedProfile = profile;
    console.log("[control-plane-sync] profile synced successfully");
  } catch (err) {
    console.warn("[control-plane-sync] sync attempt failed, using cached/default profile:", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timeout);
  }
}

export function startControlPlaneSync(): void {
  loadFromDb();      // in-memory cache from DB (or safe default) before any network attempt
  void syncOnce();    // fire-and-forget at startup — never awaited by server bootstrap
  setInterval(() => void syncOnce(), 15 * 60 * 1000);
}
