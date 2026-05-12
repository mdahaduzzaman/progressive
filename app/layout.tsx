import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { tenantFromHost } from "@/lib/tenants.mjs";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { InstallPrompt } from "./components/InstallPrompt";
import { OnlineStatus } from "./components/OnlineStatus";

async function currentTenant() {
  return tenantFromHost((await headers()).get("host"));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await currentTenant();
  return {
    applicationName: t.name,
    title: { default: t.name, template: `%s — ${t.name}` },
    description: `${t.name} — installable, offline-first todos. Add it to your home screen.`,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: t.shortName,
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: `${t.iconPath}/icon-192.png`, sizes: "192x192", type: "image/png" },
        { url: `${t.iconPath}/icon-512.png`, sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: `${t.iconPath}/apple-touch-icon.png`, sizes: "180x180" }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const t = await currentTenant();
  return {
    themeColor: t.themeColor,
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = await currentTenant();
  const accentStyle = {
    "--accent-strong": t.accentColor,
    "--accent": t.accentColor,
  } as CSSProperties;

  return (
    <html lang="en" style={accentStyle} data-tenant={t.slug}>
      <body>
        <ServiceWorkerRegister />
        <OnlineStatus />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
