# Acesso, Turnstile e permissões — 09/11/2026

Resumo do que mudou nesta revisão e do que **ainda precisa ser configurado** antes de publicar. Nada foi publicado, nenhum dado real foi alterado e nenhum segredo foi gravado no repositório.

## 1. Cloudflare Turnstile

- **Chave pública (site key):** `0x4AAAAAAF1RLVfPpjAbF-8f`, em `src/components/auth/Turnstile.jsx`. Pode ser trocada por `VITE_TURNSTILE_SITE_KEY`. Na prévia local (`npm run dev:preview`), o código usa a chave de teste oficial da Cloudflare, que sempre aprova.
- **Formulários protegidos:**

  | Formulário | Ação | Onde o token é validado |
  |---|---|---|
  | Login | `login` | callable `verificarTurnstile` antes do Firebase Auth |
  | Esqueci a senha | `reset_senha` | callable `verificarTurnstile` antes do envio do link |
  | Cadastro (solicitar acesso) | `cadastro` | dentro de `solicitarAcesso` |
  | Portal do colaborador | `portal_login` | dentro de `portalEntrar` |

- **Validação no servidor:** `functions/src/turnstile.js` chama `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Ela confere `success`, `action` e `hostname` e recusa o pedido em qualquer falha (sem segredo, erro de rede, HTTP de erro, token vazio ou com mais de 2048 caracteres).

### Falta configurar (depende de você)

1. **Segredo do widget** no Secret Manager. Não use `.env`, código ou chat. Pegue-o no painel da Cloudflare (Turnstile → widget → *Secret key*) e grave:
   ```sh
   npx --yes --package=firebase-tools@15.34.0 firebase functions:secrets:set TURNSTILE_SECRET --project posvenda-bi
   ```
   O comando pede o valor no terminal. Sem esse segredo o deploy das funções pede o valor, e, se as funções rodarem sem ele, os quatro formulários ficam bloqueados. Esse é o comportamento esperado (fail-closed).
2. **Hostnames aceitos.** O padrão é `posvenda-bi.web.app,posvenda-bi.firebaseapp.com`. Se o site usar outro domínio, informe `TURNSTILE_HOSTNAMES` quando o deploy perguntar ou em `functions/.env.posvenda-bi`. O valor não é segredo, mas o `.gitignore` atual ignora `.env.*`, então esse arquivo fica só na máquina que publica. Não inclua `localhost` em produção.
3. **Domínios do widget na Cloudflare:** confirme que o widget lista os domínios de produção. Para testar localmente contra o widget real, inclua `localhost` só enquanto testa.
4. **Teste ao vivo** (não feito aqui, porque exige o segredo): uma entrada válida deve passar, e o mesmo token reenviado deve ser recusado (*replay*).

**Limitação conhecida:** login e redefinição de senha são executados pelo SDK do Firebase Auth no navegador. O Turnstile barra automação no formulário, mas o endpoint do Firebase Auth continua acessível diretamente. O App Check (abaixo) fecha esse caminho.

## 1b. App Check (11/11/2026)

O código está pronto e **desligado até você configurar**:

- **Site** (`src/firebase.js`): liga o App Check com reCAPTCHA Enterprise quando existe `VITE_APPCHECK_SITE_KEY` (chave pública do site, pode ir em `.env.production`). O app secundário (criação de usuário) também recebe o token. Em `npm run dev` use `VITE_APPCHECK_DEBUG=true` e cadastre o token de depuração que aparece no console.
- **Funções** (`functions/src/appCheck.js`): `enforceAppCheck` global, ligado por `APPCHECK_ENFORCE=true` em `functions/.env.posvenda-bi`. Por padrão é `false` para não derrubar quem está com uma versão antiga do site aberta.
- **CSP** (`firebase.json`): já libera os scripts e frames do reCAPTCHA.

Passos, nesta ordem:
1. Console Google Cloud → reCAPTCHA → criar chave de site (Web) para `posvenda-bi.web.app` e `posvenda-bi.firebaseapp.com`.
2. Console Firebase → App Check → registrar o app Web com o provedor reCAPTCHA Enterprise e essa chave.
3. Publicar o site com `VITE_APPCHECK_SITE_KEY` e acompanhar por alguns dias as métricas (requisições verificadas × não verificadas).
4. Com quase tudo verificado: em App Check, **Aplicar** para Authentication, Firestore e Storage; e `APPCHECK_ENFORCE=true` + deploy das funções.

## 2. Login, cadastro, senha e verificação de e-mail

- Telas novas: `/login`, `/registrar`, `/esqueci-senha`, `/auth/acao` (link de redefinição e de confirmação de e-mail) e `/verificar-email`.
- A recuperação de senha responde sempre da mesma forma, para não revelar se o e-mail existe.
- **Falta configurar:** em Firebase Console → Authentication → Templates, defina a *URL de ação personalizada* como `https://posvenda-bi.web.app/auth/acao`. Assim os links de redefinição e de confirmação abrem nas telas novas.
- Contas com login curto (`usuario@posvenda.app`) não recebem e-mail. A redefinição delas continua sendo pelo administrador (botão Reset em Acessos). O aviso de "confirme seu e-mail" só aparece para contas com e-mail próprio ainda não confirmado, e não bloqueia o acesso.

## 3. Permissões por cargo e setor

- Há uma política única em `functions/src/tabPolicy.js`, usada pelo menu, pela bottom bar, pelas rotas e pelo servidor (`lerDadosAutorizados`: Monitor de O.S., Atacado e Estoque).
- **Acessos** é exclusivo do administrador. **Início** (desde 12/11/2026) é de admin, coordenador e supervisor e mostra só o resultado do próprio recorte (empresa, coordenação ou equipe), com os mesmos dados já filtrados que o Meu Painel usa; não é configurável e colaborador continua sem. Coordenador e supervisor entram pelo Início; colaborador entra na primeira aba liberada. O assistente de IA saiu do Início.
- **Setor** (novo campo `usuarios/{uid}.setor`, editável em Acessos → Usuários) só **restringe** as abas do cargo. Ele nunca concede abas novas.
- Cada cargo tem um **teto**: o administrador não consegue liberar, por exemplo, Importação para colaboradores, mesmo editando a configuração diretamente.
- Sem configuração salva, cada cargo vê exatamente o que via antes. Uma mudança de comportamento: rotas que antes abriam pela URL mesmo fora do menu (por exemplo `/metas` para supervisor) agora seguem a configuração.

## 3b. Equipes e metas sem o administrador (12/11/2026)

Nova função `gestaoEquipe` (`functions/src/gestaoEquipe.js`; testes em `tests/gestao-equipe.test.mjs`). Tudo roda numa transação e fica registrado em `equipe/auditoria` (últimas 500 ações: quem, cargo, o quê).

| Ação | Admin | Coordenador | Supervisor | Colaborador |
|---|---|---|---|---|
| Gravar metas | todos | equipes dos supervisores ligados a ele | a própria equipe | não |
| Gravar a própria meta | sim | não | não | não |
| Mover pessoa de equipe | direto | direto entre os supervisores dele | libera da própria equipe direto; trazer de outra equipe vira **pedido** | não |
| Aprovar pedido | todos | dos supervisores dele | quando a pessoa está na equipe dele | não |
| Dividir o mês entre equipes (períodos) | sim | só com supervisores dele | não | não |
| Criar/remover coordenador | sim | não | não | não |
| Foto | qualquer | da equipe e a própria | da equipe e a própria | a própria |

- Pedido aprovado depois que a pessoa já mudou de equipe fica "sem efeito" (não sobrescreve).
- Pessoa sem responsável indo para supervisor **sem coordenador** ainda precisa do admin. Ligue cada supervisor a um coordenador no Organograma para isso não acontecer.
- Organograma, períodos e pedidos saíram do navegador: `equipe/org` e `equipe/solicitacoes` (lidos e gravados só pela função, que filtra o que cada perfil vê). Fotos em `equipeFotos` (leitura para usuários ativos, gravação só pela função; JPG/PNG/WebP até 300 KB). Na primeira entrada do administrador, o organograma que estava no navegador dele sobe para o servidor se o servidor ainda estiver vazio. Pedidos antigos que só existiam no navegador não sobem.
- Cadastro de pessoas (Colaboradores) continua só do administrador.

**Falta (depende de você):**
1. Publicar funções e regras: `firebase deploy --only functions,firestore:rules`.
2. Em Acessos → Permissões, liberar **Metas** para supervisores (não liberei por padrão).

## 3c. Pesquisa NPS dentro do Pós-Venda (12/11/2026)

O projeto "Pesquisa NPS — Alagoas Motos" (Next.js + Netlify) foi portado para cá. Regras em `functions/src/nps.js`, funções em `functions/src/npsCallable.js`, testes em `tests/nps.test.mjs`.

- **Totem:** `/pesquisa` (público, sem login). **Comentário pelo celular:** `/pesquisa/comentar?id=…` (QR do totem; um comentário por avaliação, até 24 h depois).
- **Painel:** aba **NPS** (Gestão). Por padrão só o administrador vê; coordenador e supervisor só se liberados em Permissões; colaborador nunca.
- Respostas em `nps/{id}`, fechada nas regras: só as funções `npsPesquisa` (pública, com limite por IP) e `npsPainel` (login + aba NPS) leem e gravam.
- **CPF:** o painel recebe só "informado / não informado". A planilha exportada traz o número só para o administrador; para os demais, a coluna diz Sim/Não.
- Alertas por e-mail (Google Apps Script) do projeto original **não** foram trazidos ainda.

**Falta (depende de você):**
1. Publicar funções e regras: `firebase deploy --only functions,firestore:rules`.
2. As respostas antigas (CSV local ou Netlify Blobs) não foram importadas. Se quiser, mande a planilha exportada do painel antigo para importarmos.
3. No tablet, abrir `https://posvenda-bi.web.app/pesquisa` e instalar como app (Adicionar à tela inicial).

## 3d. Assistente de IA removido (13/11/2026)

O assistente (chat, botão flutuante, "perguntar à IA" na busca, conexões Gemini/Claude/OpenAI) saiu do site e das funções. O código foi guardado em `arquivado/assistente-ia/` (fora do build e do deploy) caso precise voltar. A busca do topo agora só procura páginas.

**Falta (depende de você), depois de publicar a versão nova:**
1. Apagar as funções antigas que continuam no Firebase: `firebase functions:delete assistantStatus assistantOpenAI assistantClaude assistantGemini assistantSetTarget assistantConnections assistantPersonalGemini assistantChanges --project posvenda-bi`.
2. Se houver chaves de IA no Secret Manager (OpenAI, Anthropic, Gemini), revogá-las no provedor e apagar os segredos.

## 3e. Portal do colaborador removido e cadastro com senha (13/11/2026)

- **Portal (`/portal`) desativado.** O login do site é o único acesso. O código ficou em `arquivado/portal-colaborador/`. Quem entrava pelo portal não consegue mais entrar: o sistema bloqueia essas contas com o aviso "peça ao administrador um login". O endereço `/portal` agora leva para o login. A aba Portal saiu de Acessos.
- **Cadastro (`/registrar`)** agora pede setor, cargo (Coordenador, Supervisor ou Colaborador) e senha. Regras em `functions/src/cadastroPolicy.js`, testes em `tests/public-security.test.mjs`.
  - A conta é criada no Firebase Auth **bloqueada** e sem perfil. Ninguém entra antes da aprovação.
  - A senha vai direto para o Firebase Auth e nunca é gravada no Firestore.
  - O cargo escolhido é só um **pedido**: o administrador confirma ou troca em Acessos → Solicitações. Admin não pode ser pedido.
  - Rejeitar apaga a conta bloqueada. Pedidos antigos, sem senha, continuam aprovando como antes, com link para criar a senha.

**Falta (depende de você), depois de publicar:**
1. Apagar as funções antigas do portal: `firebase functions:delete portalPessoas portalEntrar portalListar portalRedefinir portalPerfil --project posvenda-bi`.
2. Criar um login normal (Acessos → Usuários) para quem só usava o portal.

## 4. Pendências de decisão (segurança)

- **Primeiro acesso do portal (risco médio, já conhecido em `CONTINUACAO-CODEX.md`):** quem souber nome e loja de alguém que ainda não definiu senha pode definir a senha dessa pessoa. **Decisão (11/11/2026): mantido como está**, a pedido do responsável.
- **Escopo de dados pelo nome (risco baixo):** o recorte de operacional e supervisor compara o nome do cadastro. Homônimos em meses ou lojas diferentes podem ver registros um do outro. A correção recomendada é gravar `pessoaId` e `lojaCodigo` no perfil e comparar por eles.
- **Desligamento no portal:** remover alguém do cadastro só impede novos acessos. Inclua no processo de desligamento "Redefinir" (aba Portal) ou "Desativar" (aba Usuários).
- **Ranking do setor em "Meu desempenho" (liberado em 11/11/2026):** `lerDadosAutorizados` com `kind: 'rankingSetor'` devolve, para quem tem a aba Desempenho, nome e % da meta dos colegas do mesmo `cargo_movimento`; R$ e meta só da própria pessoa (`functions/src/rankingSetor.js`, `rankingPublico`). O cálculo é o mesmo do app (teste `tests/ranking-setor.test.mjs` compara com `buildRanking`).
