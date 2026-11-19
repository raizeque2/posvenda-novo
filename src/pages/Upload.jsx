import { useUploadTasks } from '../store/uploadTasks.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import {Link} from 'react-router-dom'
﻿import { useRef, useState, useMemo, useEffect } from 'react'
import { CardHead, EmptyState } from '../components/DS.jsx'
import { ClipboardList, CheckCircle2 } from '../icons/iconoir'
import useStore from '../store.js'
import FolhaReview from './upload/FolhaReview.jsx'
import MonitorOSUpload from './upload/MonitorOSUpload.jsx'
import CartaoImport from './upload/CartaoImport.jsx'
import './upload/cartao-import.css'
import {parseFolha} from '../services/processamento/folha.js'
import {salvarFolha} from '../services/folhaService.js'
import {buildApelidoMap} from '../utils/normalizacao.js'
import { sortMesAno, mesAtualStr } from '../utils/datas.js'
import { parseCSV } from '../services/processamento/parseCSV.js'
import { processarEstoque, resumoEstoque, extrairPosicaoEm, THRESHOLDS_DEFAULT } from '../services/processamento/processarObsoleto.js'

import { processarUploadEstoque, carregarRegrasEstoque } from '../services/cloudStorage.js'
import { invalidarCacheMes } from '../services/cloudLoader.js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'

const processarCSVCloud = httpsCallable(functions, 'processarCSV', { timeout: 300000 })


export default function Upload() {
  const { role } = useAuth()
  const {
    addInconsistencias, addUploadLog: writeUploadLog,
    uploadLog, inconsistencias,
    colaboradoresPorMes, metasPorMes,
    refreshMesAtual, setUltimaImportacao, setEstoqueCache,
    ultimasAtualizacoes,
  } = useStore()

  const taskIds=useRef({}),pendingReview=useRef(null),mounted=useRef(true),folhaSaving=useRef(false)
  const [uploadandoFolha,setUploadandoFolha]=useState(false)
  const taskKey=type=>String(type).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
  const patchTask=(id,changes)=>useUploadTasks.getState().update(id,changes)
  function startTask(file,type){
    const kind=taskKey(type)
    if(useUploadTasks.getState().tasks.some(task=>task.kind===kind&&task.status==='running'))return null
    const id=useUploadTasks.getState().start(file.name,'Lendo arquivo…')
    taskIds.current[kind]=id;patchTask(id,{kind});return id
  }
  function addUploadLog(entry){
    writeUploadLog(entry)
    const kind=taskKey(entry.tipo),id=taskIds.current[kind]||useUploadTasks.getState().start(entry.arquivo,entry.tipo)
    patchTask(id,{status:entry.ok?'done':'error',label:entry.arquivo,detail:entry.ok?`${entry.tipo} · ${entry.linhas} ${entry.linhas===1?'registro importado':'registros importados'}${entry.inconsistencias?` · ${entry.inconsistencias} inconsistências`:''}`:entry.erro||'Não foi possível importar.'})
    delete taskIds.current[kind]
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(pendingReview.current){patchTask(pendingReview.current,{status:'done',detail:'Revisão interrompida. Selecione o arquivo novamente.'});pendingReview.current=null}}},[])
  const [limpos, setLimpos]           = useState({})
  const arquivos = useRef({}) // último arquivo de cada tipo, para "tentar de novo"
  const [folhaPending, setFolhaPending] = useState(null)
  const [folhaError,setFolhaError]=useState('')
  const [folhaResult,setFolhaResult]=useState(null)
  const [folhaMes, setFolhaMes]       = useState('')
  const [lojaOverrides, setLojaOverrides] = useState({})
  const [uploadandoEstoque, setUploadandoEstoque] = useState(false)
  const [retroativoEstoque, setRetroativoEstoque] = useState(false)
  const [motivoRetroativo, setMotivoRetroativo]   = useState('')
  const [uploadando, setUploadando]   = useState(null) // 'PECAS' | 'OFICINA' | null
  const [retroativoVendas, setRetroativoVendas]           = useState(false)
  const [motivoRetroativoVendas, setMotivoRetroativoVendas] = useState('')


  const mesesDisponiveis = useMemo(() => [...new Set([...Object.keys(colaboradoresPorMes),...Object.keys(metasPorMes),mesAtualStr(),...(folhaPending?.competencia?[folhaPending.competencia]:[])])].sort(sortMesAno), [colaboradoresPorMes,metasPorMes,folhaPending?.competencia])

  // ── Peças / Oficina — processamento via Cloud Function ────────────────────
  async function processFile(file, tipo) {
    if (retroativoVendas && !motivoRetroativoVendas.trim()) {
      const ts = new Date().toLocaleString('pt-BR')
      addUploadLog({ arquivo: file.name, tipo, ts, linhas: 0, inconsistencias: 0, ok: false, erro: 'Upload retroativo exige um motivo da correção.' })
      return
    }
    const taskId=startTask(file,tipo);if(!taskId)return
    let saved=false
    setUploadando(tipo)
    const ts    = new Date().toLocaleString('pt-BR')
    const label = tipo === 'PECAS' ? 'PEÇAS' : 'OFICINA'
    try {
      const csvText = await file.text()

      patchTask(taskId,{detail:'Enviando e processando CSV…'})
      // Envia CSV para a Cloud Function — todo o parsing e gravação no Storage
      // acontece no servidor. O browser nunca precisa processar 30k+ linhas.
      // Trava de mês fechado roda lá (mesmo mecanismo do Estoque — Fase 2).
      const { data } = await processarCSVCloud({
        tipo: tipo.toLowerCase(), csvText,
        retroativo: retroativoVendas, motivo: motivoRetroativoVendas.trim(),
      })
      const { mesesNovos, mesesFechadosCorrigidos, totalRegistros, inconsistencias: incs } = data

      saved=true
      patchTask(taskId,{detail:'Arquivo salvo · atualizando indicadores…'})
      addInconsistencias(incs, label)
      const detalhe = mesesFechadosCorrigidos?.length
        ? `Corrigido retroativamente: ${mesesFechadosCorrigidos.join(', ')}.`
        : undefined

      // Invalida cache local dos meses afetados
      for (const mes of mesesNovos) await invalidarCacheMes(mes)

      // Recarrega o mês atual no store. Os meses históricos são resincronizados
      // automaticamente via onSnapshot (App.jsx detecta mudança em mesesDisponiveis).
      setUltimaImportacao(Date.now())
      await refreshMesAtual()
      addUploadLog({ arquivo: file.name, tipo: label, ts, linhas: totalRegistros, inconsistencias: incs.length, ok: true, detalhe })
      setRetroativoVendas(false)
      setMotivoRetroativoVendas('')

    } catch (e) {
      addUploadLog({ arquivo: file.name, tipo: label, ts, linhas: 0, inconsistencias: 0, ok: false, erro: saved?`Arquivo importado. Falha ao atualizar indicadores: ${e.message}`:e.message })
    }
    setUploadando(null)
  }

  const onFile = (file, tipo) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      const ts = new Date().toLocaleString('pt-BR')
      addUploadLog({ arquivo: file.name, tipo, ts, linhas: 0, inconsistencias: 0, ok: false, erro: 'Formato inválido — envie um arquivo .csv' })
      return
    }
    processFile(file, tipo)
  }

  // ── Estoque ───────────────────────────────────────────────────────────────
  async function onEstoqueFile(file) {
    if (!file) return
    if (role !== "admin") { addUploadLog({ arquivo: file.name, tipo: "Estoque", ts: new Date().toLocaleString("pt-BR"), linhas: 0, inconsistencias: 0, ok: false, erro: "Esta importação exige administrador." }); return }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      const ts = new Date().toLocaleString('pt-BR')
      addUploadLog({ arquivo: file.name, tipo: 'ESTOQUE', ts, linhas: 0, inconsistencias: 0, ok: false, erro: 'Formato inválido — envie um arquivo .csv' })
      return
    }
    const taskId=startTask(file,'ESTOQUE');if(!taskId)return
    setUploadandoEstoque(true)
    const ts = new Date().toLocaleString('pt-BR')
    try {
      const text  = await file.text()
      patchTask(taskId,{detail:'Validando estoque…'})
      const { rows } = parseCSV(text)
      if (!rows.length) throw new Error('Arquivo vazio ou formato inválido')

      const regras     = await carregarRegrasEstoque()
      const thresholds = regras || THRESHOLDS_DEFAULT

      const posicaoEm = retroativoEstoque ? extrairPosicaoEm(rows) : null
      if (retroativoEstoque && !posicaoEm)
        throw new Error('Arquivo retroativo não contém coluna "Posição em" — use o relatório correto do ERP.')
      if (retroativoEstoque && !motivoRetroativo.trim())
        throw new Error('Upload retroativo exige um motivo da correção.')

      const processados = processarEstoque(rows, thresholds)
      if (!processados.length) throw new Error('Nenhum item válido encontrado.')

      const res = resumoEstoque(processados)
      patchTask(taskId,{detail:'Salvando posição de estoque…'})
      const resultado = await processarUploadEstoque(processados, res, { retroativo: retroativoEstoque, posicaoEm, motivo: motivoRetroativo.trim() })

      if (resultado.status === 'rejeitado') {
        addUploadLog({ arquivo: file.name, tipo: 'ESTOQUE', ts, linhas: processados.length, inconsistencias: 0, ok: false, erro: resultado.mensagem })
        return
      }

      setEstoqueCache(null) // força re-fetch na próxima visita
      addUploadLog({ arquivo: file.name, tipo: 'ESTOQUE', ts, linhas: processados.length, inconsistencias: 0, ok: true, detalhe: resultado.mensagem })
      setRetroativoEstoque(false) // não deixa marcado sem querer para o próximo upload
      setMotivoRetroativo('')
    } catch (e) {
      addUploadLog({ arquivo: file.name, tipo: 'ESTOQUE', ts, linhas: 0, inconsistencias: 0, ok: false, erro: e.message })
    } finally {
      setUploadandoEstoque(false)
    }
  }

  // ── Folha ─────────────────────────────────────────────────────────────────
  function onFolhaFile(file) {
    if (!file) return
    if (role !== "admin") { addUploadLog({ arquivo: file.name, tipo: "Folha", ts: new Date().toLocaleString("pt-BR"), linhas: 0, inconsistencias: 0, ok: false, erro: "Esta importação exige administrador." }); return }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      const ts = new Date().toLocaleString('pt-BR')
      addUploadLog({ arquivo: file.name, tipo: 'FOLHA', ts, linhas: 0, inconsistencias: 0, ok: false, erro: 'Formato inválido — envie um arquivo .csv' })
      return
    }
    if(folhaPending||folhaSaving.current)return
    const taskId=startTask(file,'FOLHA');if(!taskId)return
    pendingReview.current=taskId
    if(file.size>5_000_000){pendingReview.current=null;addUploadLog({arquivo:file.name,tipo:'FOLHA',ts:new Date().toLocaleString('pt-BR'),linhas:0,inconsistencias:0,ok:false,erro:'A folha deve ter até 5 MB.'});return}
    setFolhaError('')
    file.arrayBuffer().then(buffer => {
      if(!mounted.current)return
      let text
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{text=new TextDecoder('windows-1252').decode(buffer)}
      const parsed=parseFolha(text)
      setLojaOverrides({})
      setFolhaMes(parsed.competencia||mesAtualStr())
      patchTask(taskId,{detail:'Aguardando sua revisão antes de importar'})
      setFolhaPending({...parsed,nomeArquivo:file.name,taskId})
    }).catch(error=>{pendingReview.current=null;addUploadLog({arquivo:file.name,tipo:'FOLHA',ts:new Date().toLocaleString('pt-BR'),linhas:0,inconsistencias:0,ok:false,erro:error.message})})
  }

  async function confirmarFolha(signature) {
    if (!folhaPending || !folhaMes || folhaSaving.current || role!=='admin') return
    folhaSaving.current=true;setUploadandoFolha(true);pendingReview.current=null;setFolhaError('')
    taskIds.current.FOLHA=folhaPending.taskId
    patchTask(folhaPending.taskId,{status:'running',detail:'Salvando folha e metas confirmadas…'})
    try {
      const state=useStore.getState()
      const plan=await salvarFolha({rows:folhaPending.rows,mes:folhaMes,overrides:lojaOverrides,signature,fallback:{colaboradores:state.colaboradoresPorMes,metas:state.metasPorMes}})
      useStore.setState(state=>{
        const colaboradoresPorMes={...state.colaboradoresPorMes,...plan.colaboradores}
        return {colaboradoresPorMes,metasPorMes:{...state.metasPorMes,...plan.metas},apelidoMap:buildApelidoMap(colaboradoresPorMes)}
      })
      addUploadLog({arquivo:folhaPending.nomeArquivo,tipo:'FOLHA',ts:new Date().toLocaleString('pt-BR'),linhas:folhaPending.rows.length,inconsistencias:0,ok:true,detalhe:`Cadastro, salários e metas atualizados em ${folhaMes}. Campos vazios e pessoas fora do arquivo foram preservados.`})
      useStore.getState().setFiltrosGlobais({mes:folhaMes})
      setFolhaResult({mes:folhaMes,pessoas:folhaPending.rows.length})
      setFolhaPending(null);setFolhaMes('');setLojaOverrides({})
    } catch(error){setFolhaError(error.message);addUploadLog({arquivo:folhaPending.nomeArquivo,tipo:'FOLHA',ts:new Date().toLocaleString('pt-BR'),linhas:0,inconsistencias:0,ok:false,erro:error.message})}
    finally{folhaSaving.current=false;setUploadandoFolha(false)}
  }
  function cancelarFolha(){if(folhaSaving.current)return;if(folhaPending?.taskId)patchTask(folhaPending.taskId,{status:'done',detail:'Cancelado. Nenhum cadastro foi alterado.'});delete taskIds.current.FOLHA;pendingReview.current=null;setFolhaPending(null)}

  // ── Render ─────────────────────────────────────────────────────────────────
  const porTipo = inconsistencias.reduce((acc, inc) => {
    if (!acc[inc.tipo]) acc[inc.tipo] = []
    acc[inc.tipo].push(inc)
    return acc
  }, {})

  const badgeTipo = tipo =>
    tipo === 'PEÇAS'    ? 'badge-blue'   :
    tipo === 'OFICINA'  ? 'badge-purple' :
    tipo === 'FOLHA'    ? 'badge-green'  :
    tipo === 'ESTOQUE'  ? 'badge-amber'  :
    tipo === 'SNAPSHOT' ? 'badge-gray'   : 'badge-blue'

  // Situação de cada cartão: o último registro do log daquele tipo (até a pessoa limpar).
  const ultimoPorTipo = {}
  for (const l of uploadLog) ultimoPorTipo[taskKey(l.tipo)] = l
  const cartao = (tipo, enviando, padrao) => {
    const l = limpos[tipo] === ultimoPorTipo[tipo] ? null : ultimoPorTipo[tipo]
    return {
      estado: enviando ? 'enviando' : l ? (l.ok ? 'ok' : 'erro') : 'pronto',
      detalhe: enviando ? 'Enviando e processando…' : l ? (l.ok ? `${l.arquivo} · ${l.linhas.toLocaleString('pt-BR')} registros · ${l.ts}` : l.erro || 'Não foi possível importar.') : padrao,
      onLimpar: () => setLimpos(x => ({ ...x, [tipo]: l })),
    }
  }
  const tentar = (tipo, file, fn) => { arquivos.current[tipo] = file; fn(file) }
  const repetir = (tipo, fn) => { if (arquivos.current[tipo]) fn(arquivos.current[tipo]) }

  return (
    <div className="page">
      {folhaResult&&<div className="card" role="status" style={{marginBottom:16,padding:16}}><strong>Folha aplicada em {folhaResult.mes} · {folhaResult.pessoas} funcionários</strong><p className="note">Confira os valores atualizados nas páginas abaixo.</p><div style={{display:'flex',flexWrap:'wrap',gap:10}}><Link className="btn btn-ghost btn-sm" to="/colaboradores">Ver colaboradores</Link><Link className="btn btn-ghost btn-sm" to="/metas">Ver metas</Link><Link className="btn btn-ghost btn-sm" to="/comissoes">Testar comissões</Link></div></div>}
      {import.meta.env.MODE === 'preview' && <p className="note" style={{ marginBottom: 16 }}>Ambiente local: os arquivos e as alterações ficam neste navegador. Peças e oficina aceitam até 1 MB por importação manual e substituem os registros do mês importado.</p>}
      <ul className="imp-lista" aria-label="Arquivos para importar">
        <CartaoImport icone="box" cor="#3b82f6" titulo="Saída de Peças" {...cartao('PECAS', uploadando === 'PECAS', 'Vendas de peças · substitui o mês do arquivo')}
          desabilitado={!!uploadando && uploadando !== 'PECAS'} onArquivo={f => tentar('PECAS', f, x => onFile(x, 'PECAS'))} onTentar={() => repetir('PECAS', x => onFile(x, 'PECAS'))} />
        <CartaoImport icone="wrench" cor="#7c3aed" titulo="Ordem de Serviço" {...cartao('OFICINA', uploadando === 'OFICINA', 'Mão de obra e serviços · substitui o mês do arquivo')}
          desabilitado={!!uploadando && uploadando !== 'OFICINA'} onArquivo={f => tentar('OFICINA', f, x => onFile(x, 'OFICINA'))} onTentar={() => repetir('OFICINA', x => onFile(x, 'OFICINA'))} />
        <CartaoImport icone="group" cor="#16a34a" titulo="Folha do Pessoal" {...cartao('FOLHA', uploadandoFolha, folhaPending ? 'Aguardando sua revisão' : 'Cadastro, salários e metas · você revisa antes')}
          desabilitado={!!folhaPending} onArquivo={f => tentar('FOLHA', f, onFolhaFile)} onTentar={() => repetir('FOLHA', onFolhaFile)} />
        <CartaoImport icone="packages" cor="#f59e0b" titulo="Estoque Detalhado" {...cartao('ESTOQUE', uploadandoEstoque, 'Posição de estoque por loja')}
          onArquivo={f => tentar('ESTOQUE', f, onEstoqueFile)} onTentar={() => repetir('ESTOQUE', onEstoqueFile)} />
        {role === 'admin' && <MonitorOSUpload />}
      </ul>

      <div className="imp-opcoes">
        <label title="Marque só se Peças ou Oficina forem uma correção de um mês JÁ FECHADO — não use para o upload normal do dia a dia.">
          <input type="checkbox" checked={retroativoVendas} onChange={e => setRetroativoVendas(e.target.checked)} />
          Peças/Oficina retroativo (corrige mês já fechado)
        </label>
        <label title="Marque só se este arquivo for uma correção de um mês JÁ FECHADO — não use para o upload normal do dia a dia.">
          <input type="checkbox" checked={retroativoEstoque} onChange={e => setRetroativoEstoque(e.target.checked)} />
          Estoque retroativo
        </label>
        <a className="btn btn-ghost btn-sm" href="/modelos/folha-pessoal.csv" download>Baixar modelo da folha CSV</a>
      </div>
      {retroativoVendas && (
        <input className="form-input" placeholder="Motivo da correção de Peças/Oficina (obrigatório)" value={motivoRetroativoVendas}
          onChange={e => setMotivoRetroativoVendas(e.target.value)} style={{ fontSize: 'var(--text-sm2)', width: '100%', maxWidth: 420, marginBottom: 12, display: 'block' }} />
      )}
      {retroativoEstoque && (
        <input className="form-input" placeholder="Motivo da correção do Estoque (obrigatório)" value={motivoRetroativo}
          onChange={e => setMotivoRetroativo(e.target.value)} style={{ fontSize: 'var(--text-sm2)', width: '100%', maxWidth: 420, marginBottom: 12, display: 'block' }} />
      )}

      {folhaPending && (
        <FolhaReview busy={uploadandoFolha} error={folhaError}
          pending={folhaPending}
          mes={folhaMes}
          meses={mesesDisponiveis}
          onMesChange={v=>{if(!uploadandoFolha)setFolhaMes(v)}}
          onConfirmar={confirmarFolha}
          onCancelar={cancelarFolha}
          colaboradoresPorMes={colaboradoresPorMes} metasPorMes={metasPorMes}
          lojaOverrides={lojaOverrides}
          onLojaOverride={(nome, cod) => {if(!uploadandoFolha)setLojaOverrides(o => ({ ...o, [nome]: cod }))}}
        />
      )}

      {/* ── Nuvem / Robô ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{import.meta.env.MODE === 'preview' ? 'Última atualização local' : 'Última atualização na nuvem'}</span>
          <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)', marginLeft: 8 }}>{import.meta.env.MODE === 'preview' ? 'Dados deste navegador' : 'Atualiza automaticamente quando o robô ou outro dispositivo envia arquivos'}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 0 4px' }}>
          {[
            { label: 'Peças', val: ultimasAtualizacoes?.pecas,   badge: 'badge-blue'   },
            { label: 'Oficina', val: ultimasAtualizacoes?.oficina, badge: 'badge-purple' },
            { label: 'Estoque', val: ultimasAtualizacoes?.estoque, badge: 'badge-amber'  },
          ].map(({ label, val, badge }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm2)' }}>
              <span className={`badge ${badge}`}>{label}</span>
              {val
                ? <span style={{ color: 'var(--text2)' }}>{new Date(val).toLocaleString('pt-BR')}</span>
                : <span style={{ color: 'var(--text3)' }}>–</span>}
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          {import.meta.env.MODE === 'preview' ? 'Confira abaixo o resultado das importações locais. A prévia não recebe arquivos de robôs nem sincroniza com outros dispositivos.' : 'Inconsistências de uploads do robô só aparecem abaixo se o robô também gravar na nuvem. Uploads manuais via esta tela sempre registram inconsistências.'}
        </p>
      </div>

      {uploadLog.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <CardHead title="Log de Importações" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Arquivo</th><th>Tipo</th><th>Data/Hora</th><th>Registros</th><th>Avisos</th><th>Status</th><th>Detalhe</th></tr>
              </thead>
              <tbody>
                {uploadLog.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{l.arquivo}</td>
                    <td><span className={`badge ${badgeTipo(l.tipo)}`}>{l.tipo}</span></td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{l.ts}</td>
                    <td>{l.linhas.toLocaleString('pt-BR')}</td>
                    <td><span className={`badge ${l.inconsistencias > 0 ? 'badge-amber' : 'badge-green'}`}>
                      {l.tipo === 'FOLHA'
                        ? (l.inconsistencias > 0 ? `${l.inconsistencias} fora da folha` : 'OK')
                        : `${l.inconsistencias} tipo(s) novo(s)`}
                    </span></td>
                    <td><span className={`badge ${l.ok ? 'badge-green' : 'badge-red'}`}>{l.ok ? 'OK' : 'ERRO'}</span></td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', maxWidth: 260 }}>{l.detalhe || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <EmptyState icon={ClipboardList} title="Nenhum arquivo importado" sub="Nenhum arquivo importado ainda nesta sessão." />
        </div>
      )}

      <div className="section-label">Inconsistências</div>
      {inconsistencias.length === 0 ? (
        <div className="card">
          <EmptyState icon={CheckCircle2} title="Nenhuma inconsistência detectada" sub="Todos os tipos de movimento e O.S. foram reconhecidos." />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tipos não reconhecidos</span>
            <span className="badge badge-red">{inconsistencias.length} ocorrência{inconsistencias.length !== 1 ? 's' : ''}</span>
            {Object.entries(porTipo).map(([tipo, items]) => (
              <span key={tipo} className="badge badge-amber">{tipo.replace(/_/g, ' ')}: {items.length}</span>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Valor não reconhecido</th><th>Arquivo</th><th>Linha</th><th>Loja</th></tr>
              </thead>
              <tbody>
                {inconsistencias.map((inc, i) => (
                  <tr key={`${inc.tipo}-${inc.valor}-${inc.arquivo}-${i}`}>
                    <td><span className="badge badge-amber">{inc.tipo.replace(/_/g, ' ')}</span></td>
                    <td style={{ fontWeight: 'var(--weight-semibold)' }}>{inc.valor}</td>
                    <td><span className={`badge ${inc.arquivo === 'PEÇAS' ? 'badge-blue' : inc.arquivo === 'FOLHA' ? 'badge-green' : 'badge-purple'}`}>{inc.arquivo}</span></td>
                    <td style={{ color: 'var(--text3)' }}>{inc.linha}</td>
                    <td><span className="badge badge-blue">{inc.empresa}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inconsistencias.some(i => i.arquivo !== 'FOLHA') && (
            <p className="note">Para resolver tipos não reconhecidos: adicione o tipo na aba <strong>Regras</strong> ou verifique se o nome no CSV bate exatamente com a regra cadastrada.</p>
          )}
          {inconsistencias.some(i => i.arquivo === 'FOLHA') && (
            <p className="note">Colaboradores marcados como <strong>FORA DA FOLHA</strong> existem no mês mas não constam no arquivo enviado. Eles foram mantidos — verifique se saíram da empresa ou se a folha está incompleta.</p>
          )}
        </div>
      )}
    </div>
  )
}
