import { ArrowUpRight } from '../../icons/iconoir'
export function Suggestions({onSelect,canEdit=false}:{onSelect:(value:string)=>void;canEdit?:boolean}) {
  const options=['Faça um resumo do dia','Quem mais vende peças?','Quem precisa de atenção?',...(canEdit?['Quero ajustar uma meta']:[])]
  return <div className="assistant-suggestions" role="group" aria-label="Sugestões de perguntas">{options.map(q=><button key={q} type="button" onClick={()=>onSelect(q)}>{q}<ArrowUpRight size={13}/></button>)}</div>
}
