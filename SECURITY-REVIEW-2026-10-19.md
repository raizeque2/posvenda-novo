# Revisão de segurança e release — 19/10/2026

## Resultado

Código corrigido e preparado para publicação com as etapas de configuração e manutenção descritas em `DEPLOY.md`. A revisão não comprova ausência absoluta de falhas e não certifica a infraestrutura atualmente publicada. Nenhum deploy, limpeza no banco ou redefinição de senha real foi executado.

## Correções

- Dependências: audit inicial apontava 30 alertas na aplicação e 16 nas funções, incluindo um crítico em cada árvore. Os dois audits finais estão zerados. Atualizados Vite/plugin React, Router, Firebase e Admin/Functions; gRPC foi fixado em versão corrigida por override. Admin usa APIs modulares. Locks reproduzíveis incluídos.
- Importação: autenticação sozinha não autoriza alterações. Apenas administrador/coordenador ativo importa vendas; CSV, tipo, tamanho, motivo e UF são validados. Coordenador preserva os registros de outra UF, com condição de geração contra sobrescrita concorrente. Estoque/folha exigem administrador.
- Cadastro: eliminada gravação de senha em texto simples. Solicitações são validadas e limitadas no servidor, sem escrita anônima direta no Firestore. Aprovação gera link de definição de senha.
- Autorização: perfis inválidos/desativados não acessam dados de negócio; falha ao validar perfil encerra a sessão. Evitada alteração de perfil próprio que retiraria o acesso administrativo. Desativação bloqueia o perfil antes de revogar refresh tokens; exclusão também remove BI pessoal e cofre da conta.
- Dados: arquivos completos, metas, remuneração e snapshots deixam de ser legíveis diretamente por qualquer conta. Gateway servidor filtra pessoa/equipe/UF e mês; remove colunas de clientes e salário cadastral. Equipe atual não libera os meses de outra equipe. Testes cobrem acesso direto, caminhos inválidos e manipulação de perfil.
- Sessão/cache: isolamento por usuário, limpeza na saída, descarte de perfil atrasado e restrição de cache de arquivos completos a administradores. Regras nominativas não persistem mais no cache global de produção.
- Links: limites públicos persistentes em Firestore, tokens novos longos, revogação validada no servidor, nenhuma leitura pública direta da coleção de snapshots. Leituras de Storage passam a usar autenticação, sem gerar URLs permanentes de download.
- CSVs de estoque/promoções/histórico neutralizam fórmulas e escapam os campos importados, incluindo códigos destinados ao Micro Work.
- Navegador: CSP, HSTS, prevenção de embedding, tipos de conteúdo e referrer restritos; microfone permitido somente à própria origem. Funções restringem origens aos domínios oficiais e desenvolvimento local.
- Release: deploy com verificações e ordem de publicação das funções/regras; pacote não inclui credenciais, dados reais, backups, histórico Git, node_modules ou builds.

## Evidências

- 104 testes automatizados passaram, cobrindo cálculos, BI, assistente, cofre, ditado, portais, limites públicos, cadastro e as novas fronteiras de autorização.
- Teste integrado no Emulator Suite oficial: Firestore e Storage validaram negações e permissões para anônimo, inativo, operacional, coordenador e administrador; HTML no Storage foi recusado.
- Builds de produção e prévia sem avisos de tamanho; importação das funções com Admin modular e 16 verificações do servidor também passaram no Node 22.23.3. Instalação limpa do pacote e checks finais registrados em `security-reports`.
- Varredura de padrões de segredos em arquivos de código/configuração e histórico Git local: nenhum segredo correspondente encontrado. A configuração web pública do Firebase é identificador público e foi distinguida de chaves administrativas.
- Navegador real: login fictício e dashboard com BI e metas carregaram, sem erros de console na checagem. Isso não substitui o teste com contas e volumes de produção.

## Limites e providências de produção

Antes de publicar, confira configurações reais de colaboradores/regras/comissões e o segredo do cofre. Depois da migração, remova senhas antigas e invalide URLs antigas com o procedimento de manutenção. O pacote não executa esses passos automaticamente.

Links curtos legados de setor foram desativados para impedir adivinhação de tokens de baixa entropia. Redistribua os links longos gerados pelo painel Acessos antes da publicação. Não exponha links de posse publicamente.

Não houve pentest externo completo, teste físico de microfone, carga, certificação WCAG, leitura de IAM/Secret Manager/planos da conta ou chamada real ao Gemini. Audits refletem os avisos publicados no momento da revisão; mantenha-os em CI. O override gRPC e atualizações principais exigem atenção em futuras atualizações.

Os testes de autorização não eliminam a necessidade de revisão dos cadastros: nome do perfil, supervisor, loja e UF devem estar corretos. Arquivos mensais acima de 15 MB precisam de particionamento. Importação de múltiplos meses pode concluir parcialmente em falhas de rede/concorrência; revise o resultado antes de reenviar.
