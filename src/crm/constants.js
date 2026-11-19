export const TSI_META = 93.5;
export const TSI_YELLOW = 92;
export const TSI_META_PESQ = 15;
export const TSI_STORE_MAP = {
  "PAVS-PERNAMBUCO PAUDALHO": "Paudalho",
  "PDF-PERNAMBUCO MOTOS": "Boa Viagem",
  "PAVS-PERNAMBUCO JABO": "Jaboat\xE3o",
  "PD-PERNAMBUCO GRACAS": "Gra\xE7as",
  "PAVS-PERNAMBUCO MOTOS": "Igarassu",
  "PERNAMBUCO OLINDA": "Peixinhos",
  "PERNAMBUCO MOTOS": "Paulista",
  "PERNAMBUCO CAMARAGIB": "Camaragibe",
  "ALAGOAS MOTOS": "Alagoas"
};
export const TSI_CATS = ["Alta", "M\xE9dia", "Baixa", "Scooter"];
export const STATUS_OPTIONS = [
  "Novo",
  "Em contato",
  "Proposta enviada",
  "Convertido",
  "Perdido"
];
export const STATUS_COLORS = {
  "Novo": { bg: "#4c8dff26", text: "#4c8dff" },
  "Em contato": { bg: "#ffc40033", text: "#ffc400" },
  "Proposta enviada": { bg: "#b083ff26", text: "#b083ff" },
  "Convertido": { bg: "#2fd67526", text: "#2fd675" },
  "Perdido": { bg: "#ff5a5f26", text: "#ff5a5f" }
};
export const ORIGEM_COLORS = {
  "Bot WhatsApp": { bg: "#b083ff26", text: "#b083ff" },
  "Website": { bg: "#4c8dff26", text: "#4c8dff" },
  "MicroWork OS": { bg: "#ffc40033", text: "#ffc400" },
  "WhatsApp": { bg: "#25D36626", text: "#25D366" },
  "Balcão": { bg: "#ff980026", text: "#ff9800" },
  "Telefone": { bg: "#00bcd426", text: "#00bcd4" },
  "Pesquisa TSI": { bg: "#9c27b026", text: "#9c27b0" }
};
export function tsiColor(score) {
  if (score >= TSI_META) return "green";
  if (score >= TSI_YELLOW) return "yellow";
  return "red";
}
export function tsiPesqColor(count) {
  if (count >= TSI_META_PESQ) return "green";
  if (count >= 12) return "yellow";
  return "red";
}
export function fmtDate(iso) {
  if (!iso) return "\u2014";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
export function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function todayISO() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
