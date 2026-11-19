/**
 * TEMPLATE DE PÁGINA — copie esta pasta inteira para criar uma nova página.
 *
 * Passos:
 *  1. Copiar a pasta _template → src/pages/nome-da-pagina/
 *  2. Renomear os arquivos:
 *       index.jsx          → index.jsx  (manter)
 *       useTemplate.js     → useNomePagina.js
 *       template.logic.js  → nome-pagina.logic.js
 *  3. Substituir "Template/template" pelo nome real em todos os arquivos
 *  4. Registrar a rota em App.jsx:
 *       const NomePagina = lazy(() => import('./pages/nome-da-pagina'))
 *       <Route path="/rota" element={<PrivateRoute roles={['admin']}><NomePagina /></PrivateRoute>} />
 *  5. Adicionar link no Sidebar.jsx (array NAV_ITEMS)
 *
 * Regras obrigatórias:
 *  ✅ Importar SOMENTE de DS.jsx — nunca de UI.jsx
 *  ✅ Usar PageLayout — nunca montar a estrutura na mão
 *  ✅ Toda lógica de cálculo vai em [nome].logic.js
 *  ✅ Todo estado e efeito vai em use[Nome].js
 *  ✅ Este arquivo só monta a tela — sem if/else de negócio aqui
 */

import { Package } from '../../icons/iconoir'
import {
  PageLayout,
  Card, CardHead,
  FiltroAnoMes, FiltroDropdown, Divider,
  ThSort, Th, Td, TrHover, TrTotal,
  useSort,
} from '../../components/DS.jsx'
import { useTemplate } from './useTemplate.js'
import { fmtBRL } from '../../utils/formatacao.js'

export default function Template() {
  const {
    dados,
    kpis,
    filtros,
    setFiltros,
    mesesDisponiveis,
    lojasDisponiveis,
    loading,
  } = useTemplate()

  const { sortCol, sortDir, onSort, sortFn } = useSort('nome', 'asc')
  const linhas = [...dados].sort(sortFn)

  const optsLojas = lojasDisponiveis.map(l => ({ value: l, label: l }))

  return (
    <PageLayout
      title="Nome da Página"
      sub="Descrição curta opcional"
      filters={
        <>
          <FiltroAnoMes
            meses={mesesDisponiveis}
            value={filtros.mes}
            onChange={mes => setFiltros({ mes })}
          />
          <Divider />
          <FiltroDropdown
            label="Loja"
            options={optsLojas}
            value={filtros.loja}
            onChange={loja => setFiltros({ loja })}
          />
        </>
      }
      kpis={kpis}
      loading={loading}
      isEmpty={linhas.length === 0}
      empty={{
        icon: Package,
        title: 'Nenhum dado encontrado',
        sub: 'Tente ajustar os filtros ou importe dados na página Upload.',
      }}
    >
      <Card>
        <CardHead title="Listagem" badge={linhas.length} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <ThSort col="nome"  sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Nome</ThSort>
                <ThSort col="loja"  sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Loja</ThSort>
                <ThSort col="valor" sortCol={sortCol} sortDir={sortDir} onSort={onSort} num>Valor</ThSort>
                <Th center>Status</Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(row => (
                <TrHover key={row.id}>
                  <Td>{row.nome}</Td>
                  <Td>{row.loja}</Td>
                  <Td num>{fmtBRL(row.valor)}</Td>
                  <Td center>—</Td>
                </TrHover>
              ))}
            </tbody>
            <tfoot>
              <TrTotal>
                <Td colSpan={2}><strong>Total</strong></Td>
                <Td num><strong>{fmtBRL(linhas.reduce((s, r) => s + r.valor, 0))}</strong></Td>
                <Td />
              </TrTotal>
            </tfoot>
          </table>
        </div>
      </Card>
    </PageLayout>
  )
}
