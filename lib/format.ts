const MONTHS_CA = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

export function formatDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_CA[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_CA[d.getMonth()].slice(0, 3)}`;
}

export function formatDateRange(start?: string, end?: string) {
  if (!start && !end) return undefined;
  if (start && !end) return formatDate(start);
  if (!start && end) return formatDate(end);
  const s = new Date(start!);
  const e = new Date(end!);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_CA[s.getMonth()]} ${s.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} ${MONTHS_CA[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS_CA[e.getMonth()].slice(0, 3)} ${s.getFullYear()}`;
  }
  return `${formatShortDate(start)} ${s.getFullYear()} – ${formatShortDate(end)} ${e.getFullYear()}`;
}

export function formatMoney(amount?: number, currency = "EUR") {
  if (amount == null) return undefined;
  const symbol = currency === "EUR" ? "€" : currency;
  return `${amount.toLocaleString("ca-ES")} ${symbol}`;
}

export const TYPE_LABELS_CA: Record<string, string> = {
  deep: "viatge llarg",
  weekend: "escapada",
  day: "dia",
};

export const STATUS_LABELS_CA: Record<string, string> = {
  planning: "planificant",
  active: "en curs",
  completed: "viscut",
  archived: "arxivat",
};
