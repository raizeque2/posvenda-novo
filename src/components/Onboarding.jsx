import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import useAbas from '../hooks/useAbas.js'
import './onboarding.css'

// Um card por área. As imagens são capturas do próprio sistema na prévia com
// dados fictícios (public/onboarding). Só aparecem as abas liberadas.
const CARDS = [
  { path: '/', img: 'inicio', titulo: 'Início', texto: 'O pulso do dia: receita da última data, quem está vendendo e o que pede atenção.' },
  { path: '/desempenho', img: 'desempenho', titulo: 'Meu desempenho', texto: 'Quanto você já fez em peças e mão de obra, quanto falta para a meta e sua posição no ranking.' },
  { path: '/dashboard', img: 'faturamento', titulo: 'Faturamento', texto: 'Vendas por canal, metas e projeção do mês, com filtros por estado e loja.' },
  { path: '/estoque', img: 'estoque', titulo: 'Estoque', texto: 'Posição por curva, peças paradas e promoções sugeridas para girar o estoque.' },
  { path: '/atacado', img: 'atacado', titulo: 'Atacado', texto: 'Clientes, cobertura e quem está inativo na carteira de cada vendedor.' },
  { path: '/comissoes', img: 'comissoes', titulo: 'Comissões', texto: 'Comissão calculada por cargo e estado, com bônus e histórico mês a mês.' },
  { path: '/acesso', img: 'acessos', titulo: 'Acessos', texto: 'Monte o menu de cada cargo e setor arrastando as abas. Só o administrador vê esta área.' },
]

export default function Onboarding({ nome, onFechar }) {
  const { pode } = useAbas()
  const navigate = useNavigate()
  const primeiro = String(nome || '').trim().split(/\s+/)[0]?.toLocaleLowerCase('pt-BR').replace(/^./, c => c.toUpperCase())
  const slides = useMemo(() => [
    { boasVindas: true, titulo: primeiro ? `Bem-vindo, ${primeiro}!` : 'Bem-vindo!', texto: 'Um tour rápido pelas áreas liberadas para você. Leva menos de um minuto.' },
    ...CARDS.filter(c => pode(c.path)).slice(0, 5),
  ], [pode, primeiro])
  const [i, setI] = useState(0)
  const [semImagem, setSemImagem] = useState({})
  const ref = useRef(null)
  const atual = slides[Math.min(i, slides.length - 1)]
  const ultimo = i >= slides.length - 1

  useEffect(() => {
    const anterior = document.activeElement
    ref.current?.focus()
    const tecla = ev => {
      if (ev.key === 'Escape') onFechar()
      if (ev.key === 'ArrowRight') setI(n => Math.min(n + 1, slides.length - 1))
      if (ev.key === 'ArrowLeft') setI(n => Math.max(n - 1, 0))
    }
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('keydown', tecla); anterior?.focus?.() }
  }, [slides.length])

  const abrir = () => { onFechar(); if (atual.path) navigate(atual.path) }

  return createPortal(
    <div className="onb-fundo" onClick={onFechar}>
      <section ref={ref} tabIndex={-1} className="onb" role="dialog" aria-modal="true" aria-labelledby="onb-titulo" onClick={e => e.stopPropagation()}>
        <div className="onb-midia" key={i}>
          {atual.boasVindas || semImagem[atual.img]
            ? <div className="onb-arte" aria-hidden="true"><img src="/icon.png" alt="" width="64" height="64" /><div className="onb-arte-barras">{[40, 62, 48, 74, 66, 90].map((h, n) => <i key={n} style={{ height: `${h}%` }} />)}</div></div>
            : <img className="onb-captura" src={`/onboarding/${atual.img}.jpg`} alt={`Tela de ${atual.titulo} com dados de exemplo`} loading="eager" onError={() => setSemImagem(s => ({ ...s, [atual.img]: true }))} />}
        </div>
        <div className="onb-corpo">
          <span className="onb-passo">{i + 1} de {slides.length}</span>
          <h2 id="onb-titulo">{atual.titulo}</h2>
          <p>{atual.texto}</p>
        </div>
        <div className="onb-pontos" role="tablist" aria-label="Etapas">
          {slides.map((s, n) => <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Ir para ${s.titulo}`} className={n === i ? 'is-ativo' : ''} onClick={() => setI(n)} />)}
        </div>
        <footer className="onb-rodape">
          {i > 0 ? <button type="button" className="btn btn-ghost" onClick={() => setI(i - 1)}>Voltar</button> : <button type="button" className="btn btn-ghost" onClick={onFechar}>Pular</button>}
          <div>
            {atual.path && <button type="button" className="btn btn-ghost" onClick={abrir}>Abrir agora</button>}
            <button type="button" className="btn btn-primary" onClick={() => (ultimo ? onFechar() : setI(i + 1))}>{ultimo ? 'Começar' : 'Próximo'}</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
