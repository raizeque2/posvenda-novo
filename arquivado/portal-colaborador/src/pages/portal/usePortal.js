import { useCallback, useRef, useState } from 'react'
import { signInWithCustomToken, signOut } from 'firebase/auth'
import { auth } from '../../firebase.js'
import { entrarNoPortal, listarPessoas } from '../../services/portalService.js'
import { avaliarSenha, descreverErro, ETAPAS } from './portal.logic.js'

/**
 * Estado da entrada no portal: escolher o tipo de acesso, escolher a pessoa e
 * definir/confirmar a senha. A senha nunca é comparada aqui — quem valida é a
 * função do servidor; o navegador só envia o texto uma vez, por HTTPS.
 */
export function usePortal() {
  const [etapa, setEtapa] = useState(ETAPAS.INICIO)
  const [tipo, setTipo] = useState(null)
  const [pessoas, setPessoas] = useState([])
  const [pessoaId, setPessoaId] = useState('')
  const [pessoa, setPessoa] = useState(null)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState(null)
  const turnstile = useRef(null)

  const inicio = useCallback(() => {
    setEtapa(ETAPAS.INICIO)
    setTipo(null)
    setPessoas([])
    setPessoa(null)
    setPessoaId('')
    setSenha('')
    setConfirmacao('')
    setErro('')
  }, [])

  async function escolherTipo(novoTipo) {
    setTipo(novoTipo)
    setErro('')
    setCarregando(true)
    setEtapa(ETAPAS.PESSOA)
    try {
      setPessoas(await listarPessoas(novoTipo))
    } catch (e) {
      setErro(descreverErro(e))
    } finally {
      setCarregando(false)
    }
  }

  function escolherPessoa(id) {
    const encontrada = pessoas.find(item => item.id === id)
    if (!encontrada) return
    setPessoaId(id)
    setPessoa(encontrada)
    setSenha('')
    setConfirmacao('')
    setErro('')
    setEtapa(ETAPAS.SENHA)
  }

  function voltar() {
    if (etapa === ETAPAS.SENHA) {
      setPessoa(null)
      setPessoaId('')
      setSenha('')
      setConfirmacao('')
      setErro('')
      setEtapa(ETAPAS.PESSOA)
      return
    }
    inicio()
  }

  async function entrar(evento) {
    evento?.preventDefault()
    if (enviando || !pessoa) return
    const primeiro = pessoa.primeiroAcesso === true
    const problema = avaliarSenha(senha, confirmacao, primeiro)
    if (problema) {
      setErro(problema)
      return
    }
    if (!turnstileToken) { setErro('Conclua a verificação de segurança antes de entrar.'); return }
    setErro('')
    setEnviando(true)
    try {
      const { token } = await entrarNoPortal({ tipo, id: pessoa.id, senha, primeiro, turnstileToken })
      await signInWithCustomToken(auth, token)
      setSenha('')
      setConfirmacao('')
    } catch (e) {
      const detalhes = e?.details || {}
      if (detalhes.senhaExistente) setPessoa(atual => ({ ...atual, primeiroAcesso: false }))
      if (detalhes.primeiroAcesso) setPessoa(atual => ({ ...atual, primeiroAcesso: true }))
      setSenha('')
      setConfirmacao('')
      setErro(descreverErro(e))
      setEnviando(false)
    } finally {
      turnstile.current?.reset() // token de uso único
    }
  }

  const sair = useCallback(() => signOut(auth), [])

  return {
    etapa, tipo, pessoas, pessoa, pessoaId, senha, setSenha, confirmacao, setConfirmacao,
    erro, carregando, enviando, turnstile, setTurnstileToken,
    escolherTipo, escolherPessoa, voltar, inicio, entrar, sair,
  }
}
