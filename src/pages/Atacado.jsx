import { useState, useMemo } from 'react'
import './analysis-pages.css'
import PageHeader from '../components/PageHeader.jsx'
import { BarraFiltros, EmptyState, LoadingInline } from '../components/AnalysisDS.jsx'
import { PackageOpen } from '../icons/iconoir'
import { useAtacado } from './atacado/useAtacado.js'
import { AbaGeral }     from './atacado/AbaGeral.jsx'
import { AbaPecas }     from './atacado/AbaPecas.jsx'
import { AbaClientes }  from './atacado/AbaClientes.jsx'
import { AbaInativos }  from './atacado/AbaInativos.jsx'
import { AbaCobertura } from './atacado/AbaCobertura.jsx'

const ABAS = [
  { key: 'geral',     label: 'Geral' },
  { key: 'pecas',     label: 'Peças' },
  { key: 'clientes',  label: 'Clientes' },
  { key: 'inativos',  label: 'Inativos' },
  { key: 'cobertura', label: 'Cobertura' },
]

export default function Atacado() {
  const a = useAtacado()
  const LOJAS=a.lojas
  const [aba, setAba] = useState('geral')

  const optsEstado = useMemo(
    () => [...new Set(Object.values(LOJAS).map(v => v.uf))].sort().map(uf => ({ value: uf, label: uf })),
    [LOJAS]
  )
  const optsLojas = useMemo(
    () => Object.entries(LOJAS)
      .filter(([, v]) => !a.filtroEstado || v.uf === a.filtroEstado)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([k, v]) => ({ value: k, label: `${k} – ${v.un}` })),
    [a.filtroEstado,LOJAS]
  )

  const semDados = !a.temDados

  // Filtros secundários: Lojas (sempre) + tipo merc / tipo mov / cidade (aba Geral)
  const filtrosSecundarios = useMemo(() => {
    const f = []
    if (optsLojas.length > 0) f.push({ label: 'Lojas', options: optsLojas, value: a.filtroLojas, onChange: a.setLojas, multi: true })
    if (aba === 'geral') {
      if (a.optsTipoMerc.length > 0) f.push({ label: 'Tipo mercadoria', options: a.optsTipoMerc, value: a.filtroTipoMerc, onChange: a.setFiltroTipoMerc, multi: true })
      if (a.optsTipoMov.length > 0)  f.push({ label: 'Tipo movimento', options: a.optsTipoMov, value: a.filtroTipoMov, onChange: a.setFiltroTipoMov })
      if (a.optsCidade.length > 0)    f.push({ label: 'Cidade', options: a.optsCidade, value: a.filtroCidade, onChange: a.setFiltroCidade })
      if (a.optsCliente.length > 0)   f.push({ label: 'Cliente', options: a.optsCliente, value: a.filtroCliente, onChange: a.setFiltroCliente })
    }
    return f
  }, [optsLojas, a.filtroLojas, a.setLojas, aba, a.optsTipoMerc, a.filtroTipoMerc, a.setFiltroTipoMerc, a.optsTipoMov, a.filtroTipoMov, a.setFiltroTipoMov, a.optsCidade, a.filtroCidade, a.setFiltroCidade, a.optsCliente, a.filtroCliente, a.setFiltroCliente])

  return (
    <div className="page analysis-page">
      <PageHeader title="Atacado" sub="Vendas, clientes e cobertura do canal" />
      {a.configError&&<p role="alert">{a.configError}</p>}
      <BarraFiltros
        meses={a.mesesDisp.length > 0 ? a.mesesDisp : undefined}
        mes={a.mesAtivo} onMes={a.setMes}
        estados={a.isAdmin && optsEstado.length > 1 ? optsEstado : undefined}
        estado={a.filtroEstado}
        onEstado={a.isAdmin && optsEstado.length > 1 ? a.setEstado : undefined}
        filtros={filtrosSecundarios}
        busca={a.busca} onBusca={a.setBusca} placeholderBusca="Buscar cliente, peça ou cidade..."
        temFiltro={a.temFiltro} onLimpar={a.limpar}
      />

      <div className="tab-nav" style={{ marginBottom: 'var(--space-lg)' }}>
        {ABAS.map(t => (
          <button key={t.key} className={`tab-btn${aba === t.key ? ' active' : ''}`} onClick={() => setAba(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {a.loading ? <LoadingInline msg="Carregando atacado…"/> : a.configError ? null : semDados ? (
        <EmptyState icon={PackageOpen} title="Nenhum dado de atacado" sub="Importe os arquivos de peças na página Upload." />
      ) : (
        <>
          {aba === 'geral'     && <AbaGeral a={a} />}
          {aba === 'pecas'     && <AbaPecas a={a} />}
          {aba === 'clientes'  && <AbaClientes a={a} />}
          {aba === 'inativos'  && <AbaInativos a={a} />}
          {aba === 'cobertura' && <AbaCobertura a={a} />}
        </>
      )}
    </div>
  )
}


