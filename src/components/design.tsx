"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { getDict, isLocale, type Locale } from "@/i18n";

type I18nValue = {
  lang: Locale;
  t: (key: string) => string;
  setLang: (lang: string) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>("rw");

  useEffect(() => {
    const saved = localStorage.getItem("gq_lang") ?? "rw";
    if (isLocale(saved)) setLangState(saved);
  }, []);

  const setLang = useCallback((next: string) => {
    if (!isLocale(next)) return;
    localStorage.setItem("gq_lang", next);
    setLangState(next);
  }, []);

  const dict = getDict(lang);
  const t = useCallback((key: string) => dict[key as keyof typeof dict] ?? key, [dict]);

  const value = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export const DEMO_TIN = "100000001";
export const DEMO_MRC = "MRC-CKT001";
export const DEMO_GQ = "GQ-000001";
export const DEMO_DOC = "DOC-000001";
export const DEMO_PASSWORD = "GqDemo#2026";
export const DEMO_VENDOR_ID = "VND-ISHYIGA";

export type Status =
  | "QUEUEING"
  | "GENERATING"
  | "STANDBY"
  | "ADJUST"
  | "DONE"
  | "REFUNDED"
  | "FAILED"
  | string;

const statusTone: Record<string, string> = {
  DONE: "bg-emerald/10 text-emerald border-emerald/30",
  REFUNDED: "bg-emerald/10 text-emerald border-emerald/30",
  QUEUEING: "bg-gold/10 text-gold border-gold/30",
  GENERATING: "bg-gold/10 text-gold border-gold/30",
  STANDBY: "bg-gold/10 text-gold border-gold/30",
  ADJUST: "bg-gold/10 text-gold border-gold/30",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

export function RraHeader() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-navy text-lg font-black text-white">
        RRA
      </div>
      <small className="text-[10px] font-bold uppercase tracking-[0.6px] text-muted">
        {t("rra.brand")}
      </small>
    </div>
  );
}

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  const langs = ["rw", "en", "fr", "sw"] as const;

  return (
    <div className="flex justify-center gap-2">
      {langs.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLang(item)}
          className={`flex min-w-[58px] flex-col items-center gap-1 rounded-[13px] border-[1.5px] bg-white px-2.5 py-2 transition ${
            lang === item ? "border-navy shadow-[0_3px_10px_-4px_rgba(18,58,94,.5)]" : "border-line"
          }`}
        >
          <b className={`text-[11.5px] font-extrabold tracking-wide ${lang === item ? "text-navy" : "text-muted"}`}>
            {item.toUpperCase()}
          </b>
        </button>
      ))}
    </div>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto border-t border-line px-3 py-3.5 text-center text-xs text-muted">
      {t("poweredBy")}
    </footer>
  );
}

export function StatusChip({ status }: { status?: Status }) {
  const { t } = useI18n();
  const label = status ?? "QUEUEING";
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
        statusTone[label] ?? "border-line bg-slate-50 text-muted"
      }`}
    >
      {t(`status.${label}`) !== `status.${label}` ? t(`status.${label}`) : label}
    </span>
  );
}

export function CitizenShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex min-h-dvh flex-col bg-paper font-sans text-ink">
        <div className="flex flex-col items-center px-[18px] pb-1 pt-[18px]">
          <RraHeader />
        </div>
        <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-[22px] pb-[18px] pt-1.5">
          <LangSwitcher />
          <div className="mt-6">{children}</div>
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}

export function AppShell({
  children,
  wide = false,
  nav = false,
}: {
  children: ReactNode;
  wide?: boolean;
  nav?: boolean;
}) {
  return (
    <I18nProvider>
      <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-6">
        <div className={`mx-auto ${wide ? "max-w-7xl" : "max-w-3xl"}`}>
          <div className="rounded-[2rem] border border-line bg-card/95 p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-navy text-lg font-black text-white">
                  RRA
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-navy">
                    Rwanda Revenue Authority
                  </p>
                  <p className="text-sm text-muted">ebm.rw · Global QR</p>
                </div>
              </Link>
              <LangSwitcher />
            </div>
            {nav ? <PortalNav /> : null}
            {children}
            <Footer />
          </div>
        </div>
      </main>
    </I18nProvider>
  );
}

export function PortalNav() {
  const links = [
    ["Seller", "/seller"],
    ["Vendor", "/vendor"],
    ["RRA", "/rra"],
    ["Admin", "/admin"],
    ["Status", "/status"],
  ];

  return (
    <nav className="my-6 flex flex-wrap gap-2 text-sm font-semibold">
      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="rounded-full border border-line px-4 py-2 text-muted transition hover:border-navy hover:text-navy"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "navy" | "gold";
}) {
  const styles = {
    primary: "bg-emerald text-white hover:bg-emerald/90",
    secondary: "bg-navy text-white hover:bg-navy/90",
    navy: "bg-navy text-white",
    gold: "bg-gold text-white",
    ghost: "border-[1.5px] border-line bg-white text-navy",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2.5 rounded-[15px] px-5 py-[18px] text-[17px] font-bold transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-ink">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[13px] border-[1.5px] border-line bg-white px-4 py-[15px] font-mono text-lg tracking-wide text-ink outline-none transition placeholder:text-muted/60 focus:border-navy";

export function Metric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-navy">{value}</p>
    </div>
  );
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as { ok: boolean; data?: T; error?: { message?: string } };
  if (!res.ok || !body.ok) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data as T;
}

export function authHeaders(key: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = sessionStorage.getItem(key);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
