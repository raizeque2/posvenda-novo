# Publicação da release de 19/10/2026

O ZIP contém o código completo, sem dados reais, credenciais, dependências instaladas ou builds. Não é um backup do banco. Nenhum deploy ou manutenção na produção foi executado nesta revisão.

## Substituição no GitHub

Extraia o ZIP em uma pasta vazia. Substitua os arquivos do projeto por esse conteúdo, mantendo o histórico `.git` do seu repositório. Remova do repositório arquivos antigos que não estão no pacote; simplesmente fazer upload por cima não remove arquivos antigos. Revise o diff antes do commit. Não envie `node_modules`, `dist`, backups, chaves ou arquivos `.env`.

O gerenciador adotado é npm, com `package-lock.json` na raiz e em `functions`. Os locks antigos do pnpm e scripts locais de diagnóstico/migração não fazem parte desta release.

## Preparação local

- Node 24.19.0 (mínimo 24.15), npm 12.2+, Java 21+.
- Cloud Functions usa runtime Node 22; o Firebase faz a instalação desse runtime.
- Acesso ao projeto Firebase `posvenda-bi`, com Functions/Storage habilitados e faturamento necessário para esses serviços. A auditoria não altera plano nem ativa cobrança.

```sh
npm ci
npm ci --prefix functions --ignore-scripts
npm test
npm run test:rules
npm run build
```

Os emuladores usam o projeto fictício `demo-posvenda-security`. Não substitua esse ID pelo de produção nos testes. Os scripts de instalação de dependências ficam desativados por `.npmrc`.

Para testar apenas com dados fictícios: `npm run dev:preview -- --host 127.0.0.1 --port 5174`. Login e senha: `teste`. Não publique `dist-preview` e não use a prévia como autenticação de produção.

## Antes da primeira publicação desta release

1. Faça backup privado de Firestore e Storage. Confirme `config/colaboradores`, `config/metas`, `config/regras`, cadastro de lojas/UF e comissões de gestão no Firestore. Nomes e metas reais deixaram de ser fallback dentro do JavaScript público. Se a configuração de gestão existia somente no código antigo, transfira-a pelo painel autenticado antes de substituir a versão. Não publique esse backup no GitHub.
2. Configure Firebase Auth com os domínios autorizados oficiais e recuperação de senha. O novo cadastro pede somente nome/e-mail; após aprovação, o administrador compartilha o link para a própria pessoa definir a senha. Links de recuperação são credenciais temporárias: compartilhe apenas com o titular.
3. Para salvar chaves pessoais do Gemini, configure `ASSISTANT_VAULT_KEY` no Secret Manager. Gere 32 bytes aleatórios em base64, guarde-os em um gerenciador de segredos e use `npx --yes --package=firebase-tools@15.34.0 firebase functions:secrets:set ASSISTANT_VAULT_KEY --project posvenda-bi`. Não coloque esse valor em `VITE_*`, no GitHub ou no chat. Preserve a chave entre deploys; trocá-la sem migrar os dados impede abrir o cofre existente.
4. Faça login no CLI: `npx --yes --package=firebase-tools@15.34.0 firebase login`. Credenciais administrativas, quando necessárias, devem vir de ADC/`GOOGLE_APPLICATION_CREDENTIALS`, fora do repositório.
5. Confira o CORS do bucket para os domínios oficiais: o cliente agora usa leitura autenticada `getBytes`, sem gerar links públicos permanentes. `cors.json` fornece a configuração de origem a revisar/aplicar com as ferramentas do Google Cloud. CORS não substitui as regras de autorização.

## Publicação

```sh
npm run deploy
```

Esse comando testa, faz audit nos dois pacotes, testa regras em emuladores e gera o build de produção. Depois publica primeiro as funções necessárias e só então Hosting e regras. A configuração fixa o projeto `posvenda-bi`. O comando não limpa dados e não roda a manutenção abaixo.

Por padrão publica o fluxo de Gemini com chaves pessoais, sem exigir chaves compartilhadas de OpenAI/Claude. Para publicar também provedores compartilhados, configure primeiro os respectivos secrets e modelos em `config/assistant`, e informe `DEPLOY_SHARED_AI` com `gemini`, `openai` e/ou `claude`, separados por vírgula. As funções compartilhadas já existentes não são apagadas por esse deploy seletivo.

O aviso de atualização das abas usa ADC se `GOOGLE_APPLICATION_CREDENTIALS` estiver definido; sem isso, o script informa o timestamp e o comando opcional para publicar o aviso. Reabra as abas antigas após esta migração: elas usam o protocolo de acesso anterior.

## Manutenção dos registros anteriores

Após publicar o novo cliente e verificar o acesso dos perfis, execute com credenciais ADC:

```sh
node scripts/security-migration.mjs
```

O padrão é **somente contagem**, sem alterar dados ou imprimir senhas/tokens. Revise o resultado e seu backup. Com `--apply`, remove o campo `senha` das solicitações antigas e invalida URLs antigas de download dos arquivos de negócio. Esse passo é necessário para completar a proteção de dados previamente armazenados; atualizar apenas o código não invalida URLs já emitidas. As senhas que chegaram a ser armazenadas anteriormente devem ser redefinidas pelos respectivos titulares; apagar o campo não desfaz uma eventual exposição.

Cadastre TTL no Firestore para `publicRequestLimits.expiresAt`, removendo registros expirados automaticamente. Sem TTL, o limite continua funcionando, mas os documentos antigos precisam de retenção operacional. Configure alertas de gastos e erros no Firebase/Google Cloud; `maxInstances` é uma contenção de capacidade, não garantia de custo zero.

Os links curtos antigos de setor são recusados nesta release por terem baixa entropia. Gere e distribua os novos links longos pelo painel Acessos antes de comunicar a atualização aos funcionários. Os links individuais longos continuam funcionando. O link de posse permite acesso a quem o receber; não o publique em redes abertas.

## Conferência após publicar e recuperação

- Teste login, aprovação/recuperação de senha, dashboard, desempenho e estoque com contas reais de cada papel. Operacional/supervisor recebem somente pessoa/equipe autorizada; coordenador respeita UF. Importação de estoque e folha fica restrita ao administrador; coordenadores importam vendas pela função validada.
- Verifique um link individual e um de setor sem login. Confirme revogação e ausência de nomes/clientes fora do escopo.
- Conecte uma chave Gemini pela interface, confira seleção/renomeação/exclusão, resposta e gráficos. Não houve chamada paga a provedores durante esta auditoria.
- Confira cabeçalhos, erros de Functions, origem CORS, leituras negadas inesperadas e tamanhos reais dos arquivos. Consultas mensais têm limite de 15 MB; arquivos maiores precisam de particionamento antes da migração.
- Em falha, restaure a versão anterior do Hosting pelo histórico do Firebase e investigue o erro. Não reabra regras antigas para resolver erro de interface. Preserve as restrições e corrija o cliente/servidor; restaure dados somente a partir do backup privado revisado.

Referências: [testes de regras Firebase](https://firebase.google.com/docs/rules/emulator-setup), [emuladores e Java](https://firebase.google.com/docs/emulator-suite/install_and_configure), [Admin SDK Node](https://firebase.google.com/support/release-notes/admin/node).

Alterações revisadas da IA: publicar também assistantChanges e a nova versão de assistantSetTarget (legado bloqueado). O frontend novo depende dessa callable. Não publicar apenas hosting.
