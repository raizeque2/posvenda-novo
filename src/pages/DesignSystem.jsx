/**
 * DesignSystem.jsx — rota pública /design
 * Demonstração ao vivo de todos os componentes do DS.jsx.
 * Esta página NÃO afeta o app — serve para validar antes de aplicar.
 * Quando aprovar aqui, é só aplicar nas páginas reais importando do DS.jsx.
 */
import { useState } from 'react'
import {
  Calendar, Building2, Users, Layers, Package, TrendingUp,
  BarChart2, AlertTriangle, Download, Settings, Clock,
  SlidersHorizontal, Plus, Trash2, Save,
} from '../icons/iconoir'
import {
  Page, ActionBar, FiltersBar, Divider, Chip,
  KpiStrip, Card, CardHead, ColSelector,
  Dot, Tag, Skeleton, SaveBar,
  PageTitle, SectionTitle, FieldLabel,
  useSort, ThSort, Th, Td, TrHover, TrTotal,
  EmptyState, LojaBadge, SKELETON_CSS, FormDropdown,
} from '../components/DS'

// ─── Dados de exemplo ────────────────────────────────────────────────────────
const LINHAS = [
  { loja: 'ARA', cod: 'AC139CHU2002VM',  desc: 'Capa de chuva Honda Nylon Vermelho Tam P', tipo: 'Vestuário', qtde: 13, custo: 2337.27, pv: 4522.70, margem: 0.483, curva: 'E' },
  { loja: 'PEI', cod: 'AC1136JAQ2003CZ', desc: 'Jaqueta Alpinestars Honda Cinza',           tipo: 'Vestuário', qtde:  1, custo: 1202.94, pv: 2624.90, margem: 0.542, curva: 'D' },
  { loja: 'CAM', cod: 'UMK450TUEBT',     desc: 'Roçadeira Honda 2,3 HP (lâmina 3 facas)',   tipo: 'Motores',  qtde:  3, custo: 6840.81, pv: 13088.70,margem: 0.477, curva: 'D' },
  { loja: 'GRA', cod: '12100K2KB00',     desc: 'Bloco cilindro motor',                       tipo: 'Motos',    qtde:  2, custo: 2020.96, pv: 3077.94, margem: 0.343, curva: 'C' },
]
const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = v => `${(v * 100).toFixed(1)}%`

const CURVA_COR = { A: 'green', B: 'blue', C: 'gray', D: 'amber', E: 'red' }

// ─── Seção da demo ────────────────────────────────────────────────────────────
function Secao({ titulo, sub, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text3)', marginBottom: 2 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>{sub}</div>}
      </div>
      {children}
    </section>
  )
}

// ─── Tabela de demonstração ───────────────────────────────────────────────────
function TabelaDemo() {
  const { sortCol, sortDir, onSort, sortFn } = useSort('custo', 'desc')
  const [cols, setCols] = useState({ pv: true, margem: true })
  const linhas = [...LINHAS].sort(sortFn)
  const totCusto = LINHAS.reduce((s, r) => s + r.custo, 0)
  const totPv    = LINHAS.reduce((s, r) => s + r.pv, 0)

  return (
    <Card>
      <CardHead
        title="Estoque"
        badge={LINHAS.length}
        action={
          <ColSelector
            cols={cols}
            defs={[{ k: 'pv', l: 'P. Venda' }, { k: 'margem', l: 'Margem' }]}
            onChange={setCols}
          />
        }
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>Loja</Th>
              <ThSort col="cod"    sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Código</ThSort>
              <ThSort col="desc"   sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Descrição</ThSort>
              <ThSort col="qtde"   sortCol={sortCol} sortDir={sortDir} onSort={onSort} num>Qtde</ThSort>
              <ThSort col="custo"  sortCol={sortCol} sortDir={sortDir} onSort={onSort} num>Custo total</ThSort>
              {cols.pv     && <ThSort col="pv"     sortCol={sortCol} sortDir={sortDir} onSort={onSort} num>P. Venda</ThSort>}
              {cols.margem && <ThSort col="margem" sortCol={sortCol} sortDir={sortDir} onSort={onSort} num>Margem</ThSort>}
              <ThSort col="curva" center sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Curva</ThSort>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r, i) => (
              <TrHover key={i}>
                <Td><LojaBadge>{r.loja}</LojaBadge></Td>
                <Td mono style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.cod}</Td>
                <Td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.desc}>{r.desc}</Td>
                <Td num>{r.qtde}</Td>
                <Td num style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtBRL(r.custo)}</Td>
                {cols.pv && <Td num>{fmtBRL(r.pv)}</Td>}
                {cols.margem && (
                  <Td num style={{ fontWeight: 700, color: r.margem >= 0.4 ? 'var(--green)' : 'var(--amber)' }}>
                    {fmtPct(r.margem)}
                  </Td>
                )}
                <Td center><Tag cor={CURVA_COR[r.curva]}>Curva {r.curva}</Tag></Td>
              </TrHover>
            ))}
          </tbody>
          <tfoot>
            <TrTotal>
              <td colSpan={4} style={{ padding: '6px 10px' }} />
              <Td num style={{ fontWeight: 700, color: 'var(--text)', padding: '6px 10px' }}>{fmtBRL(totCusto)}</Td>
              {cols.pv     && <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{fmtBRL(totPv)}</Td>}
              {cols.margem && <td style={{ padding: '6px 10px' }} />}
              <td style={{ padding: '6px 10px' }} />
            </TrTotal>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function DesignSystem() {
  const [meta, setMeta]       = useState('68000')
  const [alterou, setAlterou] = useState(false)
  const [salvo, setSalvo]     = useState(false)
  const [skelDemo, setSkelDemo] = useState(false)
  const [cargoDemo, setCargoDemo] = useState('Consultor de Peças')
  const [lojaDemo, setLojaDemo]   = useState('PLT')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font)', paddingBottom: 80 }}>
      <style>{SKELETON_CSS}</style>

      {/* Banner */}
      <div style={{
        background: 'var(--bg2)', borderBottom: '1px solid rgba(15,23,42,0.08)',
        padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text3)' }}>Design System</span>
        <span style={{ width: 1, height: 14, background: 'rgba(15,23,42,0.12)' }} />
        <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Pernambuco Motos · Pós-Venda BI · Edição 2026</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', background: 'rgba(204,0,0,0.08)', color: 'var(--honda)', borderRadius: 'var(--radius)', padding: '2px 8px', fontWeight: 600 }}>DS.jsx</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── 1. LAYOUT DATA-FIRST ── */}
        <Secao titulo="1 · Layout data-first" sub="Filtro fino + KPIs compactos = tabela aparece sem rolar. Padrão de todas as páginas.">
          <FiltersBar>
            <Chip ativo icon={Calendar}>06/2026</Chip>
            <Divider />
            <Chip icon={Building2}>Estado</Chip>
            <Chip icon={Building2}>Loja</Chip>
            <Chip icon={Users}>Supervisor</Chip>
            <Chip icon={Layers}>Tipo</Chip>
          </FiltersBar>
          <div style={{ marginBottom: 12 }}>
            <KpiStrip kpis={[
              { label: 'Estoque',      valor: 'R$ 817k', sub: '2.450 itens'     },
              { label: 'Obsoleto D+E', valor: 'R$ 190k', cor: 'var(--honda)', sub: '23,3% do total', delta: 5 },
              { label: 'CMV 30d',      valor: 'R$ 240k', sub: 'R$ 8k/dia',      delta: -3 },
              { label: 'Cobertura',    valor: '102 d',   cor: 'var(--green)', sub: 'meta: 90d', delta: 8 },
            ]} />
          </div>
          <TabelaDemo />
        </Secao>

        {/* ── 2. ACTION BAR ── */}
        <Secao titulo="2 · ActionBar — título + ações" sub="Linha no topo de cada página: título à esquerda, botões à direita.">
          <Card pad="16px">
            <ActionBar title="Estoque" sub="Lojas PE · 06/2026">
              <button className="btn btn-ghost btn-sm" style={{ display:'flex',alignItems:'center',gap:4 }}>
                <Download size={13} /> Exportar
              </button>
              <button className="btn btn-primary btn-sm" style={{ display:'flex',alignItems:'center',gap:4 }}>
                <Plus size={13} /> Novo
              </button>
            </ActionBar>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginTop: 4 }}>Abaixo da ActionBar vem a FiltersBar, depois KpiStrip, depois tabela.</div>
          </Card>
        </Secao>

        {/* ── 3. CHIPS DE FILTRO ── */}
        <Secao titulo="3 · Chips de filtro — todos idênticos" sub="Altura 30px, radius 6px, ícone Lucide, ChevronDown. Ativo = borda Honda Red sutil.">
          <Card pad="16px">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip ativo icon={Calendar}>06/2026</Chip>
              <Divider />
              <Chip icon={Building2}>PE</Chip>
              <Chip icon={Building2}>Recife — Centro</Chip>
              <Chip ativo icon={Users}>João Supervisor</Chip>
              <Chip icon={Layers}>Peças</Chip>
            </div>
          </Card>
        </Secao>

        {/* ── 4. ÍCONES ── */}
        <Secao titulo="4 · Ícones Lucide — sem emojis" sub="strokeWidth 1.75, tamanho contextual 12–16px. Consistentes em todos os SO.">
          <Card pad="16px">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { Icon: Package,          label: 'Estoque'    },
                { Icon: TrendingUp,       label: 'Desempenho' },
                { Icon: BarChart2,        label: 'Dashboard'  },
                { Icon: Users,            label: 'Equipes'    },
                { Icon: AlertTriangle,    label: 'Atenção'    },
                { Icon: Download,         label: 'Exportar'   },
                { Icon: Settings,         label: 'Config'     },
                { Icon: Clock,            label: 'Histórico'  },
                { Icon: SlidersHorizontal,label: 'Colunas'    },
                { Icon: Plus,             label: 'Novo'       },
                { Icon: Trash2,           label: 'Excluir'    },
                { Icon: Save,             label: 'Salvar'     },
              ].map(({ Icon, label }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569',
                  }}>
                    <Icon size={16} strokeWidth={1.75} />
                  </div>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>
        </Secao>

        {/* ── 5. STATUS ── */}
        <Secao titulo="5 · Status e tags" sub="Dot: 6px ponto colorido. Tag: fundo semitransparente, sem cor sólida pesada.">
          <Card pad="16px">
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
              <Dot cor="green"  label="Ativo"      />
              <Dot cor="red"    label="Inativo"     />
              <Dot cor="amber"  label="Pendente"    />
              <Dot cor="blue"   label="Em análise"  />
              <Dot cor="gray"   label="Sem dados"   />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag cor="green">Curva A</Tag>
              <Tag cor="blue" >Curva B</Tag>
              <Tag cor="gray" >Curva C</Tag>
              <Tag cor="amber">Curva D</Tag>
              <Tag cor="red"  >Curva E</Tag>
            </div>
          </Card>
        </Secao>

        {/* ── 6. SKELETON ── */}
        <Secao titulo="6 · Skeleton loading — sem spinner" sub="Pulso cinza mostra a forma do conteúdo. Mais moderno e parece mais rápido.">
          <Card>
            <CardHead title="Estoque" action={
              <button className="btn btn-ghost btn-sm" onClick={() => setSkelDemo(v => !v)}>
                {skelDemo ? 'Ver dados' : 'Ver skeleton'}
              </button>
            }/>
            <div style={{ padding: 16 }}>
              {skelDemo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[80,70,90,80].map((w,i) => <Skeleton key={i} w={w} h={28} radius={6} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(15,23,42,0.09)', borderRadius: 8, overflow: 'hidden' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, padding: '10px 16px', borderLeft: i > 1 ? '1px solid rgba(15,23,42,0.07)' : 'none' }}>
                        <Skeleton w="60%" h={9} radius={3} style={{ marginBottom: 6 }} />
                        <Skeleton w="80%" h={18} radius={4} />
                      </div>
                    ))}
                  </div>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Skeleton w={30} h={18} radius={4} />
                      <Skeleton w={110} h={11} radius={3} />
                      <Skeleton w="28%" h={11} radius={3} />
                      <Skeleton w={50} h={11} radius={3} style={{ marginLeft: 'auto' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Package} title="Nenhum item encontrado" sub='Clique em "Ver skeleton" para ver o estado de carregamento' />
              )}
            </div>
          </Card>
        </Secao>

        {/* ── 7. TIPOGRAFIA ── */}
        <Secao titulo="7 · Tipografia — 5 tamanhos, sem variações" sub="10 · 11 · 13 · 16 · 20. Os dois títulos usam 16 — só o peso muda.">
          <Card>
            {[
              { nome: 'FieldLabel / th', meta: '10px · 700 · MAIÚSC',       el: <FieldLabel style={{marginBottom:0}}>Custo Total</FieldLabel> },
              { nome: 'Tabela / dado denso', meta: '11px · 400',            el: <span style={{fontSize:'var(--text-sm)'}}>Capa de chuva Honda Nylon — R$ 4.522,70</span> },
              { nome: 'Corpo / UI / inputs', meta: '13px · 400',            el: <span style={{fontSize:'var(--text-sm3)'}}>Carregando configurações…</span> },
              { nome: 'SectionTitle',        meta: '16px · 600 · −0.3px',   el: <SectionTitle>Visão por loja</SectionTitle> },
              { nome: 'PageTitle',           meta: '16px · 800 · −0.4px',   el: <PageTitle>Estoque</PageTitle> },
              { nome: 'KPI number',          meta: '20px · 800 · tabular',  el: <span style={{fontSize:'var(--text-2xl)',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>R$ 240.500</span> },
            ].map(row => (
              <div key={row.nome} style={{ display:'flex', alignItems:'center', gap:16, padding:'10px 16px', borderBottom:'1px solid rgba(15,23,42,0.06)' }}>
                <div style={{ width:200, flexShrink:0, fontSize:'var(--text-sm)', color:'var(--text3)' }}>{row.nome}</div>
                <div style={{ flex:1 }}>{row.el}</div>
                <div style={{ fontSize:'var(--text-xs)', fontFamily:'monospace', color:'var(--text3)', whiteSpace:'nowrap' }}>{row.meta}</div>
              </div>
            ))}
          </Card>
        </Secao>

        {/* ── 8. PALETA ── */}
        <Secao titulo="8 · Paleta — monocromática + Honda Red" sub="95% neutros, 5% Honda Red. Semáforo só para verde/âmbar/vermelho.">
          <Card pad="16px">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:8 }}>
              {[
                { n:'Honda Red',  h:'#cc0000', t:'#fff' }, { n:'Red dark', h:'#aa0000', t:'#fff' },
                { n:'Verde',      h:'#16a34a', t:'#fff' }, { n:'Âmbar',    h:'#d97706', t:'#fff' },
                { n:'Alerta',     h:'#e53e3e', t:'#fff' }, { n:'Fundo',    h:'#f7f8fa', t:'#0f172a' },
                { n:'Card',       h:'#ffffff', t:'#0f172a' }, { n:'Texto',  h:'#0f172a', t:'#fff' },
                { n:'Texto 2',    h:'#475569', t:'#fff' }, { n:'Texto 3',  h:'#94a3b8', t:'#fff' },
              ].map(s => (
                <div key={s.n} style={{ borderRadius:6, overflow:'hidden', border:'1px solid rgba(15,23,42,0.09)' }}>
                  <div style={{ background:s.h, height:40, display:'flex', alignItems:'flex-end', padding:'4px 7px' }}>
                    <span style={{ fontSize:'var(--text-2xs)', fontWeight:600, color:s.t, opacity:0.75 }}>{s.n}</span>
                  </div>
                  <div style={{ padding:'3px 7px', fontSize:'var(--text-2xs)', fontFamily:'monospace', color:'#94a3b8', background:'#fff' }}>{s.h}</div>
                </div>
              ))}
            </div>
          </Card>
        </Secao>

        {/* ── 9. BOTÕES ── */}
        <Secao titulo="9 · Botões — com ícone Lucide" sub="Primário (Honda Red), Ghost (outline), Danger. Ícone opcional à esquerda.">
          <Card pad="16px">
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <button className="btn btn-primary"    style={{ display:'flex', alignItems:'center', gap:5 }}><Plus size={14} /> Novo item</button>
              <button className="btn btn-ghost"      style={{ display:'flex', alignItems:'center', gap:5 }}><Download size={14} /> Exportar</button>
              <button className="btn btn-danger"     style={{ display:'flex', alignItems:'center', gap:5 }}><Trash2 size={14} /> Excluir</button>
              <Divider />
              <button className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:4 }}><Save size={12} /> Salvar</button>
              <button className="btn btn-ghost btn-sm"   style={{ display:'flex', alignItems:'center', gap:4 }}>Descartar</button>
            </div>
          </Card>
        </Secao>

        {/* ── 10. FORMULÁRIO ── */}
        <Secao titulo="10 · Formulário — padronizado, sem auto-fill amarelo" sub="13px, 34px, foco Honda Red, rótulo FieldLabel acima. Altere Meta para ver a SaveBar.">
          <Card pad="16px">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:12 }}>
              <div>
                <FieldLabel>Nome</FieldLabel>
                <input className="form-input" defaultValue="Juliane Bandeira" />
              </div>
              <div>
                <FieldLabel>Meta de Peças (R$)</FieldLabel>
                <input className="form-input" type="number" value={meta}
                  onChange={e => { setMeta(e.target.value); setAlterou(true); setSalvo(false) }} />
              </div>
              <div>
                <FieldLabel>Cargo</FieldLabel>
                <FormDropdown
                  value={cargoDemo} onChange={setCargoDemo}
                  options={[
                    { value: 'Consultor de Peças',   label: 'Consultor de Peças' },
                    { value: 'Consultor de Oficina', label: 'Consultor de Oficina' },
                    { value: 'Mecânico',             label: 'Mecânico' },
                  ]}
                />
              </div>
              <div>
                <FieldLabel>Loja</FieldLabel>
                <FormDropdown
                  value={lojaDemo} onChange={setLojaDemo}
                  options={[
                    { value: 'PLT', label: 'PLT — Paulista' },
                    { value: 'ARA', label: 'ARA — Arapiraca' },
                  ]}
                />
              </div>
            </div>
          </Card>
        </Secao>

        {/* ── 11. SAVE BAR ── */}
        <Secao titulo="11 · Save bar — vidro fosco, aparece só ao editar" sub="Altere o campo Meta acima para ver aparecer. Idêntica em todas as páginas editáveis.">
          <Card pad="16px">
            <div style={{ fontSize:'var(--text-sm2)', color:'var(--text3)' }}>
              A barra aparece fixada no rodapé ao detectar uma alteração não salva. <br />
              Ela usa <code style={{fontSize:'var(--text-sm)', background:'rgba(15,23,42,0.05)', padding:'1px 5px', borderRadius:3}}>backdropFilter: blur(10px)</code> — vidro fosco sobre o conteúdo.
            </div>
          </Card>
        </Secao>

        {/* ── 12. SIDEBAR (conceito) ── */}
        <Secao titulo="12 · Sidebar — ícone + texto, ativo em Honda Red" sub="Item ativo: fundo rgba(204,0,0,0.08), cor Honda Red. Ícone Lucide alinhado.">
          <Card>
            <div style={{ display:'flex' }}>
              <div style={{ width:196, borderRight:'1px solid rgba(15,23,42,0.08)', padding:'10px 8px', display:'flex', flexDirection:'column', gap:2 }}>
                {[
                  { Icon: BarChart2,  label: 'Dashboard',  ativo: false },
                  { Icon: TrendingUp, label: 'Desempenho', ativo: false },
                  { Icon: Users,      label: 'Equipes',    ativo: false },
                  { Icon: Package,    label: 'Estoque',    ativo: true  },
                  { Icon: Settings,   label: 'Config',     ativo: false },
                ].map(({ Icon, label, ativo }) => (
                  <div key={label} style={{
                    display:'flex', alignItems:'center', gap:9,
                    padding:'7px 10px', borderRadius:6, cursor:'pointer',
                    fontSize:'var(--text-sm3)', fontWeight: ativo ? 600 : 400,
                    background: ativo ? 'rgba(204,0,0,0.08)' : 'transparent',
                    color: ativo ? 'var(--honda)' : 'var(--text2)',
                    transition:'background 0.15s, color 0.15s',
                  }}>
                    <Icon size={15} strokeWidth={ativo ? 2 : 1.75} />
                    {label}
                  </div>
                ))}
              </div>
              <div style={{ flex:1, padding:'16px' }}>
                <ActionBar title="Estoque" sub="Lojas PE · 06/2026" style={{ marginBottom:10 }}>
                  <button className="btn btn-ghost btn-sm" style={{ display:'flex',alignItems:'center',gap:4 }}><Download size={12} /> Exportar</button>
                </ActionBar>
                <FiltersBar style={{ marginBottom: 10 }}>
                  <Chip ativo icon={Calendar}>06/2026</Chip>
                  <Chip icon={Building2}>Estado</Chip>
                  <Chip icon={Building2}>Loja</Chip>
                </FiltersBar>
                <div style={{ fontSize:'var(--text-sm)', color:'var(--text3)'}}>…conteúdo da página…</div>
              </div>
            </div>
          </Card>
        </Secao>

        <div style={{ marginTop:24, textAlign:'center', fontSize:'var(--text-sm)', color:'var(--text3)'}}>
          Tudo acima usa <strong>DS.jsx</strong> — fonte única. Quando uma página importa daqui, herda todos os ajustes futuros automaticamente.
        </div>
      </div>

      <SaveBar
        visivel={alterou}
        salvo={salvo}
        onSalvar={() => { setAlterou(false); setSalvo(true); setTimeout(() => setSalvo(false), 2500) }}
        onDescartar={() => { setAlterou(false); setMeta('68000') }}
      />
    </div>
  )
}
