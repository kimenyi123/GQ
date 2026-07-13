"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

export const DEMO_TIN = "100000101";
export const DEMO_MRC = "ISHSER000001";
export const DEMO_GQ = "GQ-000001";
export const DEMO_DOC = "ORD-SER0001";
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

const FLAG_SRC: Record<string, string> = {
  rw: "/brand/flag-rw.png",
  en: "/brand/flag-en.png",
  fr: "/brand/flag-fr.png",
  sw: "/brand/flag-sw.png",
};

const FLAG_ALT: Record<string, string> = {
  rw: "Kinyarwanda",
  en: "English",
  fr: "Français",
  sw: "Kiswahili",
};

export function RraHeader() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/rra-logo.png"
        alt="Rwanda Revenue Authority"
        className="block h-[52px] w-auto"
      />
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
          className={`flex min-w-[58px] flex-col items-center gap-1 rounded-[13px] border-[1.5px] bg-white px-2.5 pb-1.5 pt-2 transition active:scale-95 ${
            lang === item ? "border-navy shadow-[0_3px_10px_-4px_rgba(18,58,94,.5)]" : "border-line"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FLAG_SRC[item]}
            alt={FLAG_ALT[item]}
            className="block h-[22px] w-[30px] rounded-[3px] object-cover"
          />
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

export function BuyerSubNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/", label: t("buyer.tabAsk"), active: pathname === "/" },
    { href: "/my", label: t("buyer.tabRequests"), active: pathname === "/my" || pathname.startsWith("/r/") || pathname.startsWith("/i/") },
  ];

  return (
    <div className="mb-5 flex gap-2 rounded-2xl border border-line bg-white p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-bold transition ${
            item.active ? "bg-navy text-white" : "text-navy hover:bg-paper"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function CitizenShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <CitizenShellInner>{children}</CitizenShellInner>
    </I18nProvider>
  );
}

function CitizenShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-sans text-ink">
      <div className="relative flex flex-col items-center px-[18px] pb-1 pt-[18px]">
        <div className="absolute right-[18px] top-[18px]">
          <BurgerMenu />
        </div>
        <RraHeader />
      </div>
      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-[22px] pb-[18px] pt-1.5">
        {isLanding ? <LangSwitcher /> : null}
        <div className={isLanding ? "mt-5" : "mt-2"}>
          <BuyerSubNav />
          {children}
        </div>
      </main>
      <Footer />
    </div>
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/rra-logo.png"
                  alt="Rwanda Revenue Authority"
                  className="h-12 w-auto"
                />
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-navy">
                    Rwanda Revenue Authority
                  </p>
                  <p className="text-sm text-muted">ebm.rw · Global QR</p>
                </div>
              </Link>
              <BurgerMenu />
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
    ["Buyer", "/"],
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

type LoginResult = { token: string; role?: string; tin?: string; vendorId?: string };

const ROLE_ITEMS = [
  { id: "citizen", href: "/", labelKey: "menu.citizen", hint: "+250788000001" },
  { id: "seller", href: "/seller", labelKey: "menu.seller", hint: "Chez Kivu" },
  { id: "vendor", href: "/vendor", labelKey: "menu.vendor", hint: "Ishyiga" },
  { id: "rra", href: "/rra", labelKey: "menu.rra", hint: "Analyst" },
  { id: "admin", href: "/admin", labelKey: "menu.admin", hint: "GQ ops" },
] as const;

async function demoLogin(role: (typeof ROLE_ITEMS)[number]["id"]) {
  if (role === "citizen") {
    // Issue+verify OTP automatically for demo buyer inbox
    const issue = await apiJson<{ debugCode?: string }>("/api/v1/otp/issue", {
      method: "POST",
      body: JSON.stringify({ phone: "+250788000001" }),
    });
    const verify = await apiJson<{ token: string }>("/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({
        phone: "+250788000001",
        code: issue.debugCode ?? "123456",
      }),
    });
    sessionStorage.setItem("gq_citizen_jwt", verify.token);
    sessionStorage.setItem("gq_role", "citizen");
    return;
  }
  if (role === "seller") {
    const login = await apiJson<LoginResult>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({
        grant_type: "password",
        phone: "+250788000010",
        password: DEMO_PASSWORD,
      }),
    });
    sessionStorage.setItem("gq_seller_jwt", login.token);
    sessionStorage.setItem("gq_role", "seller");
    return;
  }
  if (role === "vendor") {
    const login = await apiJson<LoginResult>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: "gq_ishyiga_demo",
        client_secret: "demo-oauth-secret",
      }),
    });
    sessionStorage.setItem("gq_vendor_jwt", login.token);
    sessionStorage.setItem("gq_role", "vendor");
    return;
  }
  if (role === "rra") {
    const login = await apiJson<LoginResult>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ role: "rra" }),
    });
    sessionStorage.setItem("gq_rra_jwt", login.token);
    sessionStorage.setItem("gq_role", "rra");
    return;
  }
  const login = await apiJson<LoginResult>("/api/v1/auth/token", {
    method: "POST",
    body: JSON.stringify({ role: "admin" }),
  });
  sessionStorage.setItem("gq_admin_jwt", login.token);
  sessionStorage.setItem("gq_role", "admin");
}

export function BurgerMenu() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeRole, setActiveRole] = useState("");

  useEffect(() => {
    setActiveRole(sessionStorage.getItem("gq_role") ?? "");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function loginAs(role: (typeof ROLE_ITEMS)[number]["id"], href: string) {
    setBusy(true);
    setError("");
    try {
      await demoLogin(role);
      setOpen(false);
      router.push(`${href}?autologin=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("menu.loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-navy shadow-sm"
      >
        <span className="flex w-5 flex-col gap-1.5">
          <span className="block h-0.5 w-full rounded bg-navy" />
          <span className="block h-0.5 w-full rounded bg-navy" />
          <span className="block h-0.5 w-full rounded bg-navy" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(100%,320px)] flex-col bg-paper shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{t("menu.title")}</p>
                <p className="text-sm text-muted">{t("menu.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-navy"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-muted">
                {t("menu.language")}
              </p>
              <div className="mb-6 px-1">
                <LangSwitcher />
              </div>

              <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wide text-muted">
                {t("menu.loginAs")}
              </p>
              <div className="space-y-2">
                {ROLE_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => loginAs(item.id, item.href)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      activeRole === item.id
                        ? "border-navy bg-navy text-white"
                        : "border-line bg-white text-ink hover:border-navy"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">{t(item.labelKey)}</span>
                      <span className={`block text-xs ${activeRole === item.id ? "text-white/70" : "text-muted"}`}>
                        {item.hint}
                      </span>
                    </span>
                    <span className="text-lg leading-none">→</span>
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-6 px-2 text-xs font-bold uppercase tracking-wide text-muted">
                {t("menu.more")}
              </p>
              <div className="space-y-2">
                <Link
                  href="/demo-qr"
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-navy"
                >
                  {t("openDemoQr")}
                </Link>
                <Link
                  href="/status"
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-navy"
                >
                  {t("menu.status")}
                </Link>
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-navy"
                >
                  {t("menu.home")}
                </Link>
              </div>

              {error ? <p className="mt-4 px-2 text-sm text-gold">{error}</p> : null}
              {busy ? <p className="mt-4 px-2 text-sm text-muted">{t("menu.signingIn")}</p> : null}
            </div>

            <p className="border-t border-line px-4 py-3 text-xs text-muted">{t("menu.demoNote")}</p>
          </aside>
        </div>
      ) : null}
    </>
  );
}

