import { useState, useMemo } from "react";
import { getResendChassi, matchesClienteFiel, normalizeName, searchClienteFiel } from "../tsi-resend.js";
import { ShinyButton } from "../ui/shiny-button.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
const INP = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-line)",
  color: "var(--text-primary)",
  padding: "9px 12px",
  borderRadius: 9,
  fontSize: 13.5,
  outline: "none",
  fontFamily: "inherit"
};
export function TsiResendView({ data, tsiData = [], fieis = [], onImport, onMarkSent }) {
  const [q, setQ] = useState("");
  const [pendFilter, setPendFilter] = useState("");
  const [loyaltyFilter, setLoyaltyFilter] = useState("all");
  const [loyaltyFields, setLoyaltyFields] = useState(["nome", "chassi", "telefone"]);
  const [searchField, setSearchField] = useState("todos");
  const processedData = useMemo(() => {
    return data.map((resend) => {
      const tsiMatch = tsiData.find((t) => t.os.replace(/\s/g, "") === resend.os.replace(/\s/g, ""));
      const matches = fieis.filter((f) => matchesClienteFiel(resend, f, loyaltyFields));
      const names = new Set(matches.map((f) => f.nome));
      const nomeCadastro = names.size === 1 ? matches[0].nome : null;
      return { ...resend, tsiStatus: tsiMatch ? tsiMatch.t2b : null, isFiel: matches.length > 0, nomeCadastro };
    });
  }, [data, tsiData, fieis, loyaltyFields]);
  const filtered = useMemo(() => processedData.filter((r) => {
    const text = normalizeName(q);
    const identity = { nome: r.cliente || r.nomeCadastro, chassi: getResendChassi(r), whatsapp: r.celular };
    const identityMatch = searchField !== "os" && searchField !== "veiculo" && searchClienteFiel(identity, q, searchField);
    const osMatch = (searchField === "todos" || searchField === "os") && normalizeName(r.os).includes(text);
    const vehicleMatch = (searchField === "todos" || searchField === "veiculo") && normalizeName(r.veiculo).includes(text);
    if (text && !identityMatch && !osMatch && !vehicleMatch) return false;
    if (pendFilter === "pendente" && r.data_reenvio) return false;
    if (pendFilter === "reenviado" && !r.data_reenvio) return false;
    if (loyaltyFilter === "loyal" && !r.isFiel) return false;
    return true;
  }), [processedData, q, pendFilter, loyaltyFilter, searchField]);
  const pendentes = data.filter((r) => !r.data_reenvio).length;
  return <div className="consultant-view consultant-surveys view-enter flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Reenvio de Pesquisas</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>{filtered.length} de {data.length} registros · {pendentes} pendente{pendentes !== 1 ? "s" : ""}</p>
        </div>
        <ShinyButton onClick={onImport} size="compact">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></svg>
          Importar planilha
        </ShinyButton>
      </div>

      {
    /* Filters */
  }
      <div className="responsive-filter-row flex flex-wrap gap-2.5">
        <div className="responsive-search relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input aria-label="Buscar pesquisas de reenvio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, chassi, telefone ou O.S.…" className="w-full" style={{ ...INP, paddingLeft: 36 }} />
        </div>
        <select aria-label="Procurar em" value={searchField} onChange={(e) => setSearchField(e.target.value)} style={INP}>
          <option value="todos">Procurar em: Todos os campos</option>
          <option value="nome">Procurar em: Nome</option>
          <option value="chassi">Procurar em: Chassi</option>
          <option value="telefone">Procurar em: Telefone / WhatsApp</option>
          <option value="os">Procurar em: O.S.</option>
          <option value="veiculo">Procurar em: Veículo</option>
        </select>
        <select aria-label="Status do reenvio" value={pendFilter} onChange={(e) => setPendFilter(e.target.value)} style={{ ...INP, minWidth: 155 }}>
          <option value="">Status Reenvio: Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="reenviado">Reenviados</option>
        </select>
        <select aria-label="Filtro de fidelidade" value={loyaltyFilter} onChange={(e) => setLoyaltyFilter(e.target.value)} style={{ ...INP, minWidth: 155 }}>
          <option value="all">Filtro Fidelidade: Todos</option>
          <option value="loyal">Apenas Clientes Fiéis</option>
        </select>
      </div>
      <fieldset className="rounded-xl px-3.5 py-3" style={{ border: "1px solid var(--border-line-soft)" }}>
        <legend className="px-1 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Identificar clientes fiéis por</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {["nome", "chassi", "telefone"].map((field) => <label key={field} className="inline-flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-primary)" }}>
              <input type="checkbox" checked={loyaltyFields.includes(field)} onChange={(e) => {
    setLoyaltyFields((prev) => e.target.checked ? [...prev, field] : prev.filter((value) => value !== field));
  }} />
              {field === "nome" ? "Nome" : field === "chassi" ? "Chassi" : "Telefone / WhatsApp"}
            </label>)}
        </div>
        <p role="status" className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {loyaltyFields.length ? "Basta coincidir um dos campos selecionados. A nova planilha usa o chassi em Ve\xEDculo e o n\xFAmero em Celular do Cliente." : "Selecione ao menos um campo para identificar clientes fi\xE9is."}
        </p>
      </fieldset>

      {
    /* Table */
  }
      <div className="rounded-2xl overflow-hidden glass-effect" style={{ border: "1px solid var(--border-line-soft)" }}>
        {filtered.length === 0 ? <div className="flex flex-col items-center py-16" style={{ color: "var(--text-muted)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2.5 opacity-35"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></svg>
            <p className="text-sm">{data.length === 0 ? "Nenhuma planilha de reenvio importada" : "Nenhum resultado encontrado"}</p>
            {data.length === 0 && <button onClick={onImport} className="mt-3 text-xs text-[#d71920] hover:underline cursor-pointer">
                Importar planilha de reenvio
              </button>}
          </div> : <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {["O.S.", "Cliente", "Status TSI", "Chassi", "Ve\xEDculo", "E-mail", "Celular", "Envio e-mail", "Envio SMS", "Reenvio", ""].map((h) => <th
    key={h}
    className="text-left px-3.5 py-2.5 text-[10.5px] uppercase tracking-widest font-bold whitespace-nowrap"
    style={{ background: "var(--bg-panel-2)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-line-soft)" }}
  >{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => <tr
    key={r.id}
    className="transition-colors last:border-0"
    style={{ borderBottom: "1px solid var(--border-line-soft)" }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "var(--bg-panel-2)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "transparent";
    }}
  >
                    <td className="px-3.5 py-2.5 font-mono text-xs" style={{ color: "var(--text-dim)" }}>{r.os}</td>
                    <td className="px-3.5 py-2.5 font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      <div className="flex items-center gap-2">
                        {r.cliente || r.nomeCadastro || "Sem nome na planilha"}
                        {r.isFiel && <span title="Cliente Fiel" aria-label="Cliente fiel" className="flex-none">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                          </span>}
                      </div>
                      {!r.cliente && r.nomeCadastro && <div className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>Nome do cadastro de clientes fiéis</div>}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {r.tsiStatus !== null ? <StatusBadge variant={r.tsiStatus === 100 ? "success" : "failed"} size="sm">
                          T2B: {r.tsiStatus}
                        </StatusBadge> : <span className="text-[10px] opacity-40">—</span>}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-xs" style={{ color: "var(--text-dim)" }}>{getResendChassi(r) || "\u2014"}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.veiculo === getResendChassi(r) ? "\u2014" : r.veiculo || "\u2014"}</td>
                    <td className="px-3.5 py-2.5" style={{ color: "var(--text-dim)" }}>{r.email || "\u2014"}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.celular || "\u2014"}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{r.data_envio_email || "\u2014"}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{r.data_envio_sms || "\u2014"}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {r.data_reenvio ? <StatusBadge variant="submitted" size="sm">Reenviado · {r.data_reenvio}</StatusBadge> : <StatusBadge status="Pendente" size="sm" />}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {!r.data_reenvio ? <button
    onClick={() => onMarkSent(r.id, (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR"))}
    className="text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:brightness-110"
    style={{ background: "#d71920", color: "#fff" }}
  >
                          Marcar reenviado
                        </button> : <button
    onClick={() => onMarkSent(r.id, null)}
    className="text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:opacity-80"
    style={{ border: "1px solid var(--border-line)", color: "var(--text-dim)", background: "transparent" }}
  >
                          Desfazer
                        </button>}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </div>
    </div>;
}
