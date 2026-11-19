# Atacado e Monitor de O.S. — 21/10/2026

## Escopo e integração

Referência fornecida pelo usuário: paginas-monitor-os-e-atacado.zip. As páginas, abas e motores de análise foram adaptados; o LEIAME foi tratado como documentação do material. Layout e navegação reutilizam AppLayout, PageHeader, filtros, cards, tabelas, modal e tokens do projeto. AnalysisDS reúne apenas adaptações entre a interface recebida e o DS existente, sem duplicar a aplicação. Ícones usam o Iconoir local. Rotas carregam sob demanda.

- `/atacado`: primeiro item de Gestão. Geral (faturamento, meta, margem, carteira, positivação, novos/reativados, ticket, itens por nota, concentração, evolução, vendedores, mercadorias e peças), Peças, Clientes com recompra expandida, Inativos e Cobertura. Filtros globais de mês/UF/lojas/busca e filtros adicionais preservados. Tabelas maiores paginam sem reduzir os totais. Gráfico de faturamento usa ComposedChart para combinar barras, meta e média. Devoluções descontam valores e quantidades; notas distinguem lojas. Histórico não usa meses posteriores ao selecionado.
- `/monitor-os`: último item de Operacional. Visão Geral e Regras; situações, lojas/supervisores, criticidade, grupos, prioridades, pontos de atenção, tabela paginada, exportação e detalhamento por clique. Mantém comparação atual/anterior e apurações por carga. CSV exportado neutraliza fórmulas de planilha. Modais e ordenação têm controles de teclado.
- Regras do Atacado em Regras → Vendas e lojas → Atacado; cortes crescentes e queda percentual validados. Regras de O.S. editáveis pelo administrador dentro do Monitor; confirmações de importação e salvar regras usam RainbowButton.
- Upload → Monitor de O.S. aceita CSV até 5 MB, lê UTF-8/Windows-1252, consolida por loja+número, rejeita dados essenciais ausentes e pede confirmação. Uma gravação JSON atualiza atual/anterior/histórico juntos. Falha na gravação mantém a carga vigente. Vendas, metas e estoque não são substituídos pelo CSV de O.S.

## Dados e acesso

Atacado utiliza os CSVs de peças já importados. O Monitor requer um arquivo específico com Empresa, Nº O.S., Data Emissão, Situação e os demais detalhes; nenhum dado fictício foi inserido na base real. A demoOS do ZIP não foi publicada nem criada como rota pública.

Administrador vê a base completa. Coordenador/supervisor usam o gateway existente com escopo por UF, loja e equipe; consultas especializadas exigem perfil de gestão e respeitam permissões salvas. Dados brutos de linhas de O.S. e histórico global não são entregues fora do administrador. Campos de clientes são liberados apenas na consulta específica de atacado autorizada; o endpoint comum continua removendo dados pessoais. Permissões padrão incluem os módulos para gestão; configurações salvas não são sobrescritas. Escritas continuam restritas ao administrador pelas regras existentes. Configurações usam config/regrasOS e config/atacadoConfig; foto usa Dados/OS/monitor.json, sem URLs públicas permanentes.

Produção requer publicar também a alteração de lerDadosAutorizados junto ao frontend. Nenhum deploy executado nesta tarefa.

## Validação

- 147 testes passaram, nenhum ignorado, incluindo consolidação, criticidade, devoluções, histórico, acesso por equipe/UF, persistência em falha e renderização das cinco abas/tabelas com o DS.
- Builds de produção e prévia verificados. A renderização em servidor verifica contratos dos componentes; não substitui inspeção visual. Recharts emite aviso de dimensões durante SSR por não existir viewport.
- CSVs reais de julho–outubro: respectivamente 5.823 / 4.667 / 5.547 / 2.730 movimentos de atacado; 279 / 252 / 228 / 188 clientes; 1.822 / 1.691 / 1.768 / 1.234 produtos. Receita por cliente e por produto conciliou com o total líquido em todos os meses. Nenhum nome ou dado bruto entrou neste documento ou no build.
- Inspeção visual indisponível por bloqueio anterior da ferramenta de navegador; não foi contornado. Rotas verificadas por HTTP no servidor local.
