# Revisão dos links e assistente — 15/10/2026

## Endereço oficial

O projeto local aponta para `posvenda-bi`, com Firebase Hosting em `https://posvenda-bi.web.app/`. A página publicada foi inspecionada sem alterar dados. O link de peças fornecido pelo proprietário é um link **de setor** (`/r/:estado/:tipo/:token`): apresenta resultados e pessoas da equipe inteira daquela UF/setor, sem exigir login. Não é uma visão exclusiva de um funcionário. O token real não é registrado neste documento.

O portal individual (`/pessoal/:token`) é um fluxo separado: token aleatório de 256 bits, hash no servidor, revogação e dados limitados ao titular. A auditoria desse fluxo foi por código e testes; não foi gerado nem revogado um link real.

## Alterações prontas no código

- Link de setor: busca de colaborador, aviso explícito de visão da equipe, dados até/publicação e percentual **realizado ÷ meta**, mantendo projeção separada. Layout móvel usa rolagem dentro da tabela, sem alargar a página.
- O servidor `portalSnapshot` passa a validar setor, UF, mês, token e revogação antes de devolver o snapshot. A regra impede leitura direta pública de snapshots e restringe o segredo de geração ao administrador ativo. Novos links usam SHA-256 completo; os antigos curtos continuam compatíveis até a rotação mensal/administrativa. Recomenda-se redistribuir os links longos após a publicação. Nada foi rotacionado nesta revisão.
- Assistente: até três meses carregados, comparativos, filtros conhecidos e da página, histórico limitado a oito mensagens/10 mil caracteres. Editar ou tentar novamente exclui o ramo posterior. O servidor reaplica os estados autorizados; o histórico nunca é fonte numérica.
- Respostas: gráficos do BI com valores consultáveis, painel de fontes/períodos/filtros/última data/carga quando disponível e navegação à base atual. Metas não são rateadas por loja/fonte sem alocação oficial. O link de consulta abre o último mês do comparativo na base atual; não promete reconstruir um snapshot histórico.
- Recuperação: indisponibilidade, cota Google, sessão expirada, credencial recusada e espera local distinguíveis; contagem regressiva quando há Retry-After. Sem repetição automática ou troca silenciosa de modelo.
- Gemini pessoal no Firebase: nomes e chaves criptografados juntos com AES-256-GCM, vinculados ao UID e ID; chave mestra em Secret Manager. Só administradores ativos gerenciam/consultam suas próprias entradas, até 20. Seleção persistida, bloqueio transacional entre dispositivos e conferência do ID na consulta. O navegador não recebe a chave salva. O cofre DPAPI do Windows continua separado; nenhuma chave local foi enviada ao Firebase.

## Verificação

Testes automatizados cobrem períodos, histórico, edição, estados, dados agregados, devoluções, MO sem duplicação, dimensão dos gráficos, limites, criptografia, isolamento das conexões, revogação e expiração dos links. O carregador Firebase foi exercitado com banco/storage injetados e caminhos alternativos; não houve leitura de dados de produção por credenciais administrativas.

Resultado final: suíte completa com 90 testes aprovados, mais a regressão acrescentada para não atribuir a carga atual aos meses históricos (seis testes analíticos aprovados na execução direcionada). Builds normal e prévia aprovados após as últimas alterações; permanece o aviso preexistente do chunk Firebase acima de 500 kB. `git diff --check` sem erros. Emuladores e configuração real do Firebase permanecem pendentes conforme a seção de ativação.

No navegador, com dados fictícios: comparação setembro/outubro, continuação “agora só Arapiraca”, fontes e valores. Total filtrado R$ 45.293 = R$ 11.933 + R$ 33.360. Visão de setor em largura móvel real de 433px, busca e 40% realizado apesar da projeção de 120%. Sem erros de console observados no chat.

Após o proprietário conectar sua chave pela interface, foi feita uma consulta **real** ao Google com contexto fictício. Gemini 3.1 Flash Lite retornou indisponibilidade; Gemini 2.5 Flash-Lite recusou a consulta; Gemini 3.5 Flash Lite respondeu e conciliou os mesmos R$ 11.933 e R$ 33.360 com o gráfico. As tentativas foram manuais, sem fallback automático. Não se registrou API key, e não foram enviados os resultados reais do link publicado ao Gemini.

Provas fora do repositório: `../visao-setor-mobile.png`, `../gemini-resposta-real.png` e `../gemini-grafico-real.png`. A prévia é local; o domínio oficial permanece na versão anterior.

## Ativação no Firebase — pendente

Não foi feito deploy. Firebase CLI não está disponível neste ambiente e não há sessão administrativa de deploy verificada. Não foi alterado faturamento. Cloud Functions exige projeto no plano Blaze; Secret Manager é serviço cobrado com franquia gratuita. Conferir plano, permissões, limites e custos no projeto antes de ativar.

1. Com acesso do responsável, instalar/usar Firebase CLI oficial e selecionar explicitamente `posvenda-bi`. Testar Functions e regras em emuladores com credenciais fictícias antes de produção; essa validação de emulador não foi executada aqui.
2. Criar `ASSISTANT_VAULT_KEY` no Secret Manager por `firebase functions:secrets:set ASSISTANT_VAULT_KEY --project posvenda-bi`: valor aleatório criptográfico de 32 bytes em base64. Não é uma API key e não deve ir ao Git, logs ou chat. Preservar esse segredo; trocar sem migração impede abrir as entradas antigas. Outros provedores compartilhados continuam com seus segredos existentes.
3. Publicar primeiro as Functions necessárias, incluindo `portalSnapshot`, `assistantConnections`, `assistantPersonalGemini` e os handlers de assistente atualizados. Verificar sucesso antes de avançar.
4. Gerar **build normal** com `npm run build` e publicar Hosting (`dist`), depois regras Firestore. Fazer na mesma janela de manutenção. Não publicar `dist-preview`. O script atual `deploy:full` publica apenas Hosting, portanto não basta para esta mudança.
5. Confirmar em produção: administrador ativo conecta chave nomeada; outro usuário não acessa; link de setor válido abre; token errado/revogado não abre; consulta direta pública a snapshots é negada. Verificar que a tela nova está servida antes de fechar as regras, para evitar quebra da versão antiga.

Não publicar somente as regras: o visualizador antigo lê o Firestore diretamente e perderá acesso. Não fazer rollback para leitura pública como solução. Caso a publicação falhe, preservar o último conjunto funcional e concluir a troca coordenada; a migração só é considerada concluída depois das verificações acima.

Referências: [Firebase Functions e plano Blaze](https://firebase.google.com/docs/functions/get-started), [Secret Manager no Firebase](https://firebase.google.com/docs/functions/config-env), [Gemini generateContent e histórico](https://ai.google.dev/api/generate-content).
