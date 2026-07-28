/** Pilot / demo citizen — fixed for easy testing. */
export const DEMO_CITIZEN_PHONE = "+250780000001";
export const DEMO_OTP_CODE = "1234";

/** Open OTP until GQ_STRICT_AUTH=1 (pilot default: on, including ebm.rw). */
export function isOpenLoginEnabled() {
  if (process.env.GQ_STRICT_AUTH === "1") return false;
  if (process.env.GQ_OPEN_LOGIN === "0") return false;
  return true;
}

export function isOpenLoginClientHint() {
  return process.env.NEXT_PUBLIC_GQ_OPEN_LOGIN !== "0" && process.env.NEXT_PUBLIC_GQ_STRICT_AUTH !== "1";
}

export function normalizeRwandaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("250") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+250${digits.slice(1)}`;
  if (digits.length === 9) return `+250${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

export function isDemoOtpCode(code: string): boolean {
  if (!isOpenLoginEnabled()) return false;
  const c = code.trim();
  return c === DEMO_OTP_CODE || c === "123456";
}
