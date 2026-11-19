# Assistente do pós-venda

A prévia em localhost funciona sem conta externa: consulta o resumo, mostra ranking e gráficos e prepara ajustes de metas por linguagem natural. Exemplo: “Aumente a meta da Ana Costa em 10%”. A revisão mostra pessoa, mês, setor, métrica e valores anterior/novo. Só Confirmar altera os dados fictícios. Não é um modelo de IA local: as consultas demonstrativas têm intenções limitadas.

## Ativar IA real na aplicação conectada

1. Escolher OpenAI API ou Claude API e criar credencial no console oficial. A credencial é configurada pelo administrador no servidor, nunca no React, em variáveis VITE, no chat ou no localStorage.
2. Com Firebase CLI autenticado no projeto correto, configurar somente os segredos dos provedores desejados:
   - `firebase functions:secrets:set OPENAI_API_KEY`
   - `firebase functions:secrets:set ANTHROPIC_API_KEY`
3. Criar/editar `config/assistant` no Firestore como campos diretos (não JSON payload), por exemplo `openaiEnabled: true`, `openaiModel: <modelo disponível na conta>`, `claudeEnabled: false`. Para Claude usar `claudeModel`. Não há modelo presumido; conferir disponibilidade e orçamento no provedor.
4. Publicar as funções `assistantStatus`, `assistantChanges`, `assistantSetTarget` (legado bloqueado) e apenas as funções de provedor configuradas (`assistantOpenAI` / `assistantClaude`). Publicar o frontend após revisar o diff. Nada foi publicado automaticamente neste trabalho.
5. Bruno precisa de usuário ativo com papel `admin`, igual à permissão existente para editar metas. Nesta versão, consultas externas também ficam restritas ao administrador. Contas com estados restritos respeitam esse recorte no servidor.
6. Abrir Conexões na caixa do assistente, autorizar o envio das perguntas e do resumo mensal de colaboradores e selecionar o provedor disponível. A prévia não usa esses segredos nem funções do Firebase. A conexão opcional local do Gemini é descrita abaixo.

As consultas reais leem no servidor os arquivos de peças/oficina e configurações do mês vigente. Enviam somente nomes, setores, metas e totais agregados, sem CSV bruto, credenciais, e-mails, documentos ou tokens de acesso. Estoque ainda não entra no contexto externo; o chat local encaminha para a página de estoque. Cada pergunta externa usa os dados atuais do servidor; esta versão não envia o histórico da conversa ao provedor.

## Usar a própria conta ChatGPT/Codex ou Claude

Sign in with ChatGPT existe oficialmente, mas o uso do plano depende da elegibilidade e do registro do cliente. Esta aplicação privada ainda não tem client ID nem autorização de uso do plano. Para esse caminho, registrar o aplicativo, confirmar elegibilidade, definir domínio/callback e implementar o fluxo OIDC/PKCE e escopos de inferência no servidor. Login de identidade sozinho não concede acesso à inferência. O projeto não foi publicado como open source e não usa cookies/tokens extraídos do Codex.

Claude orienta integrações de terceiros pela API. A senha da conta Claude e as credenciais da assinatura não são solicitadas. Outra arquitetura possível é expor ferramentas autenticadas via MCP para uso dentro dos aplicativos oficiais; esse servidor MCP não faz parte desta entrega.

Fontes verificadas em 09/10/2026:
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
- https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
- https://developers.openai.com/api/docs/guides/text
- https://platform.claude.com/docs/en/api/messages/create

## Alterações de metas e segurança

O modelo pode propor alterações de meta, bonificação e comissão. A callable `assistantChanges` prepara uma revisão privada e valida identidade ativa, papel, estados permitidos, colaborador cadastrado, mês atual, setor, campo, limites e valor anterior. Só o clique de confirmação envia o ID da proposta para gravação. A alteração e `assistantAudit` acontecem na mesma transação. Propostas vencidas ou desatualizadas são rejeitadas; outras metas são preservadas. Ajustes retroativos continuam no fluxo existente da página Metas.

Limites de consultas externas: 3 por minuto e 40 por dia por usuário, compartilhados em Firestore. As coleções `assistantAudit` e `assistantLimits` não têm acesso público pelas regras atuais. Não há execução de código/HTML produzido pelo modelo. A resposta usa Markdown seguro, sem HTML bruto nem imagens remotas. Configure alertas/orçamento de consumo nos provedores antes de habilitar.

Validação local: testes de cálculos, isolamento por pessoa/UF, devoluções, comandos de metas, dados sem venda, calendário, preservação de metas e conflito de valores; interface testada com consultas e alteração/restauração de meta fictícia. Conexões de IA externa, registro OAuth e gravações reais no Firestore não foram executados sem a configuração do proprietário.


## Dock e voz — 09/10/2026

Uma única instância do assistente fica no layout autenticado. Fora do Início, o dock aparece no canto inferior direito em telas acima de 768px. No mobile, o dock não é montado e o acesso à IA fica no Início; ao sair dessa página, a conversa aberta é fechada e o ditado é cancelado. O dock é apenas um botão com o ícone; clicar nele abre a conversa. A conversa, o rascunho e o provedor selecionado continuam ao trocar de página na mesma sessão. Atualizar a aba ou sair encerra essa conversa; ela não é gravada no localStorage. As permissões e o recorte por pessoa/estado continuam iguais aos da home.

Atualização de 16/10/2026: o botão de microfone inicia o ditado no primeiro clique, no próprio campo do Início ou do chat. Resultados parciais aparecem imediatamente e são substituídos pela hipótese revisada, sem duplicar palavras. As ondas são calculadas das amostras locais do microfone pelo Web Audio; não são uma animação fictícia. Parar mantém o texto para revisão; Usar texto encerra a captura para editar; Apagar ditado restaura o rascunho anterior à sessão. Enviar encerra a captura e só então consulta o assistente. O aviso sobre transcrição fica junto ao campo, sem painel intermediário. Reconhecimento nativo (`SpeechRecognition` / `webkitSpeechRecognition`), em português brasileiro, com alternativa por texto quando indisponível ou sem permissão. O navegador pode usar um serviço externo para transcrever o áudio, mesmo com o assistente no modo local. Nenhum comando transcrito é enviado automaticamente: o usuário revisa e aperta Enviar. Fechar o chat, mudar de página, abrir Conexões ou enviar a pergunta cancela a captura pendente. Ouvir resposta usa `speechSynthesis` com preferência por voz local em português; as vozes disponíveis dependem do navegador. Não é uma sessão de áudio em tempo real com OpenAI ou Claude.

O modo local da prévia segue demonstrativo. O dock não cria conexão OAuth. Gemini pode ser conectado na prévia local pelo fluxo descrito abaixo. A validação com microfone físico continua pendente. O reconhecimento depende do navegador, da permissão e do serviço de voz dele; não foi acrescentado upload de áudio ao Gemini. Testes automatizados usam reconhecedor e amostras simulados para transcrição parcial/final, cancelamento, permissão negada, preservação do rascunho, liberação de tracks e limites. A interface foi exercitada em desktop e largura móvel real de 433px, incluindo parar, apagar, aceitar, editar e enviar. Suíte completa: 93 testes aprovados; builds normal e prévia aprovados. Chamadas reais ao Gemini são registradas na entrega de 15/10.

Referências: [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).

## Fonte e avatar

Os arquivos SF Pro Text (400/500/600/700 e itálico 400) e SF Pro Display (400/500/600/700/800/900) vêm do ZIP `1601920060wpdm_San-Francisco.zip` fornecido pelo usuário. Estão em `public/fonts`, declarados com pesos estáticos exatos em `src/theme/tokens.css`. Texto e controles usam Text; títulos usam Display. Nenhuma fonte é buscada em CDN.

Avatar: `public/illustrations/assistant.png`, gerado com a ferramenta de imagens integrada. Prompt final: “Small premium friendly robot head, rounded off-white ceramic shell, graphite faceplate, two coral illuminated eyes, three-quarter view, soft studio light, centered, simple silhouette legible at 40px, transparent background, no text or logo.”

## Seleção de modelo e esforço — 14/10/2026

O seletor da caixa de pergunta usa um popover Radix ancorado ao botão, com a estrutura da referência: trilho de provedores, busca, lista de modelos e controle segmentado de esforço. Não há janela central nem overlay para essa seleção. Mostra somente os modelos autorizados por `assistantStatus`. O modo local não oferece esforço de raciocínio, pois não executa um LLM. Nenhum modelo ou conta externa é simulado na prévia. OpenAI e Claude mostram consentimento apenas depois da escolha; os requisitos de conta ChatGPT/Codex aparecem apenas nessa opção.

Para conferir o componente isoladamente, abrir `/tests/model-picker.browser.html` com Vite em execução. A página usa opções de QA sem conexão externa para testar busca entre provedores, modelos indisponíveis, seleção por teclado e esforço. `Escape` limpa a busca primeiro e fecha o painel quando ela já está vazia. As versões de Popover e Tooltip compartilham as mesmas primitivas de foco do Dialog instalado.

Em `config/assistant`, os campos antigos `openaiModel` e `claudeModel` continuam funcionando como um modelo único, sem personalização de esforço. Para disponibilizar vários modelos, usar `openaiModels` / `claudeModels` como arrays de objetos com `id` (identificador disponível na conta), `name` (nome exibido), `thinking` (esforços realmente suportados) e `defaultThinking`. Manter o correspondente `openaiEnabled` / `claudeEnabled` como `true`. Limite de 20 modelos por provedor. Exemplo de formato, com identificador propositalmente fictício:

```json
{"openaiEnabled":true,"openaiModels":[{"id":"modelo-autorizado-na-conta","name":"Análise de vendas","thinking":["low","medium","high"],"defaultThinking":"medium"}]}
```

O backend recusa modelos fora dessa lista e esforços incompatíveis. Encaminha `reasoning.effort` para OpenAI e `output_config.effort` para Claude. Conferir os níveis suportados pelo modelo antes de habilitá-los. Esta mudança precisa publicar `assistantStatus` e as funções de consulta junto com o frontend; não houve publicação nem chamadas a provedores reais durante a validação local.

Referências consultadas: [OpenAI — Reasoning](https://developers.openai.com/api/docs/guides/reasoning), [Claude — Effort](https://platform.claude.com/docs/en/build-with-claude/effort).

## Home e projeção individual — 14/10/2026

Os cards de movimentação e atenção abrem listas do mesmo recorte e permitem abrir os perfis autorizados. Movimento inclui registros líquidos zerados por devolução; não significa receita positiva. A saudação segue `America/Sao_Paulo`: madrugada 00h–04h59, manhã 05h–11h59, tarde 12h–17h59 e noite 18h–23h59, com atualização a cada minuto.

A projeção pessoal e a atenção da Home usam o mesmo cálculo. Nos 12 meses anteriores ao selecionado, buscar os três períodos mais recentes com registros da mesma pessoa e métrica, cuja fonte cubra até o último dia útil. Uma carga parcial não vira um mês de vendas baixas. Calcular a média das receitas líquidas por dia útil desses períodos. Projetar os dias restantes combinando essa média com o ritmo atual; o peso do ritmo atual aumenta conforme os dias úteis transcorridos. Somar a previsão restante ao realizado. O gráfico ancora a previsão no último realizado e mostra quais meses compuseram o cálculo. Sem histórico, usar o ritmo atual e informar a limitação; sem base atual, não projetar. Períodos encerrados mantêm projeção igual ao realizado. Cobertura é inferida pela última data da base disponível, não uma garantia de importação integral.

Os ícones da navegação e controles usam SVGs selecionados do [Iconoir 7.12.1](https://iconoir.com/docs/introduction), incluídos em `public/icons/iconoir.svg` com licença MIT, sem CDN ou pacote novo. As marcas de provedor vêm do componente de referência fornecido pelo usuário.

## Chat e histórico da sessão — 14/10/2026

O chat tem janela ampla, modo de tela cheia e histórico próprio recolhível. Em telas de até 768px ocupa a tela inteira e o histórico abre como gaveta; Escape fecha primeiro a gaveta e devolve o foco ao menu. Ao fechar a conversa, o foco retorna ao controle de origem. O dock continua ausente no mobile.

Cada conversa pode ser criada, pesquisada, renomeada ou apagada. A lista agrupa Hoje, Últimos 7 dias e Anteriores pelo horário de Brasília. O histórico permanece somente na memória desta aba: recarregar ou sair encerra a sessão. Ações de apagar não têm recuperação nesta sessão. Nenhum histórico é gravado em localStorage nem enviado automaticamente ao provedor. A identificação de cada resposta conserva o agente que a produziu, mesmo depois de trocar o agente ativo. Respostas assíncronas permanecem na conversa de origem; editar e reenviar ou tentar novamente substitui o trecho correspondente.

Componentes em `src/assistant/chat/`:

- `ChatModal.jsx`: janela, foco, tela cheia, rolagem e gaveta móvel.
- `ChatSidebar.jsx` e `ConversationList.jsx`: busca, grupos, ações e conexões.
- `MessageBubble.jsx`: mensagens, Markdown, edição, cópia, leitura, avaliações e nova tentativa.
- `AgentLogo.jsx` e `ProviderSelect.jsx`: identificação e seleção do agente ativo.
- `Composer.jsx` e `EmptyState.jsx`: caixa de pergunta e início vazio.
- `chat.css`: estilos responsivos e temas claro/escuro.

`src/assistant/conversations.js` concentra as operações puras do histórico e a validação de URLs. `src/components/Assistant.jsx` mantém a integração com as funções e a revisão de metas existentes. O chat é carregado sob demanda. As dependências `react-markdown` e `remark-gfm` renderizam listas e tabelas sem executar HTML do modelo; imagens e protocolos inseguros são bloqueados. Os ícones de editar e avaliar vêm do sprite Iconoir local.

O frontend apresenta estados vazio, pendente, completo e erro com nova tentativa. Também aceita `status: 'streaming'` para uma futura fonte incremental; as funções atuais retornam o texto completo, portanto esta entrega não implementa streaming real nem altera o transporte dos provedores. O login ChatGPT/Codex solicitado foi cancelado pelo usuário e não foi implementado.

Validação:

1. Executar `npm test`, `npm run build` e `npm run build:preview`.
2. Na prévia, perguntar um resumo, criar outra conversa, pesquisar/renomear o histórico e editar/reenviar uma pergunta. Conferir que tentar novamente não duplica o trecho.
3. Abrir `/tests/chat.browser.html` para estados completo, pendente, streaming visual, erro e vazio, Markdown com tabela e troca Claude/Local. Essa página usa dados de QA e não faz chamadas a provedores.
4. Conferir os temas claro/escuro, recolhimento, tela cheia e retorno de foco. Em 320px, verificar ausência de rolagem lateral, gaveta do histórico, Escape e seletor de modelo ancorado ao composer.

Os testes automatizados cobrem isolamento de respostas por conversa, edição de trechos, agrupamento brasileiro, busca com acentos e Markdown/URLs seguros. A validação manual preparou e cancelou uma proposta de meta; nenhuma meta foi salva, nenhum provedor real foi chamado e nada foi publicado.

## Gemini na prévia e microanimações — 14/10/2026

Na prévia Vite em `http://127.0.0.1:5174`, abrir o seletor de modelo, escolher Gemini e Conectar Gemini. Criar a chave no [Google AI Studio](https://aistudio.google.com/api-keys), colá-la no campo de senha da aplicação e marcar o consentimento. Não enviar a chave pelo chat. A confirmação valida a chave pelo endpoint oficial de modelos, sem gerar texto; disponibilidade na lista não garante cota de geração. Selecionar modelo/esforço no popover e enviar uma pergunta para testar a geração real.

A chave sai do campo após a tentativa. A conexão ativa permanece na memória por até uma hora; as chaves salvas podem ser reconectadas depois, conforme o fluxo abaixo. O status local não devolve credenciais. A ponte recusa origens diferentes, conexões fora do loopback, modelos não autorizados, ausência de consentimento e solicitações grandes. Há proteção de dez tentativas por minuto, sem consultas simultâneas. Não há teto acumulado de 40 consultas na prévia; erros do provedor contam apenas nessa janela curta, para evitar repetição excessiva. Ao bloquear uma rajada, a resposta informa os segundos restantes no texto, em `retryAfterSeconds` e no cabeçalho `Retry-After`. Não há repetição automática de chamadas. As cotas reais do Google continuam sendo respeitadas e têm mensagem própria. O limite da aplicação Firebase conectada não foi alterado. Não é um servidor público nem funciona no build estático da prévia.

O Gemini recebe pergunta e resumo de nomes, vendas, metas e atenção da base da prévia; registros brutos, emails, credenciais e o store inteiro ficam de fora. MO de consultores e técnicos permanece separada. Usar apenas dados fictícios: conteúdo do nível gratuito pode ser usado para melhorar produtos do Google. A aplicação não habilita faturamento, não compra créditos e não faz fallback para modelos pagos. A gratuidade e as cotas dependem do projeto/chave do usuário; uma chave com faturamento ativo pode gerar cobrança. [Preços e uso de dados](https://ai.google.dev/gemini-api/docs/pricing).

Para a aplicação conectada, configurar `GEMINI_API_KEY` como segredo do Firebase e `config/assistant` com `geminiEnabled: true` e `geminiModels` ou `geminiModel`. Exemplo de modelo publicado com cota gratuita, sujeito à disponibilidade do projeto:

```json
{"geminiEnabled":true,"geminiModels":[{"id":"gemini-3.8-flash","name":"Gemini 3.8 Flash","thinking":["minimal","low","medium","high"],"defaultThinking":"low"}]}
```

Publicar `assistantStatus` e `assistantGemini` junto com o frontend quando autorizado. O servidor mantém as mesmas permissões de administrador, recorte de UF e limites de consultas. Nesta entrega, nada foi publicado e nenhuma chave real foi usada. O adaptador REST usa `generateContent`, instrução de sistema separada e `thinkingConfig.thinkingLevel`; pensamentos e chamadas de ferramenta não são apresentados como resposta nem executados. [API oficial](https://ai.google.dev/api/generate-content), [modelos](https://ai.google.dev/api/models).

Arquivos principais: `scripts/gemini-preview.mjs` (ponte local), `functions/src/gemini.js` (adaptador), `src/assistant/gemini-preview.js` (resumo e cliente), `ConnectionsDialog.jsx` (chave/consentimento), `Assistant.jsx` (integração), e identificação Gemini nos componentes de provedor.

As microanimações usam CSS existente, sem nova dependência: entrada de página de 260ms, cards do BI em sequência curta, feedback de botões, abertura/fechamento de diálogos e entrada de mensagens. `PageLoading.jsx` substitui os fallbacks vazios por skeletons enquanto chunks carregam de verdade. O layout e a sidebar persistem; não há tempo mínimo artificial de espera. `src/theme/motion.css` desativa deslocamentos, shimmer e transições para `prefers-reduced-motion: reduce`. Hover de elevação só aparece em dispositivos com ponteiro preciso; o mobile mantém as áreas de toque.

Verificação: `npm test`, `npm run build`, `npm run build:preview`. `tests/gemini.test.mjs` testa transporte com fetch simulado, exclusão de pensamentos, erros sem chave, filtro de modelos, consentimento, origem, sessão, rate limit, expiração, desconexão e resumo sem emails/registros. No navegador, conferir a validação com chave curta (rejeitada localmente sem chamar Google), troca Início/Dashboard, sidebar/fundo preservados e conexão em 320px. Uma chamada real ainda exige a chave do proprietário.

## Chaves nomeadas do Gemini — 15/10/2026

Em Conexões → Gemini, cadastrar Nome da chave e Chave do Gemini e escolher Salvar e usar. Depois, escolher pelo nome em Chave salva e clicar Usar chave. Renomear altera apenas o apelido. Excluir pede confirmação na interface e remove a credencial do cofre; se estiver ativa, encerra a conexão. Desconectar encerra apenas a sessão, preservando as chaves salvas. Cada conexão continua exigindo consentimento antes de validar a chave no Google e enviar perguntas.

Escopo original: prévia local do Gemini no Windows. A extensão para chaves pessoais no Firebase está descrita abaixo. Os cofres são separados, sem sincronização automática. Nenhuma chave real é usada nos testes automatizados.

O cofre usa DPAPI CurrentUser, criptografia vinculada ao usuário do Windows, em `%LOCALAPPDATA%/PosVenda/credentials/<projeto>/`. Arquivos de cofre contêm apenas bytes criptografados e ficam fora do repositório. Nomes e chaves são criptografados juntos; respostas HTTP só retornam identificador e nome. Não há botão de revelar, localStorage, chave em argumentos de processo, logs ou contexto enviado ao modelo. A operação DPAPI usa PowerShell do Windows sem janela, com entrada por stdin. Sem Windows, o armazenamento persistente falha de forma fechada.

Um cookie aleatório HttpOnly/SameSite=Strict identifica o navegador por até um ano. O namespace do cofre inclui host, porta e projeto, e as rotas exigem loopback e Origin idêntica. Limpar cookies, trocar navegador/perfil, host ou porta impede recuperar essas entradas pela interface; recadastrar as chaves nessa situação. Reiniciar o servidor preserva o cofre e encerra a conexão ativa: selecionar a chave e consentir novamente. Acesso à mesma conta Windows e ao navegador continua sendo acesso às credenciais; não é isolamento contra programas rodando como esse usuário. Excluir localmente não revoga a chave no Google.

Limites: 20 chaves por navegador/origem, nomes únicos de até 60 caracteres, gravação criptografada atômica e mutações serializadas. Uma operação ou consulta em andamento bloqueia troca/exclusão. Trocar chave mantém os contadores da conexão ativa. A consulta envia o identificador da seleção para recusar uma troca silenciosa feita em outra aba.

Critérios de verificação: salvar duas chaves fictícias, reiniciar a ponte e recuperar os nomes; alternar e conferir no fetch simulado qual chave é usada; renomear, rejeitar nomes duplicados, excluir e desconectar; impedir acesso com outro cookie; verificar criptografia no disco e ausência de segredo nas respostas. `tests/credential-vault.test.mjs` usa DPAPI real com credencial fictícia e diretório temporário. `tests/connections.browser.html` demonstra seleção, nova chave, renomeação e exclusão com metadados fictícios, sem rede. Conferir também layout móvel, teclado, contraste e console.

Referências: [Microsoft — DPAPI CurrentUser](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.dataprotectionscope), [Node.js — processos com stdin e windowsHide](https://nodejs.org/api/child_process.html).

## Gráficos nas respostas — 15/10/2026

Pedidos como “Faça gráficos de vendas desse mês”, “Vendas por setor”, “Ranking de vendas de peças” e “Evolução acumulada por dia” retornam gráficos interativos dentro da conversa. O chat reutiliza `src/bi/Chart.jsx` e o motor Bklit do BI: linhas, barras, área, pizza e rosca, tooltip e consulta dos valores. O seletor em cada gráfico muda apenas a visualização, sem nova chamada à IA. Valores negativos impedem pizza/rosca e preservam as devoluções em barras.

`functions/src/assistantCharts.js` monta as séries a partir dos agregados de vendas, com período, recorte, última data registrada e limites visíveis. Na prévia, a normalização é a mesma do BI; o resumo respeita as pessoas/estados autorizados antes de agregar. A mão de obra entra uma vez na receita, mesmo quando atribuída a consultor e técnico. O ranking de receita usa a atribuição do BI (responsável de peças / consultor de serviços). Nomes mencionados, códigos de loja, canais e fonte (peças ou mão de obra) podem restringir o recorte. Apenas nomes reconhecidos restringem a consulta; conferir o recorte exibido. O ranking mostra até oito pessoas e informa o total desse subconjunto.

A ponte local mantém uma lista explícita dos campos agregados permitidos; registros brutos, emails, segredos, código e configurações de gráficos enviados pelo cliente ficam fora do contexto. A descrição dos gráficos é criada pela aplicação. O Gemini recebe esses fatos e instruções para analisá-los, e a resposta recebe os gráficos calculados independentemente do texto do modelo. OpenAI e Claude usam o mesmo contrato no backend Firebase. Não há execução de código, HTML ou imagens produzidos pela IA.

Escopo ampliado em 15/10: até três meses carregados, comparativos, filtros da página e continuação do recorte na conversa. O recorte efetivo aparece no gráfico e nas fontes. Períodos ausentes são informados, sem substituir silenciosamente pelo mês atual. Datas sem registros não são preenchidas com vendas zero; registros sem data ficam fora da evolução diária. Não se desenham projeções, metas ou outras métricas indisponíveis como se fossem vendas reais.

Validação: `tests/assistant-charts.test.mjs` concilia as séries com os agrupamentos do BI, devoluções, MO, filtros, acumulado, valores negativos, períodos ausentes e acesso pessoal/UF. `tests/gemini.test.mjs` verifica a ida dos agregados/descrições ao provedor simulado e o retorno dos gráficos, sem campos extras. `/tests/assistant-charts.browser.html` permite conferir tipos, temas, valores e layout móvel com dados fictícios, sem chamar provedores. Nada foi publicado automaticamente.

## Alterações com revisão (20/10/2026)

O assistente prepara uma alteração por vez de meta, bonificação manual, taxa individual de comissão ou acréscimo manual de comissão. Mostra pessoa, loja, setor, mês e valores anterior/novo. Somente o botão Confirmar alteração grava; Cancelar encerra a proposta. A revisão expira em dez minutos e uma alteração concorrente exige nova proposta. As operações se limitam ao mês atual, a administradores ativos e aos estados autorizados. Acréscimo de comissão em reais não substitui a comissão calculada.

A callable assistantChanges usa proposta privada vinculada ao usuário, transação, auditoria e confirmação idempotente. O modelo pode propor dados permitidos, sem executar código nem confirmar. A prévia executa a mesma política em uma transação do repositório fictício. Pedidos simples são resolvidos pelo aplicativo; linguagem que exige interpretação pode usar o modelo conectado. O endpoint antigo assistantSetTarget falha pedindo atualização da página.

Publicar hosting, functions:assistantChanges e functions:assistantSetTarget junto com as regras para ativar em produção. O deploy padrão já inclui ambas. Não houve deploy durante a implementação. assistantProposals e assistantAudit não permitem acesso direto do navegador. deleteAt pode ser usado como TTL de propostas; não habilitar TTL na auditoria.

## Comissões, regras de gestor e relatórios no chat — 12/11/2026

O chat e os relatórios ficam dentro do app, só para o administrador (o mesmo `requireAssistantAdmin`). Não há conector externo (MCP/claude.ai): essa ideia foi descartada a pedido do usuário.

- **Comissões no contexto:** além de vendas e metas, a consulta envia ao modelo, por pessoa do recorte, as taxas de comissão/bonificação (`personCommission`), a regra de gestor, a bonificação manual e o acréscimo de comissão do período. Montado por `compensationContext` em `functions/src/assistantAnalysis.js`, igual no servidor (`analysisContext.js`, que agora lê também `comissao_operacional`, `comissao_gestao`, `gestaoManual` e `bonificacoes` dos meses da consulta) e na prévia. O valor final pago continua sendo o da tela Comissões; o modelo é instruído a não inventar o total.
- **Criar ou mudar regra de gestor pelo chat:** novo tipo de proposta `managementRule` em `assistantChangesPolicy.js`. O modelo devolve só os campos que mudam (percentuais em %, ex.: 1,5% = 1.5); a regra é validada por `validateGestaoPolicy` — que passou para `functions/src/gestaoPolicy.js` e é reexportada pelo app, então a tela Comissões e o chat validam igual. Mesmo fluxo das outras alterações: proposta privada de 10 minutos, cartão com a regra atual × nova, gravação em `config/regras` só no clique de Confirmar, `assistantAudit` na mesma transação, recusa se a regra mudou desde a revisão. Só o mês atual. Indicador com o mesmo nome mantém a identificação (e os valores lançados à mão). Pedido em texto para gestor sem regra vai para o modelo, em vez de virar comissão individual.
- **Relatório em PDF:** botão "Baixar relatório" em cada resposta (só administrador). O PDF tem a pergunta, a resposta sem marcação, as tabelas dos gráficos, a proposta (se houver) e fontes/recorte/avisos. Gerado no navegador com jsPDF, carregado só no clique (`src/assistant/chat/answerReport.js`).

Testes: `tests/assistant-manager-rule.test.mjs` (dados fictícios) e `tests/analysis-context.test.mjs` atualizado. Conferido na prévia local: resposta com gráfico, PDF gerado (1 página, com pergunta, tabela por canal e fontes) e cartão da regra de gestor. A criação da regra pelo chat depende de um modelo real (Claude/OpenAI/Gemini); no modo Local não há modelo para montar a regra. Nada foi publicado: publicar funções `assistantOpenAI`/`assistantClaude`/`assistantGemini`/`assistantPersonalGemini`/`assistantChanges` e o site juntos.