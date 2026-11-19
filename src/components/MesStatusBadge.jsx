import { useState, useEffect } from 'react'
import { Package, ShoppingBag, Wrench, TriangleAlert } from '../icons/iconoir'
import useStore from '../store.js'
import { obterStatusEstoqueMes, pegarTsStorage } from '../services/cloudStorage.js'

const DIAS_DEFASAGEM_AVISO = 2

function fimDoMes(mesAno) {
  const [m, a] = mesAno.split('/').map(Number)
  return new Date(a, m, 0, 23, 59, 59)
}

function fmtData(d) {
  if (!d) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtDataHora(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Status do mês selecionado (filtrosGlobais.mes) — Estoque (fechado/corrente +
 * defasagem, é fotografia) e Peças/Oficina (última sincronização daquele mês
 * específico). Mora no rodapé global (App.jsx) — fonte única de "quando os
 * dados são de", em vez de repetir em cada uma das 8 páginas com filtro de mês.
 * Ícones lucide-react — mesmo padrão visual do resto do app.
 */
export function MesStatusBadge() {
  const mes = useStore(s => s.filtrosGlobais.mes)
  const [estoque, setEstoque] = useState(null)
  const [tsPecas, setTsPecas] = useState(null)
  const [tsOficina, setTsOficina] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!mes) return
    let cancelado = false
    setCarregando(true)
    Promise.all([
      obterStatusEstoqueMes(mes).catch(() => null),
      pegarTsStorage('pecas', mes).catch(() => null),
      pegarTsStorage('oficina', mes).catch(() => null),
    ]).then(([est, tp, to]) => {
      if (cancelado) return
      setEstoque(est)
      setTsPecas(tp)
      setTsOficina(to)
      setCarregando(false)
    })
    return () => { cancelado = true }
  }, [mes])

  if (carregando || !mes) return null

  const dataUltimoDado = estoque?.dataUltimoDado ? new Date(estoque.dataUltimoDado) : null
  const dataRef = estoque?.congelado ? fimDoMes(mes) : new Date()
  const diasDefasagem = dataUltimoDado
    ? Math.floor((dataRef - dataUltimoDado) / 86400000)
    : null
  const defasado = diasDefasagem !== null && diasDefasagem > DIAS_DEFASAGEM_AVISO

  const estoqueTexto = estoque?.semDado
    ? 'sem dado'
    : estoque?.congelado
      ? `fechado · ${fmtData(dataUltimoDado)}`
      : dataUltimoDado
        ? `em aberto · ${fmtData(dataUltimoDado)}`
        : 'sem upload ainda'

  const partes = []
  if (estoque)   partes.push({ Icone: Package,     texto: estoqueTexto, aviso: defasado })
  if (tsPecas)   partes.push({ Icone: ShoppingBag,  texto: fmtDataHora(tsPecas) })
  if (tsOficina) partes.push({ Icone: Wrench,       texto: fmtDataHora(tsOficina) })

  if (partes.length === 0) return null

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}
      title={defasado
        ? `Estoque fechado com dados de ${fmtData(dataUltimoDado)} — ${diasDefasagem} dia(s) antes do esperado.`
        : undefined}
    >
      {partes.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: p.aviso ? 'var(--honda)' : 'inherit' }}>
          <p.Icone size={11} strokeWidth={2} style={{ opacity: 0.75, flexShrink: 0 }} />
          {p.texto}
          {p.aviso && <TriangleAlert size={11} strokeWidth={2.5} />}
        </span>
      ))}
    </span>
  )
}
