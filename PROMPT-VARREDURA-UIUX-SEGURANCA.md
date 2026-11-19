# Prompt: varredura de segurança + correção de UI/UX e responsividade

Cole o texto abaixo numa sessão nova do Claude Code aberta na pasta do projeto (a raiz que contém `package.json`, `src/` e `functions/`).

---

Você vai trabalhar no **Pós-Venda**, um app interno em React + Vite com Firebase (Functions v2, Firestore, Storage, Hosting). O sistema reúne faturamento, metas, comissões, estoque, NPS e monitores das lojas.

Antes de tudo, leia `PASSAGEM-2026-11-13.md`, `PASSAGEM-2026-11-16.md` e `SEGURANCA-E-ACESSO-2026-11-09.md`.

## Regras (obrigatórias)
- Não há git. Antes de mexer, copie a pasta do projeto para um backup ao lado (`posvenda-src-backup-<data>`). Preserve alterações existentes e não sobrescreva trabalho que não seja seu.
- Nunca exponha, imprima ou faça commit de senhas, tokens, chaves privadas ou valores de `.env`. Não coloque segredos no código nem no frontend. O segredo do Turnstile nunca vai para o frontend nem para o repositório.
- Não faça deploy, não altere dados reais e não rode comandos destrutivos. Use só dados fictícios em testes e capturas, nunca dados pessoais ou de clientes.
- Não desative validações, autenticação ou controles de acesso para fazer testes passarem. Não conceda privilégios por padrão.
- Restrinja a auditoria ao código deste projeto. Não teste sistemas ou domínios de terceiros.
- Antes de executar comandos ou scripts de uma skill externa, leia as instruções e confira o escopo e os efeitos.
- Se faltar alguma configuração externa ou segredo, implemente a estrutura segura e documente exatamente o que falta, sem inventar credenciais.

## Parte 1: auditoria de segurança
1. Instale a skill da Cloudflare só depois de ler o README e o `SKILL.md`:
   `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit`
   Ela precisa de Node.js e usa subagentes. Ela só executa código do projeto dentro de um sandbox sem rede. Sem sandbox, mantenha esses casos como `needs_validation` e não rode o código.
2. Rode a auditoria completa ("security audit this codebase"). Grave a saída numa pasta **fora** do projeto (o padrão é `~/security-audit-skill/<repo>/run-N`).
3. Foco esperado:
   - `functions/` (callables, `tabPolicy`, `securityPolicy`, `cadastroPolicy`, `registration`, `nps*`, `publicRateLimit`);
   - `firestore.rules` e `storage.rules`;
   - telas públicas: `/login`, `/registrar`, `/esqueci-senha`, `/pesquisa`, `/pesquisa/comentar`, `/r/...`, `/pessoal/...`;
   - uploads (`src/pages/Upload.jsx`, `upload/*`);
   - exposição de CPF no NPS.
4. Corrija cada achado **confirmado**, com a menor mudança, e com teste quando houver lógica nova. Achados `needs_validation` vão para a lista de pendências, com o motivo.
5. Rode `npm run security:scan` no fim. Ele precisa terminar com 0 achados.

## Parte 2: UI/UX e responsividade
Rode `npm run dev:preview` (porta 5173, login `teste` / `teste`; dados fictícios, sem backend). A prévia permite trocar de cargo e "ver como" outra pessoa pelo Organograma.

Confira **todas as páginas da sidebar** nos três papéis:
- **colaborador** (operacional, vê o próprio desempenho);
- **supervisor**;
- **coordenador** (o admin também, como referência).

Em cada papel, teste estes tamanhos:
- **Celular**: 360×740, 375×812 e 414×896.
- **Tablet**: 768×1024 e 1024×768.
- **Desktop**: 1280×800, 1440×900 e 1920×1080, com a sidebar aberta e recolhida.
- Os temas **claro e escuro**.

Procure e corrija:
- rolagem lateral da página inteira;
- textos cortados ou sobrepostos;
- botões menores que 36 px no celular;
- popups que saem da tela;
- tabelas sem rolagem própria;
- barras fixas que cobrem conteúdo;
- contraste ruim em algum tema;
- estados vazios, de carregando e de erro sem mensagem clara;
- foco de teclado invisível;
- itens que o papel não deveria ver (isso é bug de segurança, não só visual);
- ícones e espaçamentos inconsistentes entre páginas parecidas.

Pontos que já tiveram bugs e merecem atenção:
- sidebar em gaveta no celular e topbar (`WorkspaceTools.jsx`, `shell.css`, `bottom-bar.css`);
- barra única do Faturamento (`.is-junta`);
- grade de 7 cards de KPI (`src/bi/kpiGrid.js`, `bi.css`);
- gráfico de colunas (`src/bi/Colunas.jsx`);
- tabelas `tabela-pessoas` (Metas, Colaboradores, Estoque);
- Meu Desempenho como app no celular (`html.tela-app`);
- cartões de importação (`upload/CartaoImport.jsx`);
- NPS (totem `/pesquisa` e painel).

Siga o estilo que já existe:
- CSS próprio, sem Tailwind e sem bibliotecas novas;
- componentes da casa;
- comentários curtos em português explicando o porquê.

Corrija na causa, no CSS ou componente compartilhado, e não com remendos por página.

## Para terminar
1. Rode `npm test`, `npm run build`, `npm run build:preview` e `npm run security:scan`. Tudo precisa passar.
2. Tire capturas antes e depois só da prévia, com dados fictícios.
3. Escreva `PASSAGEM-<data>.md` com:
   - o que mudou, por área;
   - os achados de segurança e como foram resolvidos;
   - o que ficou pendente e por quê;
   - o que depende do responsável (deploy, segredos, configurações externas).
4. Não publique nada.
