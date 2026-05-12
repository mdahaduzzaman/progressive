"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ identifies as Mac with touch — treat that as iOS too.
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Macintosh") && "ontouchend" in document)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error — non-standard iOS property
    window.navigator.standalone === true
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [ios, setIOS] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIOS(isIOS());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) return null;

  // Android/desktop Chrome path
  if (deferred) {
    return (
      <button
        className="install-fab"
        onClick={async () => {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") setDeferred(null);
        }}
      >
        <DownloadIcon /> Install app
      </button>
    );
  }

  // iOS path — no programmatic install; show instructions
  if (ios) {
    return (
      <>
        <button className="install-fab" onClick={() => setShowIOSHelp(true)}>
          <DownloadIcon /> Install on iPhone
        </button>
        {showIOSHelp && (
          <IOSInstallSheet onClose={() => setShowIOSHelp(false)} />
        )}
      </>
    );
  }

  return null;
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "end center",
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          padding: 20,
          maxWidth: 420,
          width: "100%",
          marginBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Install on iPhone or iPad</h2>
        <ol style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", lineHeight: 1.6 }}>
          <li>
            Tap the <strong style={{ color: "var(--text)" }}>Share</strong> button in Safari (the square with the up arrow).
          </li>
          <li>
            Scroll down and tap <strong style={{ color: "var(--text)" }}>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong style={{ color: "var(--text)" }}>Add</strong> — the app will appear on your home screen.
          </li>
        </ol>
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            background: "var(--accent-strong)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
