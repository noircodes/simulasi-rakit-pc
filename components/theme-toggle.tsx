"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex size-11 items-center justify-center rounded-sm text-muted hover:bg-sunken hover:text-ink"
      aria-label={dark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
    >
      {mounted ? dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden /> : <span className="size-5" />}
    </button>
  );
}
