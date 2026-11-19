import { useEffect, useMemo, useState } from 'react'
import { FiltroAnoMes, EmptyState } from '../../components/DS.jsx'
import { BarChart2, Users } from '../../icons/iconoir'
import useStore from '../../store.js'
import { carregarVisaoGeral } from '../../services/portalService.js'
import { fmtBRL2 as money } from '../../utils/formatacao.js'
import { sortMesAno, mesAtualStr } from '../../utils/datas.js'
import { nomeLoja } from './portal.logic.js'
import '../../theme/operations.css'
import './portal.css'

/**
 * Visão geral em modo leitura: andamento da empresa no mês (peças e oficina).
 * Vem de um agregado do servidor — totais por loja, sem nomes e sem linhas de
 * venda — então colaborador e supervisor veem o mesmo painel.
 */
export default function VisaoGeral() {
  const pecasPorMes = useStore(state => state.pecasPorMes)
  const oficinaPorMes = useStore(state => state.oficinaPorMes)
  const lojas = useStore(state => state.lojas)
  const meses = useMemo(() => [...new Set([...Object.keys(pecasPorMes), ...Object.keys(oficinaPorMes), mesAtualStr()])].sort(sortMesAno).reverse(), [pecasPorMes, oficinaPorMes])
  const [mes, setMes] = useState(() => mesAtualStr())
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    carregarVisaoGeral(mes)
      .then(resposta => { if (ativo) setDados(resposta) })
      .catch(() => { if (ativo) { setDados(null); setErro('Não foi possível carregar os totais do mês.') } })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [mes])

  const lojasDoMes = useMemo(() => {
    if (!dados) return []
    const todas = new Set([...Object.keys(dados.pecas?.lojas || {}), ...Object.keys(dados.oficina?.lojas || {})])
    return [...todas]
      .map(codigo => ({ codigo, nome: nomeLoja(codigo, lojas), pecas: dados.pecas?.lojas?.[codigo] || 0, maoObra: dados.oficina?.lojas?.[codigo] || 0 }))
      .sort((a, b) => (b.pecas + b.maoObra) - (a.pecas + a.maoObra))
  }, [dados, lojas])

  const total = (dados?.pecas?.total || 0) + (dados?.oficina?.maoObra || 0)

  return (
    <div className="page">
      <div className="operations-header">
        <div>
          <p>Visão geral · somente leitura</p>
          <h1>Andamento da empresa</h1>
          <span>Peças e serviços somados por loja. Nenhum registro individual é exibido.</span>
        </div>
        <FiltroAnoMes meses={meses} value={mes} onChange={setMes} />
      </div>

      {erro && <p role="alert" className="portal-erro">{erro}</p>}

      {carregando && !dados ? (
        <p className="note">Carregando os totais de {mes}…</p>
      ) : !dados || (!dados.pecas?.registros && !dados.oficina?.registros) ? (
        <EmptyState icon={BarChart2} title="Sem base neste mês" sub={`Não há registros de peças nem de oficina carregados em ${mes}.`} />
      ) : (
        <>
          <div className="operations-kpis">
            <article>
              <span>Receita de peças</span>
              <strong>{money(dados.pecas?.total || 0)}</strong>
              <small>{dados.pecas?.registros || 0} registros no mês</small>
            </article>
            <article>
              <span>Mão de obra</span>
              <strong>{money(dados.oficina?.maoObra || 0)}</strong>
              <small>{dados.oficina?.registros || 0} ordens no mês</small>
            </article>
            <article>
              <span>Peças de O.S.</span>
              <strong>{money(dados.oficina?.pecasOS || 0)}</strong>
              <small>Faturado dentro das ordens de serviço</small>
            </article>
            <article>
              <span>Movimentação total</span>
              <strong>{money(total)}</strong>
              <small><Users size={12} /> {dados.pessoas || 0} pessoas com registros</small>
            </article>
          </div>

          <section className="operations-panel">
            <header><div><h2>Por loja</h2><p>{mes} · receita líquida de peças e mão de obra</p></div></header>
            <div className="operations-table">
              <table>
                <thead>
                  <tr><th>Loja</th><th>Peças</th><th>Mão de obra</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {lojasDoMes.map(loja => (
                    <tr key={loja.codigo}>
                      <td>{loja.nome}</td>
                      <td>{money(loja.pecas)}</td>
                      <td>{money(loja.maoObra)}</td>
                      <td>{money(loja.pecas + loja.maoObra)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th>{money(dados.pecas?.total || 0)}</th>
                    <th>{money(dados.oficina?.maoObra || 0)}</th>
                    <th>{money(total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <p className="data-caption">Esta tela é de leitura. Metas, comissões e ajustes continuam com o administrador.</p>
        </>
      )}
    </div>
  )
}
