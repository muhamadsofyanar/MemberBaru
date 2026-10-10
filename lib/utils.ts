export const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
export const dateID = (date: Date | string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(date));
export const absoluteUrl = (path = "") => `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${path}`;

export function makeReferralCode(name: string) {
  const base = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() || "MEMBER";
  return `${base}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function makeInvoice() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RQH-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
