import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { tenantFromHost } from "@/lib/tenants.mjs";

// Resolve per-request so each subdomain gets its own manifest.
export const dynamic = "force-dynamic";

export async function GET() {
  const t = tenantFromHost((await headers()).get("host"));

  return NextResponse.json(
    {
      id: `/?tenant=${t.slug}`,
      name: t.name,
      short_name: t.shortName,
      description: `${t.name} — installable, offline-first todos.`,
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: t.themeColor,
      theme_color: t.themeColor,
      categories: ["productivity", "utilities"],
      icons: [
        { src: `${t.iconPath}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${t.iconPath}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${t.iconPath}/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    }
  );
}
