// Single source of truth for tenant configuration.
// Imported by both Next.js code (server + client) and scripts/generate-icons.mjs.
// Keep this file dependency-free so the icon script can run in plain Node.

/**
 * @typedef {object} Tenant
 * @property {string} slug          // URL subdomain label
 * @property {string} name          // long app name (manifest "name")
 * @property {string} shortName     // home-screen label (manifest "short_name")
 * @property {string} themeColor    // status bar / splash background
 * @property {string} accentColor   // CSS --accent-strong override
 * @property {string} gradientFrom  // icon gradient start
 * @property {string} gradientTo    // icon gradient end
 * @property {string} iconPath      // public path holding generated PNGs
 */

/** @type {Tenant} */
export const DEFAULT_TENANT = {
  slug: "default",
  name: "Progressive Todos",
  shortName: "Todos",
  themeColor: "#0b1020",
  accentColor: "#5b7dff",
  gradientFrom: "#7c9cff",
  gradientTo: "#b48cff",
  iconPath: "/tenants/default",
};

/** @type {Record<string, Tenant>} */
export const TENANTS = {
  abc: {
    slug: "abc",
    name: "ABC Todos",
    shortName: "ABC",
    themeColor: "#0b1e3a",
    accentColor: "#3b82f6",
    gradientFrom: "#3b82f6",
    gradientTo: "#06b6d4",
    iconPath: "/tenants/abc",
  },
  def: {
    slug: "def",
    name: "DEF Todos",
    shortName: "DEF",
    themeColor: "#0c1f15",
    accentColor: "#22c55e",
    gradientFrom: "#22c55e",
    gradientTo: "#84cc16",
    iconPath: "/tenants/def",
  },
};

/** All tenants including the default — used by the icon generator. */
export const ALL_TENANTS = [DEFAULT_TENANT, ...Object.values(TENANTS)];

/**
 * Resolve a tenant from an HTTP Host header (e.g. "abc.example.com:3000").
 * Strategy: take the first dot-separated label and look it up. Anything that
 * doesn't match a known tenant (including bare "localhost", IPs, ngrok URLs)
 * falls back to DEFAULT_TENANT so the app stays usable in dev.
 *
 * @param {string | null | undefined} host
 * @returns {Tenant}
 */
export function tenantFromHost(host) {
  if (!host) return DEFAULT_TENANT;
  const hostname = host.split(":")[0].toLowerCase();
  const first = hostname.split(".")[0];
  return TENANTS[first] ?? DEFAULT_TENANT;
}
