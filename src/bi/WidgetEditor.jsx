import { Chart } from "./Chart.jsx";
import { LARGURAS, ALTURAS, ajustarLargura, ajustarAltura } from "./widgetLayout.js";

// Editor de widget enxuto e visual: prévia ao vivo no topo, formatos com miniatura,
// tamanho escolhido por desenho (sem pixels nem colunas) e o resto em "Mais opções".
const COR = "currentColor";
const MINIS = {
  bar: <><rect x="4" y="18" width="6" height="12" rx="1.5" /><rect x="13" y="10" width="6" height="20" rx="1.5" /><rect x="22" y="14" width="6" height="16" rx="1.5" /><rect x="31" y="6" width="6" height="24" rx="1.5" /></>,
  line: <polyline points="3,26 12,17 20,21 29,9 37,13" fill="none" stroke={COR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  area: <><path d="M3,26 L12,17 L20,21 L29,9 L37,13 L37,30 L3,30 Z" opacity=".3" /><polyline points="3,26 12,17 20,21 29,9 37,13" fill="none" stroke={COR} strokeWidth="2.2" strokeLinejoin="round" /></>,
  pie: <><path d="M20,18 L20,4 A14,14 0 0,1 33.3,22.3 Z" /><path d="M20,18 L33.3,22.3 A14,14 0 1,1 20,4 Z" opacity=".35" /></>,
  donut: <><circle cx="20" cy="17" r="11" fill="none" stroke={COR} strokeWidth="6" opacity=".3" /><path d="M20,6 A11,11 0 0,1 30.5,20.4" fill="none" stroke={COR} strokeWidth="6" /></>,
  grid: <>{[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={4 + c * 8.5} y={4 + r * 8.5} width="7" height="7" rx="1.5" opacity={[.25, .5, .8, 1][(r + c) % 4]} />))}</>,
  table: <>{[0, 1, 2, 3].map((r) => <g key={r}><rect x="4" y={5 + r * 7} width="20" height="3.5" rx="1.5" opacity=".5" /><rect x="28" y={5 + r * 7} width="9" height="3.5" rx="1.5" /></g>)}</>,
};
const TAMANHOS_LARGURA = { 4: "⅓", 6: "½", 8: "⅔", 12: "Inteiro" };
const PALETA = ["#cc0000", "#f97316", "#f59e0b", "#16a34a", "#0d9488", "#3b82f6", "#7c3aed", "#64748b"];

function Opcoes({ valor, opcoes, onEscolher, nome }) {
  return (
    <div className="we-seg" role="radiogroup" aria-label={nome}>
      {Object.entries(opcoes).map(([v, rotulo]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => onEscolher(v)}>{rotulo}</button>
      ))}
    </div>
  );
}

export function WidgetEditor({ widget, patch, dims, types, canCompare, lojas, canais, dados, onDuplicar, onRemover, onFechar }) {
  const display = widget.display || {};
  const largura = ajustarLargura(widget.width);
  const altura = ajustarAltura(widget.height);
  const pode = (campo) => {
    if (campo === "meta") return canCompare && !["pie", "donut"].includes(widget.type);
    if (["grid", "table"].includes(widget.type)) return false;
    if (campo === "grid") return ["bar", "line", "area"].includes(widget.type);
    return true;
  };
  return (
    <>
      <header className="we-topo">
        <input className="we-titulo" aria-label="Título do widget" value={widget.title} maxLength={80} onChange={(e) => patch({ title: e.target.value })} />
        <button type="button" autoFocus aria-label="Fechar editor" className="we-fechar" onClick={onFechar}>×</button>
      </header>

      <div className="we-previa" aria-label="Prévia do widget">
        <Chart data={dados} type={widget.type} metric={widget.metric} color={widget.color} options={{ ...display, values: false }} compare={false} onSelect={() => {}} />
      </div>

      <section className="we-bloco">
        <h3>Formato</h3>
        <div className="we-formatos" role="radiogroup" aria-label="Formato">
          {Object.entries(types).map(([v, rotulo]) => (
            <button key={v} type="button" role="radio" aria-checked={widget.type === v} onClick={() => patch({ type: v })} style={{ "--we-cor": widget.color || "#cc0000" }}>
              <svg viewBox="0 0 40 32" aria-hidden="true" fill={COR}>{MINIS[v]}</svg>
              <span>{rotulo}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="we-bloco">
        <h3>Mostrar por</h3>
        <div className="we-chips" role="radiogroup" aria-label="Agrupar por">
          {Object.entries(dims).map(([v, rotulo]) => (
            <button key={v} type="button" role="radio" aria-checked={widget.dimension === v} onClick={() => patch({ dimension: v })}>{rotulo}</button>
          ))}
        </div>
      </section>

      <section className="we-bloco">
        <h3>Medir</h3>
        <Opcoes nome="Medir" valor={widget.metric || "value"} onEscolher={(v) => patch({ metric: v })} opcoes={{ value: "Receita (R$)", quantity: "Peças", records: "Registros" }} />
      </section>

      <section className="we-bloco">
        <h3>Tamanho</h3>
        <div className="we-larguras" role="radiogroup" aria-label="Largura">
          {LARGURAS.map((w) => (
            <button key={w} type="button" role="radio" aria-checked={largura === w} onClick={() => patch({ width: w, tileSize: null })}>
              <span className="we-linha" aria-hidden="true"><i style={{ width: `${(w / 12) * 100}%` }} /></span>
              {TAMANHOS_LARGURA[w]}
            </button>
          ))}
        </div>
        <div className="we-alturas" role="radiogroup" aria-label="Altura">
          {ALTURAS.map((a, i) => (
            <button key={a.id} type="button" role="radio" aria-checked={altura === a.px} onClick={() => patch({ height: a.px, tileSize: null })}>
              <span className="we-alto" aria-hidden="true"><i style={{ height: `${40 + i * 30}%` }} /></span>
              {a.rotulo}
            </button>
          ))}
        </div>
      </section>

      <details className="we-mais">
        <summary>Mais opções</summary>
        <div className="we-mais-corpo">
          <label>Dados
            <Opcoes nome="Origem dos dados" valor={widget.source || ""} onEscolher={(v) => patch({ source: v })} opcoes={{ "": "Tudo", pieces: "Peças", services: "Serviços" }} />
          </label>
          <div className="we-duas">
            <label>Loja
              <select value={widget.store || ""} onChange={(e) => patch({ store: e.target.value })}>
                <option value="">Todas</option>
                {lojas.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label>Canal
              <select value={widget.channel || ""} onChange={(e) => patch({ channel: e.target.value })}>
                <option value="">Todos</option>
                {canais.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Ordem
              <select value={widget.sort || "desc"} onChange={(e) => patch({ sort: e.target.value })}>
                <option value="desc">Maior primeiro</option>
                <option value="asc">Menor primeiro</option>
                <option value="achievement">Mais perto da meta</option>
                <option value="remaining">Menos falta para a meta</option>
              </select>
            </label>
            <label>Itens
              <select value={[5, 10, 20, 50].includes(Number(widget.limit)) ? Number(widget.limit) : 20} onChange={(e) => patch({ limit: Number(e.target.value) })}>
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </label>
          </div>
          <div>
            <span className="we-rotulo">Cor</span>
            <div className="we-cores" role="radiogroup" aria-label="Cor">
              {PALETA.map((c) => <button key={c} type="button" role="radio" aria-checked={(widget.color || "").toLowerCase() === c} aria-label={c} style={{ background: c }} onClick={() => patch({ color: c })} />)}
            </div>
          </div>
          <div className="we-chaves">
            {Object.entries({ legend: "Legenda", tooltip: "Detalhes no mouse", values: "Lista de valores", grid: "Linhas de referência", meta: "Comparar com metas" })
              .filter(([campo]) => pode(campo))
              .map(([campo, rotulo]) => (
                <label key={campo} className="we-chave">
                  <input type="checkbox" role="switch" checked={campo === 'values' || (campo === 'legend' && !['pie', 'donut'].includes(widget.type)) ? display[campo] === true : display[campo] !== false} onChange={(e) => patch({ display: { ...display, [campo]: e.target.checked } })} />
                  <span>{rotulo}</span>
                </label>
              ))}
          </div>
        </div>
      </details>

      <footer className="we-rodape">
        <button type="button" className="we-fantasma" onClick={onDuplicar}>Duplicar</button>
        <button type="button" className="we-fantasma we-perigo" onClick={onRemover}>Remover</button>
        <button type="button" className="we-pronto" onClick={onFechar}>Pronto</button>
      </footer>
    </>
  );
}
