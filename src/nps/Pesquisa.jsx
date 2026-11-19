// Totem da pesquisa NPS (público, sem login). Fica aberto no tablet da loja em /pesquisa.
import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import QRCode from 'qrcode'
import { ArrowLeft, ArrowRight, Check, Delete } from 'lucide-react'
import { functions } from '../firebase.js'
import { CORES_NOTA, MOTIVOS_CAIXA, NADA_A_MELHORAR, NOTAS_CAIXA, SETORES_NPS, cpfValido, melhoriaDoSetor, perguntaCaixa, perguntaSetor, perguntarMelhoria } from '../../functions/src/nps.js'
import './pesquisa.css'

export const npsPesquisa = httpsCallable(functions, 'npsPesquisa', { timeout: 15000 })
const LOGO = '/nps/alagoas-motos-logo.webp'

const formatarCpf = v => v.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2')

function Escala({ rotulo, baixo, alto, onEscolher }) {
  return <>
    <div className="score-options" role="group" aria-label={rotulo}>
      {CORES_NOTA.map((cor, n) => <button key={n} type="button" aria-label={`Nota ${n}`} className="score-option" style={{ backgroundColor: cor, color: n <= 3 ? '#fff' : '#24282d' }} onClick={() => onEscolher(n)}>{n}</button>)}
    </div>
    <div className="score-ends">
      <span><img src="/nps/emoji-baixa.png" alt="" width={42} height={42} />{baixo}</span>
      <span>{alto}<img src="/nps/emoji-alta.png" alt="" width={42} height={42} /></span>
    </div>
  </>
}

export default function Pesquisa() {
  const [etapa, setEtapa] = useState('inicio')
  const [nota, setNota] = useState(null)
  const [notaSetor, setNotaSetor] = useState(null)
  const [motivos, setMotivos] = useState([])
  const [setorId, setSetorId] = useState(null)
  const [notaCaixa, setNotaCaixa] = useState(null)
  const [motivosCaixa, setMotivosCaixa] = useState([])
  const [cpf, setCpf] = useState('')
  const [qr, setQr] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [segundos, setSegundos] = useState(45)
  const idRef = useRef(null)

  useEffect(() => { document.title = 'Pesquisa de satisfação · Alagoas Motos' }, [])

  function recomecar() {
    setEtapa('inicio'); setNota(null); setNotaSetor(null); setMotivos([]); setSetorId(null); setNotaCaixa(null); setMotivosCaixa([]); setCpf(''); setQr(''); setErro(''); idRef.current = null
  }
  // Sem toque por 2 minutos no meio da pesquisa, o totem volta ao início (cliente foi embora).
  useEffect(() => {
    if (etapa === 'inicio' || etapa === 'obrigado') return
    const t = window.setTimeout(recomecar, 120000)
    return () => window.clearTimeout(t)
  })
  useEffect(() => {
    if (etapa !== 'obrigado') return
    const fim = Date.now() + 45000
    const t = window.setInterval(() => { const r = Math.max(0, Math.ceil((fim - Date.now()) / 1000)); setSegundos(r); if (!r) recomecar() }, 250)
    return () => window.clearInterval(t)
  }, [etapa])

  const limparDepoisDoSetor = () => { setNota(null); setNotaSetor(null); setNotaCaixa(null); setMotivosCaixa([]); setCpf(''); setMotivos([]); idRef.current = null }

  async function enviar(cpfEscolhido) {
    if (salvando || nota === null || notaSetor === null || setorId === null) return
    if (cpfEscolhido && !cpfValido(cpfEscolhido)) { setErro('Confira o CPF informado.'); return }
    setSalvando(true); setErro('')
    idRef.current ??= crypto.randomUUID()
    const avaliacao = { id: idRef.current, nota, notaSetor, setorId, motivos, notaCaixa, motivosCaixa, cpf: cpfEscolhido }
    try {
      const { data } = await npsPesquisa({ acao: 'avaliar', avaliacao })
      if (data?.id !== avaliacao.id) throw Error()
      try { setQr(await QRCode.toDataURL(`${window.location.origin}/pesquisa/comentar?id=${encodeURIComponent(avaliacao.id)}`, { width: 320, margin: 3, errorCorrectionLevel: 'M' })) } catch { setQr('') }
      setSegundos(45); setEtapa('obrigado')
    } catch {
      setErro('Não foi possível salvar. Sua resposta foi mantida; tente novamente.')
    } finally { setSalvando(false) }
  }

  const melhoria = setorId === null ? null : melhoriaDoSetor(setorId)
  const setor = SETORES_NPS.find(s => s.id === setorId)
  const pergunta = setorId === null ? null : perguntaSetor(setorId)
  const voltar = (para, rotulo = 'Voltar') => <button className="survey-back" onClick={para}><ArrowLeft size={18} /> {rotulo}</button>

  return <main className="nps-pesquisa survey-app">
    {etapa === 'inicio' ? <section className="survey-welcome">
      <img src={LOGO} alt="Alagoas Motos Honda" className="welcome-logo" />
      <div className="welcome-rule" aria-hidden="true" />
      <h1>Queremos saber sua opinião!</h1>
      <p className="welcome-subtitle">Sua experiência ajuda a Alagoas Motos a melhorar a cada dia.</p>
      <button className="survey-primary" onClick={() => setEtapa('setor')}>Iniciar <ArrowRight size={22} className="start-arrow" /></button>
      <span className="welcome-footnote">Leva cerca de 1 minuto</span>
    </section> : <>
      <header className="survey-header"><img src={LOGO} alt="Alagoas Motos Honda" className="survey-logo" /></header>

      {etapa === 'setor' && <section className="survey-content sector-content">
        <h1>Em qual setor você foi atendido?</h1>
        <p className="survey-hint">Escolha a opção que melhor descreve seu atendimento.</p>
        <div className="sector-options">{SETORES_NPS.map(s => <button key={s.id} type="button" onClick={() => { setSetorId(s.id); limparDepoisDoSetor(); setEtapa('nota') }}>{s.nome}<ArrowRight size={19} /></button>)}</div>
        {voltar(recomecar)}
      </section>}

      {etapa === 'nota' && <section className="survey-content score-content">
        <p className="score-intro">Por favor, ajude-nos a melhorar nossos serviços respondendo à pergunta abaixo.</p>
        <div className="score-card">
          <p className="survey-step-label">Atendimento: {setor?.nome}</p>
          <h1>De 0 a 10, o quanto você recomendaria a Alagoas Motos a um parente ou amigo?</h1>
          <Escala rotulo="Nota de recomendação de 0 a 10" baixo="Nada provável" alto="Muito provável" onEscolher={n => { limparDepoisDoSetor(); setNota(n); setEtapa('nota-setor') }} />
        </div>
        {voltar(() => setEtapa('setor'))}
      </section>}

      {etapa === 'nota-setor' && pergunta && <section className="survey-content score-content">
        <p className="score-intro">Agora, conte como foi sua experiência neste setor.</p>
        <div className="score-card">
          <p className="survey-step-label">Atendimento: {setor?.nome}</p>
          <h1>{pergunta.titulo}</h1>
          <Escala rotulo="Avaliação do setor de 0 a 10" baixo="Muito ruim" alto={pergunta.positivo} onEscolher={n => { setNotaSetor(n); setMotivos([]); setEtapa(perguntarMelhoria(n) ? 'melhoria' : 'caixa') }} />
        </div>
        {voltar(() => setEtapa('nota'))}
      </section>}

      {etapa === 'melhoria' && melhoria && <section className="survey-content followup-content">
        <p className="survey-step-label">{setor?.nome} · Sua nota para o setor: {notaSetor}</p>
        <h1>{notaSetor <= 6 ? 'O que mais influenciou sua nota?' : melhoria.titulo}</h1>
        <p className="survey-hint">{notaSetor <= 6 ? 'Selecione os pontos que mais influenciaram sua nota.' : 'Escolha os pontos que precisam de atenção.'}</p>
        <div className={`reason-options${setorId === 6 ? ' cnh-options' : ''}`} role="group" aria-label="Motivos da sua nota">
          {melhoria.opcoes.map(op => <button key={op} type="button" className={op === NADA_A_MELHORAR ? 'no-improvement' : undefined} aria-pressed={motivos.includes(op)} onClick={() => setMotivos(atual => op === NADA_A_MELHORAR ? (atual.includes(op) ? [] : [op]) : atual.includes(op) ? atual.filter(x => x !== op) : [...atual.filter(x => x !== NADA_A_MELHORAR), op])}><span>{op}</span><Check size={20} /></button>)}
        </div>
        <div className="survey-actions">{voltar(() => setEtapa('nota-setor'))}<button className="survey-primary" onClick={() => setEtapa('caixa')}>Continuar <ArrowRight size={20} /></button></div>
      </section>}

      {etapa === 'caixa' && <section className="survey-content checkout-content">
        <h1>{perguntaCaixa(setorId)}</h1>
        <div className="checkout-options" role="group" aria-label="Avaliação do caixa de 1 a 5">
          {NOTAS_CAIXA.map(c => <div key={c.valor} className="checkout-choice"><button type="button" aria-label={c.rotulo} onClick={() => { setNotaCaixa(c.valor); setMotivosCaixa([]); setEtapa(c.valor <= 3 ? 'motivo-caixa' : 'cpf') }}><img src={c.imagem} alt="" width={96} height={96} /></button><span>{c.rotulo}</span></div>)}
        </div>
        <button className="checkout-skip" type="button" onClick={() => { setNotaCaixa(0); setMotivosCaixa([]); setEtapa('cpf') }}>Não passei pelo caixa <ArrowRight size={18} /></button>
        {voltar(() => setEtapa(perguntarMelhoria(notaSetor) ? 'melhoria' : 'nota-setor'))}
      </section>}

      {etapa === 'motivo-caixa' && <section className="survey-content followup-content">
        <h1>O que podemos melhorar no caixa?</h1>
        <p className="survey-hint">Selecione os motivos da sua nota. Você pode escolher mais de uma opção.</p>
        <div className="reason-options checkout-reason-options" role="group" aria-label="Motivos da avaliação do caixa">
          {MOTIVOS_CAIXA.map(m => <button key={m} type="button" aria-pressed={motivosCaixa.includes(m)} onClick={() => setMotivosCaixa(a => a.includes(m) ? a.filter(x => x !== m) : [...a, m])}><span>{m}</span><Check size={20} /></button>)}
        </div>
        <div className="survey-actions">{voltar(() => setEtapa('caixa'))}<button className="survey-primary" disabled={!motivosCaixa.length} onClick={() => setEtapa('cpf')}>Continuar <ArrowRight size={20} /></button></div>
      </section>}

      {etapa === 'cpf' && <section className="survey-content cpf-content">
        <div className="cpf-copy">
          <h1>Gostaria de informar seu CPF para identificarmos sua avaliação?</h1>
          <label htmlFor="cpf-input">CPF</label>
          <input id="cpf-input" type="text" inputMode="numeric" autoComplete="off" maxLength={14} value={formatarCpf(cpf)} onChange={e => { setCpf(e.target.value.replace(/\D/g, '').slice(0, 11)); setErro('') }} placeholder="000.000.000-00" aria-describedby="cpf-help" />
          <p id="cpf-help" className="survey-field-hint">Ao informar, você autoriza a identificação e o tratamento desta avaliação.</p>
          {erro && <p className="survey-error" role="alert">{erro}</p>}
          {voltar(() => setEtapa(notaCaixa > 0 && notaCaixa <= 3 ? 'motivo-caixa' : 'caixa'))}
        </div>
        <div className="cpf-keypad-area">
          <div className="cpf-keypad" role="group" aria-label="Teclado numérico do CPF">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => <button key={d} type="button" onClick={() => { setCpf(a => (a + d).slice(0, 11)); setErro('') }}>{d}</button>)}
            <span aria-hidden="true" /><button type="button" onClick={() => { setCpf(a => (a + '0').slice(0, 11)); setErro('') }}>0</button><button type="button" aria-label="Apagar último número" onClick={() => { setCpf(a => a.slice(0, -1)); setErro('') }}><Delete size={30} /></button>
          </div>
          <div className="cpf-actions"><button className={cpfValido(cpf) ? 'cpf-skip' : 'survey-primary'} disabled={salvando} onClick={() => void enviar('')}>Não, obrigado</button><button className="survey-primary" disabled={salvando || !cpfValido(cpf)} onClick={() => void enviar(cpf)}>{salvando ? 'Salvando…' : 'Sim, obrigado!'} <ArrowRight size={20} /></button></div>
        </div>
      </section>}

      {etapa === 'obrigado' && <section className="survey-content thanks-content">
        <div className="thanks-message">
          <div className="thanks-icon"><Check size={48} /></div>
          <h1>Obrigado pela sua opinião!</h1>
          <p>Sua resposta foi registrada.</p>
          <button className="survey-primary" onClick={recomecar}>Concluir <ArrowRight size={20} /></button>
          <small>Nova pesquisa em {segundos}s</small>
        </div>
        <div className="comment-qr-card">
          <h2>Há algo específico que você gostaria de destacar sobre sua experiência?</h2>
          <p>{qr ? 'Escaneie o QR code com o celular para deixar um comentário, elogio ou sugestão.' : 'Sua avaliação foi salva, mas o QR code está indisponível no momento.'}</p>
          {qr && <img src={qr} alt="QR code para comentar esta avaliação pelo celular" width={320} height={320} />}
        </div>
      </section>}
    </>}
  </main>
}
