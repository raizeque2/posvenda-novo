import { FiltroDropdown, FiltroAnoMes } from '../components/DS.jsx'
import { useRegras } from './regras/useRegras.js'
import { TabelaPecas, TabelaOficina, TabelaLojas, TabelaComissaoOp, TabelaComissaoGestao } from './regras/RegrasTables.jsx'
import { TabelaIHS } from './regras/TabelaIHS.jsx'
import { TabelaAtacadoConfig } from './regras/TabelaAtacadoConfig.jsx'

const CATEGORIES = {
  vendas: { label: 'Vendas e lojas', tabs: [['pecas','Peças'], ['lojas','Lojas'],['atacado','Atacado']] },
  oficina: { label: 'Oficina', tabs: [['oficina','Serviços e oficina']] },
  comissoes: { label: 'Comissões', tabs: [['comissao','Equipe operacional'], ['gestao','Gestão']] },
  indicadores: { label: 'Indicadores', tabs: [['ihs','Resumo mensal']] },
}

export default function Regras() {
  const r = useRegras()
  const category = Object.entries(CATEGORIES).find(([, value]) => value.tabs.some(([key]) => key === r.aba))?.[0] || 'vendas'

  return (
    <>
    <div className="page">
      <div className="filters-bar">
        <FiltroAnoMes meses={r.mesesDisp} value={r.filtroMes} onChange={r.setFiltroMes} />
        <span className="dash-bar-sep" />
        <FiltroDropdown label="Estado" options={r.estadoOpts} value={r.filtroEstado} onChange={r.setFiltroEstado} />
        <FiltroDropdown label="Loja"   options={r.lojaOpts}   value={r.filtroLoja}   onChange={r.setFiltroLoja} />
        {r.temFiltro && <button className="filter-clear" onClick={r.clearFiltros}>✕</button>}
        {r.canEdit && r.mesesDisp.length > 1 && (
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={r.removerMes}>
            Remover mês
          </button>
        )}
      </div>

      <nav className="tab-nav" aria-label="Categorias de regras">
        {Object.entries(CATEGORIES).map(([key, value]) => <button key={key} className={`tab-btn${category === key ? ' active' : ''}`} onClick={() => r.setAba(value.tabs[0][0])}>{value.label}</button>)}
      </nav>
      <div className="tab-nav" aria-label={`Regras: ${CATEGORIES[category].label}`}>
        {CATEGORIES[category].tabs.map(([k, label]) => (
          <button key={k} className={`tab-btn${r.aba === k ? ' active' : ''}`} onClick={() => r.setAba(k)}>{label}</button>
        ))}
      </div>

      {r.aba === 'pecas'    && <TabelaPecas    mes={r.mesAtivo} uf={r.filtroEstado || 'PE'} filtroLoja={r.filtroLoja} mesData={r.mesData} updateRegraPeca={r.updateRegraPeca}       addRegraPeca={r.addRegraPeca}       removeRegraPeca={r.removeRegraPeca}       renameRegraPeca={r.renameRegraPeca}       canEdit={r.canEdit} />}
      {r.aba === 'oficina'  && <TabelaOficina  mes={r.mesAtivo} uf={r.filtroEstado || 'PE'} filtroLoja={r.filtroLoja} mesData={r.mesData} updateRegraOficina={r.updateRegraOficina} addRegraOficina={r.addRegraOficina} removeRegraOficina={r.removeRegraOficina} renameRegraOficina={r.renameRegraOficina} canEdit={r.canEdit} />}
      {r.aba === 'lojas'    && <TabelaLojas          mes={r.mesAtivo} filtroEstado={r.filtroEstado} filtroLoja={r.filtroLoja} mesData={r.mesData} updateLoja={r.updateLoja}                   addLoja={r.addLoja}                           canEdit={r.canEdit} />}
      {r.aba === 'comissao' && <TabelaComissaoOp     mes={r.mesAtivo} filtroEstado={r.filtroEstado} mesData={r.mesData} updateComissaoOp={r.updateComissaoOp} addComissaoOp={r.addComissaoOp} removeComissaoOp={r.removeComissaoOp}         canEdit={r.canEdit} />}
      {r.aba === 'gestao'   && <TabelaComissaoGestao mes={r.mesAtivo} mesData={r.mesData} updateComissaoGestao={r.updateComissaoGestao} addComissaoGestao={r.addComissaoGestao}               removeComissaoGestao={r.removeComissaoGestao} canEdit={r.canEdit} />}
      {r.aba === 'ihs'      && <TabelaIHS canEdit={r.canEdit} />}
      {r.aba === 'atacado' && <TabelaAtacadoConfig canEdit={r.canEdit} />}
    </div>
    {r.confirmModal}
    </>
  )
}
