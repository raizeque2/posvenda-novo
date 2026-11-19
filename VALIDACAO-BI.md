# Validação da prévia completa — 17/09/2026

## Implementação

A prévia reutiliza App.jsx, suas rotas e as telas originais. A navegação inclui Dashboard/BI e clássico, Meu Desempenho, Estoque, Supervisores, Metas, Comissões, Resumo Mensal, Upload, Colaboradores, Regras e Acessos. Workspace, widgets, perfis e mapa do BI foram preservados.

O modo preview substitui Firebase Auth/Firestore/Storage/Functions por módulos locais em src/preview. O modo normal mantém Firebase e autenticação reais. A configuração do Vite impede a inclusão do SDK real no pacote demonstrativo. Cache de meses, regras, filtros e perfis da prévia usam nomes separados dos caches do aplicativo conectado.

Login demonstrativo solicitado: teste / teste. Credenciais inválidas são recusadas, Sair encerra a sessão e a senha não é armazenada. Isso simula a navegação de login, não constitui uma barreira de segurança para dados reais.

A base possui três meses de dados fictícios, lojas válidas ARA e PEI, colaboradores operacionais e gestores, metas, devoluções, serviços, estoque e bônus. A importação local usa os parsers existentes, valida mês fechado, exige motivo para correções retroativas e preserva a versão anterior localmente. Persistência com falha não indica sucesso.

## Evidências

24 testes automatizados aprovados, cobrindo:

- Conciliação BI/clássico, devoluções, filtros, quantidades, metas sem vendas e GeoJSON.
- Backend simulado dos links: autorização, isolamento, revogação, concorrência, nome e foto.
- Persistência local, cópias independentes, revisão, falha de armazenamento e restauração.
- Importação real de CSV demonstrativo, preservação de outros meses/fontes, correção retroativa e arquivos inválidos.
- Contas fictícias, bloqueio de credenciais/links reais, notificações, transações e login teste/teste.

Navegação conferida nas telas principais sem erros de execução observados. Meta de Ana alterada para 41.000 e exibida no dashboard. Bônus alterado para 200 com justificativa e confirmação de salvamento. CSV demonstrativo importado pela própria tela: uma linha, zero inconsistências, receita de peças de 500 no dashboard e serviços preservados. A tela de login foi testada no navegador com senha incorreta e com teste/teste. A sessão foi mantida ao recarregar; Sair encerrou a sessão. Em 390 × 844, login, cabeçalho, filtros e menu foram conferidos; o dashboard não tem rolagem horizontal da página. O cabeçalho foi ajustado para ficar abaixo da faixa demonstrativa e acima dos filtros.

As duas compilações concluíram: aplicativo conectado em dist e demonstração em dist-preview. O pacote conectado tem um aviso de tamanho do fornecedor Firebase; a prévia não inclui esse fornecedor. Os arquivos originais de cálculo comercial e parsers de importação não foram reescritos.

## Limites e publicação

Esta é uma demonstração local, sem implantação no Firebase. Criação de usuários reais, recuperação de senha, aprovação de acessos e links pessoais compartilháveis estão bloqueados e explicados na interface. Recursos de edição e importação operam apenas sobre a base local fictícia.

O mapa continua aguardando os arquivos regionais reais; localização da loja não é tratada como origem do cliente. Nenhuma população, potencial ou quantidade ausente foi inventada.

O projeto Sites existente é preservado em .openai/hosting.json. A consulta em 17/09/2026 retornou “Sites project not found”; a listagem da conexão atual retornou vazia. A publicação online desta atualização não foi executada. É necessário recuperar acesso ao projeto existente para enviar o código e publicar uma versão privada no mesmo endereço. Não criar um projeto substituto automaticamente.

## Gráficos Bklit e blocos arrastáveis — 17/09/2026

O BI personalizável usa os componentes oficiais Bklit para barras, linhas, área, pizza e rosca. Grade e tabela continuam disponíveis. Os gráficos clássicos permanecem no fluxo existente.

Em Configurar análise, as caixinhas selecionam fonte (peças/serviços), medida, agrupamento, formato, legenda, referências, detalhes, valores e comparação com metas quando aplicável. O tamanho pode ser Compacto, Largo, Alto ou Grande. Clique em Aplicar e depois Salvar perfil para preservar as escolhas.

Em Personalizar, arraste pela alça do bloco. No celular, segure a alça antes de mover. Também é possível focar o bloco e usar Alt + setas. Computador e Celular têm layouts próprios.

Fontes Bklit e licença MIT estão em src/components/bklit; PROVENANCE.json registra a origem. O grid enviado pelo usuário foi integrado em src/components/ui/draggable-widget-grid.tsx, sem o dashboard fictício do exemplo. O CSS foi adaptado ao projeto existente, sem inicializar Tailwind globalmente. components.json registra @bklit; futuras instalações podem exigir adaptar classes Tailwind ao CSS atual.

Validação: 24 testes automatizados passaram; build normal e build de prévia passaram. Verificação no navegador: login teste/teste, formato Área e legenda persistidos após recarregar, reordenação por teclado e mouse, visualização com largura 390px sem transbordamento horizontal. Alterações demonstrativas ficam no navegador. A publicação do endereço online continua pendente da conexão proprietária.
