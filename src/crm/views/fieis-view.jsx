import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeChassi, normalizePhone, searchClienteFiel } from "../tsi-resend.js";
import { ShinyButton } from "../ui/shiny-button.jsx";
import { CircularProgressSpinner } from "../ui/circular-progress.jsx";
const INP = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-line)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  borderRadius: 9,
  fontSize: 14,
  outline: "none",
  width: "100%",
  fontFamily: "inherit"
};
const GHOST_BTN = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 14px",
  borderRadius: 9,
  border: "1px solid var(--border-line)",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit"
};
export function FieisView({ fieis, onAdd, onEdit, onDelete }) {
  const [q, setQ] = useState("");
  const returnFocus = useRef(null);
  const [searchField, setSearchField] = useState("todos");
  const [saveError, setSaveError] = useState("");
  const [modal, setModal] = useState({
    open: false,
    id: null,
    nome: "",
    wa: "",
    chassi: ""
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const filtered = fieis.filter((f) => searchClienteFiel(f, q, searchField));
  const chassis = normalizeChassi(modal.chassi);
  const invalidChassi = !!chassis && chassis.length !== 17;
  function openAdd() {
    returnFocus.current = document.activeElement;
    setSaveError("");
    setModal({ open: true, id: null, nome: "", wa: "", chassi: "" });
  }
  function openEdit(f) {
    returnFocus.current = document.activeElement;
    setSaveError("");
    setModal({ open: true, id: f.id, nome: f.nome, wa: f.whatsapp || "", chassi: f.chassi || "" });
  }
  function dismissModal() {
    setModal({ open: false, id: null, nome: "", wa: "", chassi: "" });
    returnFocus.current?.focus();
  }
  function closeModal() {
    if (!saving) dismissModal();
  }
  async function handleSave() {
    if (!modal.nome.trim() || invalidChassi || saving) return;
    setSaveError("");
    setSaving(true);
    try {
      if (modal.id) {
        await onEdit(modal.id, modal.nome.trim(), modal.wa.trim() || null, chassis || null);
      } else {
        await onAdd(modal.nome.trim(), modal.wa.trim() || null, chassis || null);
      }
      dismissModal();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel salvar o cliente. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }
  function waLink(wa) {
    if (!wa) return null;
    const num = normalizePhone(wa);
    return num ? `https://wa.me/55${num}` : null;
  }
  return <div className="consultant-view consultant-loyalty view-enter flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Clientes Fiéis</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>{fieis.length} clientes cadastrados</p>
        </div>
        <ShinyButton onClick={openAdd} size="compact">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Adicionar cliente
        </ShinyButton>
      </div>

      {
    /* Search */
  }
      <div className="flex flex-wrap gap-2.5">
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Procurar em
          <select value={searchField} onChange={(e) => setSearchField(e.target.value)} style={{ ...INP, width: "auto" }}>
            <option value="todos">Nome, chassi e telefone</option>
            <option value="nome">Nome</option>
            <option value="chassi">Chassi</option>
            <option value="telefone">Telefone / WhatsApp</option>
          </select>
        </label>
      <div className="relative flex-1 min-w-[200px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
    aria-label="Buscar cliente fiel"
    value={q}
    onChange={(e) => setQ(e.target.value)}
    placeholder="Digite o nome, chassi ou telefone…"
    className="w-full"
    style={{ ...INP, paddingLeft: 36 }}
  />
      </div>
      </div>

      {
    /* List */
  }
      <div className="rounded-2xl overflow-hidden glass-effect" style={{ border: "1px solid var(--border-line-soft)" }}>
        {filtered.length === 0 ? <div className="flex flex-col items-center py-16" style={{ color: "var(--text-muted)" }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2.5 opacity-30"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
            <p className="text-sm">{fieis.length === 0 ? "Nenhum cliente fiel cadastrado" : "Nenhum resultado encontrado"}</p>
          </div> : filtered.map((f, i) => <div
    key={f.id}
    className={`flex items-center gap-4 px-5 py-4 transition-colors ${i < filtered.length - 1 ? "" : ""}`}
    style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border-line-soft)" : "none" }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "var(--bg-panel-2)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "transparent";
    }}
  >
              <div
    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-none"
    style={{ background: "#d7192026", color: "#d71920" }}
  >
                {f.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{f.nome}</div>
                {f.chassi && <div className="text-xs font-mono break-all mt-0.5" style={{ color: "var(--text-muted)" }}>Chassi: {f.chassi}</div>}
                {f.whatsapp && <a
    href={waLink(f.whatsapp) || "#"}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[12.5px] flex items-center gap-1 hover:underline mt-0.5"
    style={{ color: "#2fd675" }}
  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z" /></svg>
                    {f.whatsapp}
                  </a>}
              </div>
              <div className="flex gap-1.5 flex-none">
                <IconBtn title="Editar" onClick={() => openEdit(f)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </IconBtn>
                {confirmDelete === f.id ? <>
                    <IconBtn title="Confirmar exclusão" danger onClick={async () => {
    await onDelete(f.id);
    setConfirmDelete(null);
  }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    </IconBtn>
                    <IconBtn title="Cancelar" onClick={() => setConfirmDelete(null)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </IconBtn>
                  </> : <IconBtn title="Excluir" onClick={() => setConfirmDelete(f.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                  </IconBtn>}
              </div>
            </div>)}
      </div>

      {
    /* Modal */
  }
      {modal.open && createPortal(
    <div
      className="consultant-view fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--overlay-bg)", backdropFilter: "blur(3px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
          <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fiel-modal-title"
      className="w-full max-w-[420px] max-h-[90dvh] overflow-y-auto mx-4 rounded-2xl modal-anim"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border-line-soft)" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeModal();
        }
        if (e.key !== "Tab") return;
        const controls = Array.from(e.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-line-soft)" }}>
              <h3 id="fiel-modal-title" style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 19, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                {modal.id ? "Editar cliente" : "Adicionar cliente fiel"}
              </h3>
              <button
      aria-label="Fechar cadastro"
      disabled={saving}
      onClick={closeModal}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
      style={{ border: "1px solid var(--border-line)", background: "var(--bg-elevated)", color: "var(--text-dim)" }}
    >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fiel-nome" className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>Nome *</label>
                <input
      id="fiel-nome"
      autoFocus
      disabled={saving}
      value={modal.nome}
      onChange={(e) => setModal((m) => ({ ...m, nome: e.target.value }))}
      placeholder="Ex: João da Silva"
      style={{ ...INP, display: "block" }}
    />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fiel-whatsapp" className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>WhatsApp</label>
                <input
      id="fiel-whatsapp"
      disabled={saving}
      value={modal.wa}
      onChange={(e) => setModal((m) => ({ ...m, wa: e.target.value }))}
      placeholder="(82) 9 9999-9999"
      style={{ ...INP, display: "block" }}
      type="tel"
    />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fiel-chassi" className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>Chassi (opcional)</label>
                <input
      id="fiel-chassi"
      disabled={saving}
      value={modal.chassi}
      onChange={(e) => setModal((m) => ({ ...m, chassi: normalizeChassi(e.target.value) }))}
      aria-invalid={invalidChassi}
      aria-describedby="fiel-chassi-help"
      maxLength={17}
      placeholder="Ex: 9C2JB0100VR405913"
      style={{ ...INP, display: "block" }}
    />
                <p id="fiel-chassi-help" className="text-xs" style={{ color: invalidChassi ? "var(--color-brand)" : "var(--text-muted)" }}>
                  {invalidChassi ? "Informe os 17 caracteres do chassi." : "Usado para localizar o cliente na planilha de reenvio sem nome."}
                </p>
              </div>
              {saveError && <p role="alert" className="text-sm" style={{ color: "var(--text-primary)" }}>{saveError}</p>}
            </div>
            <div className="px-5 py-4 flex justify-end gap-2.5" style={{ borderTop: "1px solid var(--border-line-soft)" }}>
              <button disabled={saving} onClick={closeModal} style={GHOST_BTN}>Cancelar</button>
              <ShinyButton onClick={handleSave} disabled={saving || !modal.nome.trim() || invalidChassi} size="compact">
                {saving ? <><CircularProgressSpinner size={18} thickness={2.2} label="Salvando cliente" /> Salvando…</> : "Salvar"}
              </ShinyButton>
            </div>
          </div>
        </div>,
    document.querySelector(".consultant-shell") || document.body
  )}
    </div>;
}
function IconBtn({ children, onClick, title, danger }) {
  return <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors"
    style={{
      border: "1px solid var(--border-line)",
      background: danger ? "#ff5a5f26" : "var(--bg-elevated)",
      color: danger ? "#ff5a5f" : "var(--text-dim)"
    }}
  >
      {children}
    </button>;
}
