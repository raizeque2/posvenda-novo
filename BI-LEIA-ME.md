# Pós-venda • BI personalizável

## Prévia completa — 17/09/2026

A prévia agora abre o aplicativo inteiro: Dashboard/BI e clássico, Meu Desempenho, Estoque, Supervisores, Metas, Comissões, Resumo Mensal, Upload, Colaboradores, Regras e Acessos.

**Login: `teste` — Senha: `teste`.** Esse acesso demonstrativo existe somente na compilação de prévia. Não é uma conta do Firebase. A sessão dura enquanto a aba mantiver seu armazenamento de sessão; Sair encerra o acesso.

Para abrir localmente:

```bash
npm ci
npm run dev:preview
```

Para servir a versão compilada:

```bash
npm run build:preview
npm run preview -- --outDir dist-preview
```

Os dados fictícios incluem três meses, lojas ARA/PEI, peças, serviços, estoque, metas e bônus. As alterações são locais ao navegador. Em Sobre a prévia há CSVs de exemplo e a opção de restaurar a base. A importação de peças ou serviços substitui os registros do mês correspondente; os exemplos não devem ser usados no sistema conectado.

O aplicativo real e os parsers comerciais são reutilizados. Somente no modo preview, o Vite substitui os módulos Firebase por um adaptador local. A compilação falha se detectar o SDK ou a configuração real do Firebase no pacote da prévia. Login real, recuperação de senha, novos acessos e links pessoais permanentes continuam exclusivos do aplicativo conectado.

`dist-preview` é a demonstração; `dist` continua sendo o aplicativo conectado. O login teste/teste nunca é habilitado na compilação de produção. A identidade da hospedagem existente foi preservada em `.openai/hosting.json`. Em 17/09, a conexão Sites retornou projeto não encontrado e nenhum site disponível, portanto esta atualização ainda não foi publicada no endereço anterior.

## O que foi entregue

- Dashboard BI integrado ao dashboard atual, com alternância para a visualização clássica e impressão clássica preservada.
- Widgets reordenáveis por arraste ou setas, altura por arraste/controle e largura por blocos.
- Dimensões arrastáveis: pessoa, loja, canal, data, peça e região; filtros por canal; medidas de receita líquida, unidades e registros.
- Barras, linhas, pizza, rosca, grid e tabela. Detalhamento por clique, cor, título, ordenação e limite configuráveis.
- Cards de canal com expansão ao passar o mouse ou tocar, tamanho compacto/duplo e gráfico configurável.
- Perfis duplicáveis, exclusão, perfil padrão e layouts independentes para computador/celular. Salvamento explícito com controle de concorrência.
- Metas existentes usadas na comparação por pessoa: valor realizado, percentual, quanto falta, atingimento e comparação gráfica. A edição oficial continua em Metas, com as permissões atuais.
- Aba Meu BI no desempenho autenticado, preservando o detalhamento clássico.
- Links permanentes sem senha em Acessos > Links de Acesso. Nome e foto opcionais na aba Meu perfil do portal pessoal. Novos links não apagam os anteriores.
- Mapa coroplético preparado para GeoJSON com população e potencial cadastrado; nenhuma estimativa geográfica foi inventada.

## Publicar

O ZIP contém código-fonte e a pasta `dist` compilada. O frontend continua compatível com a hospedagem atual. Para Netlify manual, publique o conteúdo de `dist` (com `_redirects`).

As novas funções e regras precisam ser implantadas no projeto Firebase existente antes de usar os links e a sincronização:

```bash
npm ci
npm run build
cd functions
npm ci
cd ..
firebase deploy --only functions:criarLinkBI,functions:gerenciarLinkBI,functions:portalBI,firestore:rules
```

Depois publique `dist` pela hospedagem habitual. Não crie outro projeto Firebase. Nenhuma migração dos dados existentes é necessária. As configurações BI ficam em subcoleções `usuarios/{uid}/bi`; os portais em `biLinks`, separados dos cálculos comerciais.

A implantação na conta real não foi executada nesta entrega. Para usar a sincronização, confirme as funções e regras após publicar. A falha de salvamento é mostrada na interface; nunca é apresentada como sincronização bem-sucedida.

## Links permanentes

1. Administrador entra em Acessos > Links de Acesso.
2. Seleciona um colaborador cadastrado e cria um link.
3. Copia e guarda o endereço exibido. O servidor guarda somente o hash do token.
4. O colaborador abre o endereço e personaliza o nome de exibição e a foto na aba Meu perfil; seus layouts são salvos em Meu desempenho.
5. O link permanece válido até ser revogado. Cada novo link cria um espaço independente, inclusive para o mesmo colaborador.

O endereço é uma credencial de acesso: quem o possui acessa aquele desempenho. Não há cadastro com senha. Os dados do titular são filtrados no servidor e campos de cliente/telefone não são enviados. Um nome digitado na aba de perfil não altera o vínculo comercial. Links autenticados antigos `/perfil/:nome` continuam funcionando; usuários operacionais visualizam o próprio desempenho.

## Regional: aguardando a exportação

Para vincular as vendas, a linha importada deve incluir `Cidade`, `Município`, `Municipio` ou `regiao`; identificação da peça em `produto`, `Descrição Produto`, `Descrição`, `Produto` ou `Código Produto`; e quantidade em `quantidade` ou `Quantidade`. Os parsers existentes já preservam colunas adicionais.

O mapa recebe GeoJSON FeatureCollection de polígonos (Polygon/MultiPolygon), coordenadas longitude/latitude WGS84, com propriedades:

- `name`: nome da região, correspondente ao campo regional das vendas.
- `population`: população numérica; `populationYear`: ano; `source`: fonte.
- `potentialParts` e `potentialServices`: potencial mensal estimado em reais para o período selecionado.

Limite de 1.000 regiões; simplificar a geometria para menos de 500 KB para salvar junto aos perfis. Importe outro mapa/base quando mudar a referência do potencial mensal. O mapa usa cores sobre os polígonos importados, sem depender de serviços pagos de mapas.

Aproveitamento estimado = receita líquida / potencial cadastrado. Potencial ainda não capturado = máximo(0, potencial − receita). Isso não equivale a oportunidades comerciais comprovadamente perdidas. População sozinha não mede participação no mercado Honda; frota, demanda e potencial confiáveis precisam ser fornecidos. Sem os campos, o painel indica que não é possível calcular. A seleção da região filtra gráficos e peças; registros sem correspondência são informados.

## Limites das medidas

Receita usa os valores existentes, descontando devoluções, sem reescrever as regras de comissões, bônus, imposto ou fechamento. Quantidade ausente não é tratada como uma unidade. Contagem de registros não representa necessariamente notas fiscais ou atendimentos únicos. Pizza/rosca não representam valores negativos; nesses casos, a interface solicita barras, linhas ou tabela. As metas não são comparadas com recortes regionais sem metas regionais.

## Validação

```bash
node --test tests/*.test.mjs
npm run build
node --check functions/src/biPortal.js
```

Os testes cobrem conciliação com o cálculo clássico, devoluções, filtros, quantidades ausentes, ordem, GeoJSON, autorização de criação, isolamento por titular, apelidos, metas, links independentes, revogação, concorrência e nome/foto. Os testes de backend usam armazenamento simulado, sem alterar a conta real.

Os arquivos de cálculo comercial, processamento de CSV, estoque, comissões, bônus e fechamento não foram modificados. As alterações nos arquivos existentes ficaram limitadas à integração de telas, rotas, exportação das novas funções e regras das novas coleções.

Franca Family foi usada na atualização de 14/09/2026. A atualização de 08/10/2026 usa SF Pro Display local, enviada pelo usuário. Consulte VALIDACAO-BI.md para o histórico da validação.

A interface também foi exercitada em Chromium com uma base fictícia e respostas de persistência simuladas: adição/configuração de widget, mudança de título/canal/formato, salvamento e recarregamento do perfil. A checagem não encontrou erros de execução ou rolagem horizontal a 390px. A base Firebase de produção ainda requer homologação após a implantação.

## Visão inicial por setores — 08/10/2026

O dashboard abre em Visão por setores, com Varejo, Web, Televendas, Atacado, Peças O.S. e Mão de obra juntos, além do total líquido do período. Cada cartão mantém meta e projeção; o BI personalizável continua disponível na segunda aba.

A prévia inclui vendas e metas fictícias do mês atual. Ao mudar o mês do calendário, acrescenta a demonstração sem sobrescrever arquivos importados ou metas editadas. As metas vazias da base demonstrativa antiga são preenchidas uma única vez; alterações posteriores são preservadas. Dados demonstrativos ficam somente no navegador.

Validação: 26 testes automatizados passaram; a visão por setores e a alternância para o BI foram verificadas no navegador.

## Atualização de visualização — 28/09/2026

- Comissões ganhou cartões de total, comissão e bonificação, ranking dos maiores valores e evolução mensal em ordem cronológica.
- Supervisores ganhou gráfico de linhas por equipe com realizado, projeção e referência de 100% da meta. O seletor alterna Peças, Mão de obra e Peças O.S.
- O BI mostra um perfil pronto de varejo e permite agrupar gráficos por cidade ou bairro, além de região. O ranking territorial funciona com as colunas de localidade das vendas; GeoJSON é opcional para exibir polígonos no mapa. Localidades ausentes na base real não são inferidas.
- Os cards abrem um gráfico com 7 ou 30 dias, linha de projeção, meta e comparação com semana, mês ou trimestre anteriores quando existe histórico. Os gráficos de datas também têm seleção de período e comparação. A projeção usa a última data presente na base e não representa venda confirmada.
- Os blocos podem ser arrastados pela alça sem entrar no modo de edição. O botão Configurar abre um popup central com escolhas de medida, origem, agrupamento, formato e visualização. É necessário salvar o perfil para persistir a configuração.
- Regras está organizada em Vendas e lojas, Oficina, Comissões e Indicadores. Acessos pode preparar uma mensagem única com links permanentes individuais, filtrados por estado, loja e setor; o recurso exige o aplicativo conectado e permissão administrativa.

A revisão de segurança e suas limitações estão em [SECURITY-REVIEW-2026-09-28.md](SECURITY-REVIEW-2026-09-28.md). A prévia local usa login `teste` / senha `teste`; nenhuma alteração demonstrativa é enviada ao backend real.

## Gráficos Bklit e blocos arrastáveis — 17/09/2026

O BI personalizável usa os componentes oficiais Bklit para barras, linhas, área, pizza e rosca. Grade e tabela continuam disponíveis. Os gráficos clássicos permanecem no fluxo existente.

Em Configurar análise, as caixinhas selecionam fonte (peças/serviços), medida, agrupamento, formato, legenda, referências, detalhes, valores e comparação com metas quando aplicável. O tamanho pode ser Compacto, Largo, Alto ou Grande. Clique em Aplicar e depois Salvar perfil para preservar as escolhas.

Em Personalizar, arraste pela alça do bloco. No celular, segure a alça antes de mover. Também é possível focar o bloco e usar Alt + setas. Computador e Celular têm layouts próprios.

Fontes Bklit e licença MIT estão em src/components/bklit; PROVENANCE.json registra a origem. O grid enviado pelo usuário foi integrado em src/components/ui/draggable-widget-grid.tsx, sem o dashboard fictício do exemplo. O CSS foi adaptado ao projeto existente, sem inicializar Tailwind globalmente. components.json registra @bklit; futuras instalações podem exigir adaptar classes Tailwind ao CSS atual.

Validação: 24 testes automatizados passaram; build normal e build de prévia passaram. Verificação no navegador: login teste/teste, formato Área e legenda persistidos após recarregar, reordenação por teclado e mouse, visualização com largura 390px sem transbordamento horizontal. Alterações demonstrativas ficam no navegador. A publicação do endereço online continua pendente da conexão proprietária.

## Tema, personalização e mapa pronto — 08/10/2026

- Aparência, no menu lateral, alterna os temas claro e escuro. A escolha fica neste navegador e é aplicada antes de carregar a página. SF Pro Display Regular, Medium e Bold são servidas em `public/fonts`, sem requisição de fonte externa.
- A apresentação aparece no primeiro acesso de cada usuário neste navegador. Quatro etapas explicam a visão por setores, os gráficos personalizáveis, a análise regional e a aparência. Novidades reabre a apresentação; fechamento e conclusão ficam registrados localmente.
- Os cartões do BI alternam comparativos em reais e percentual com dias e períodos equivalentes. A comparação acompanha filtros, canal e medida. Só aparece quando há histórico suficiente; arquivos sem hora da venda não geram afirmações de comparação “neste horário”.
- Os gráficos podem ser redimensionados pelo canto inferior direito, por teclado ou pelos campos de largura e altura em Configurar análise. A largura usa 12 colunas e a altura tem limites de 260–1.000 px; o encaixe no painel mantém os blocos sem sobreposição. Clique em Salvar para persistir. Computador e celular conservam layouts independentes.
- O card de um widget tem a altura do próprio conteúdo: uma lista curta não deixa mais centenas de pixels vazios embaixo, e os gráficos continuam usando a altura escolhida no bloco. As janelas de detalhe (cartão de KPI e detalhes da análise) abrem no centro da tela, sobre o fundo desfocado.
- Estado, Loja e Supervisor ficam como ícones, com opções à direita ao passar o mouse, clicar ou usar o teclado. Dias úteis, passados e restantes ficam à direita. As ações secundárias do BI estão no menu de três pontos; a dica de arraste deixou de ocupar espaço na tela.
- Análise regional é um mapa de calor: o contorno do país (branco sobre o painel cinza) com um borrão verde→âmbar→vermelho em cada município com venda, proporcional à receita. Não há malha municipal desenhada — o fundo é um único traço. A prévia localiza seus registros de Arapiraca e Recife sem importar arquivo. O mapa enquadra as localidades com vendas; outras áreas são apenas contexto. O worker carrega três arquivos pequenos (`municipios-index.json`, com nome/UF; `municipios-centros.json`, com o centro de cada cidade; e `brasil-silhueta.json`, com o contorno do país) em vez das malhas estaduais completas — o custo deixa de crescer com o número de municípios do Brasil. O contorno é gerado por `scripts/build-brasil-outline.mjs` a partir das mesmas malhas do IBGE; a origem e o processamento estão em `public/maps/SOURCE.json`.
- Cidade, Região e Bairro podem ser visualizados como blocos de calor, barras, rosca ou tabela. O mapa geográfico usa o centro dos municípios; bairros usam blocos de calor, sem polígonos inventados. Localidades homônimas são separadas por cidade/UF. Sem UF, a vinculação automática exige um nome municipal único. A seleção filtra os gráficos e seus comparativos. GeoJSON próprio continua opcional, com população e potencial fornecidos pelo usuário.

Os componentes enviados foram integrados em `src/components/ui/theme-toggle.tsx` e `src/components/ui/dialog.tsx`, usando Lucide e Radix Dialog. O projeto já suporta TSX no Vite, usa o alias `@` para `src` e mantém os estilos existentes em CSS. Não houve inicialização global do Tailwind, que alteraria o visual das telas atuais. `components.json` registra os diretórios e o registry Bklit; `src/components/ui` é o diretório compartilhado para componentes reutilizáveis.

Auditoria das dependências e limitações: [SECURITY-REVIEW-2026-10-08.md](SECURITY-REVIEW-2026-10-08.md). Nenhuma conta, dado de produção ou hospedagem foi alterada nesta prévia.

Validação desta atualização: 32 testes passaram; build conectado e build de prévia passaram. No navegador foram verificados tema e tamanho salvo após recarregar, apresentação de quatro etapas, filtros por estado e cidade, formatos regionais, reordenação por mouse/teclado e redimensionamento por mouse/teclado. A largura de 390 px foi verificada sem transbordamento horizontal. Os dados geográficos localizaram 96 de 96 registros demonstrativos. O build conectado mantém um aviso de tamanho do pacote Firebase; não é erro de compilação.
