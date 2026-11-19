import {useMemo} from 'react'
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '../../components/ui/dialog'
import {RainbowButton} from '../../components/ui/rainbow-button'
import {prepareFolha} from '../../services/processamento/folha.js'
import {LOJAS} from '../../data/regras.js'
import {fmtBRL2} from '../../utils/formatacao.js'
import './folha-review.css'

export default function FolhaReview({busy,error,pending,mes,meses,onMesChange,onConfirmar,onCancelar,colaboradoresPorMes,metasPorMes,lojaOverrides,onLojaOverride}){
  const result=useMemo(()=>{try{return {plan:prepareFolha(pending.rows,mes,colaboradoresPorMes,metasPorMes,lojaOverrides,true)}}catch(e){return {error:e.message}}},[pending.rows,mes,colaboradoresPorMes,metasPorMes,lojaOverrides])
  const plan=result.plan
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onCancelar()}}><DialogContent className="folha-review" onEscapeKeyDown={event=>{if(busy)event.preventDefault()}} onPointerDownOutside={event=>{if(busy)event.preventDefault()}}>
    <DialogTitle>Revisar folha do pessoal</DialogTitle><DialogDescription>{pending.nomeArquivo}. Atualiza somente os funcionários e campos preenchidos no CSV. Quem não estiver no arquivo será mantido.</DialogDescription>
    <label className="folha-month">Aplicar no mês<select className="form-input" value={mes} disabled={busy} onChange={e=>onMesChange(e.target.value)}>{meses.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
    <p className="note">Salários e metas vazios são preservados. Para zerar uma meta, informe 0. As vendas e as regras de comissão e bônus permanecem como estão.</p>
    {pending.competencia&&pending.competencia!==mes&&<p className="note">Atenção: o arquivo indica {pending.competencia}, mas você selecionou {mes}.</p>}
    {!!pending.ignored?.length&&<p className="note">Colunas não utilizadas: {pending.ignored.join(', ')}.</p>}
    {(error||result.error)&&<p role="alert" className="folha-review-error">{error||result.error}</p>}
    {plan&&<><div className="folha-review-counts"><span>{plan.changes.length} funcionários</span><span>{plan.changes.filter(c=>c.novo).length} novos neste mês</span>{plan.missing.length>0&&<span>{plan.missing.length} sem loja</span>}</div><div className="folha-review-table"><table><thead><tr><th>Funcionário</th><th>Loja</th><th>Alterações confirmadas</th></tr></thead><tbody>{plan.changes.map((change,index)=><tr key={change.nome}><td><strong>{change.nome}</strong><small>{change.cargo}</small></td><td><select className="form-input" aria-label={`Loja de ${change.nome}`} disabled={busy} value={change.loja} onChange={e=>onLojaOverride(pending.rows[index].nome,e.target.value)}><option value="">Selecionar loja</option>{Object.entries(LOJAS).sort(([a],[b])=>a.localeCompare(b)).map(([key,loja])=><option key={key} value={key}>{key} · {loja.un}</option>)}</select></td><td>{change.alteracoes.length?change.alteracoes.map((field,i)=><div className="folha-review-change" key={i}><span>{field.label}</span><span>{field.money&&typeof field.before==='number'?fmtBRL2(field.before):String(field.before)} → <strong>{field.money?fmtBRL2(field.after):String(field.after)}</strong></span></div>):<span>Sem alteração de valores</span>}</td></tr>)}</tbody></table></div></>}
    <footer><button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancelar}>Cancelar</button><RainbowButton disabled={busy||!plan||plan.missing.length>0||!mes} onClick={()=>onConfirmar(plan.signature)}>{busy?'Importando…':'Confirmar importação'}</RainbowButton></footer>
  </DialogContent></Dialog>
}
