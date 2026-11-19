export function normalizeName(value) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}
export function normalizeChassi(value) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function normalizePhone(value) {
  let digits = (value || "").replace(/\D/g, "");
  if (digits.startsWith("0055") && [14, 15].includes(digits.length)) digits = digits.slice(4);
  else if (digits.startsWith("55") && [12, 13].includes(digits.length)) digits = digits.slice(2);
  return [10, 11].includes(digits.length) ? digits : "";
}
export function getResendChassi(row) {
  if (row.chassi) return normalizeChassi(row.chassi);
  const vehicle = normalizeChassi(row.veiculo);
  return vehicle.length === 17 ? vehicle : "";
}
export function matchesClienteFiel(row, fiel, fields) {
  return fields.some((field) => {
    if (field === "chassi") {
      const chassis = getResendChassi(row);
      return chassis.length === 17 && chassis === normalizeChassi(fiel.chassi);
    }
    if (field === "telefone") {
      const phone = normalizePhone(row.celular);
      return !!phone && phone === normalizePhone(fiel.whatsapp);
    }
    const name = normalizeName(row.cliente);
    const loyalName = normalizeName(fiel.nome);
    if (!name || !loyalName) return false;
    if (name === loyalName) return true;
    const parts = name.split(" ");
    const loyalParts = loyalName.split(" ");
    return parts.length > 1 && loyalParts.length > 1 && parts[0] === loyalParts[0] && parts[parts.length - 1] === loyalParts[loyalParts.length - 1];
  });
}
export function searchClienteFiel(fiel, query, field) {
  if (!query.trim()) return true;
  const name = normalizeName(query);
  const chassis = normalizeChassi(query);
  const phone = normalizePhone(query) || query.replace(/\D/g, "");
  return (field === "todos" || field === "nome") && normalizeName(fiel.nome).includes(name) || (field === "todos" || field === "chassi") && !!chassis && normalizeChassi(fiel.chassi).includes(chassis) || (field === "todos" || field === "telefone") && !!phone && normalizePhone(fiel.whatsapp).includes(phone);
}
function column(row, ...aliases) {
  for (const alias of aliases) {
    const key = Object.keys(row).find((key2) => normalizeName(key2) === normalizeName(alias));
    if (key !== void 0 && String(row[key] ?? "").trim()) return row[key];
  }
  return "";
}
function textColumn(row, ...aliases) {
  return String(column(row, ...aliases)).trim();
}
function formatDate(value) {
  if (value === "" || value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 864e5));
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  }
  const text = String(value).trim().split(" ")[0].split("T")[0];
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(text)) return text.split(/[-/]/).reverse().join("/");
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  return text || null;
}
export function mapTsiResendRow(row) {
  const os = textColumn(row, "Ordens de Servi\xE7o: OS", "OS", "O.S.", "N\xB0 O.S.", "N\xBA O.S.");
  if (!os) return null;
  const veiculo = textColumn(row, "Ve\xEDculo", "Modelo") || null;
  const chassis = textColumn(row, "Chassi", "Chassis", "N\xFAmero do chassi", "N\xBA do chassi", "VIN");
  return {
    os,
    cliente: textColumn(row, "Cliente", "Nome do Cliente", "Nome Cliente", "Nome", "Pessoa") || null,
    veiculo,
    chassi: normalizeChassi(chassis) || getResendChassi({ veiculo }) || null,
    email: textColumn(row, "E-mail do Cliente", "E-mail", "Email") || null,
    celular: textColumn(row, "Celular do Cliente", "Celular", "Telefone Celular", "Telefone") || null,
    data_envio_email: formatDate(column(row, "Data de envio pesquisa por email", "Data envio e-mail", "Data Envio Email", "Envio e-mail")),
    data_envio_sms: formatDate(column(row, "Data de envio pesquisa por SMS", "Data envio SMS", "Envio SMS")),
    data_reenvio: formatDate(column(row, "Data de reenvio do TSI", "Data reenvio", "Reenvio"))
  };
}
