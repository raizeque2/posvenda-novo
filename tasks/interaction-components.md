# Componentes de interação — 20/10/2026

Ordem: lógica compartilhada → componentes → integração → testes de navegador/build.

| Módulo | Integração e critérios |
| --- | --- |
| streaming-text | Revelar respostas reais por palavras, uma vez, preservando Markdown seguro. Ações/gráficos/confirmações após terminar. Sem fontes fictícias, sem reiniciar respostas antigas, sem animação em movimento reduzido. |
| action-search | Busca persistente no topo e sugestões no prompt. Catálogo respeita permissões. Teclado/setas/Escape, seleção navega; pergunta sem página vai ao assistente somente após envio explícito. Nunca consultar a IA a cada tecla. |
| upload-status | Island global ligado a leitura/processamento/atualização de CSVs reais. Continua visível ao navegar. Percentual só quando mensurável; erro permanece até dispensar; não reenviar arquivo automaticamente. Folha exige revisão antes de importar. |
| activity-ring | Perfil individual: mês (externo), semana (meio) e dia observado/selecionado (interno). Projeção mensal da mesma pessoa/métrica em traçado claro e valor explícito. Semana de segunda a domingo limitada ao mês selecionado. Mesma receita líquida da tela, dias úteis/feriados e sábado meio dia; período sem base/meta não significa objetivo cumprido. |
| stack-panel | Menu de atalhos no topo com seções e páginas permitidas, navegação em camadas, voltar/Escape e movimento reduzido. |

Componentes TSX em `src/components/ui`, estilos em CSS como o restante do projeto, `motion/react` já instalado. A instalação opcional completa de Tailwind/shadcn está documentada em `tasks/rainbow-button.md`. Preservar licença MIT dos componentes Kokonut. Sem deploy, dados fictícios no teste de navegador.

## Validação

- 114 testes automatizados passaram; após ajustes finais, os 32 testes das áreas afetadas passaram novamente.
- Navegador: busca sem acentos navegou para Comissões; pergunta foi ao chat; sugestão no prompt abriu Metas; menu em camadas abriu Meu Desempenho.
- Revelação real observada com texto parcial e ações ocultas; Mostrar tudo liberou a resposta completa e suas ações. A apresentação é progressiva no cliente após receber a resposta; as callables dos provedores permanecem sem transporte SSE.
- Prévia isolada na porta 5175: CSV válido concluído; CSV inválido manteve erro ao navegar; folha cancelada e reaberta com o mesmo arquivo antes de confirmar; nenhuma importação feita na base principal da porta 5174.
- Mobile: sem dock flutuante, largura do documento igual à viewport, status e seus detalhes sem corte. Temas claro/escuro conferidos.

Ajuste solicitado: anéis Mês/Semana/Dia; projeção mensal reaproveita d.projection do perfil (histórico pessoal + ritmo atual), sem somá-la ao realizado. Os 15 testes de anéis/projeção pessoal passaram, incluindo limite entre meses, feriados, falta de base e meta ausente.

Builds de produção e prévia passaram após o ajuste dos anéis. A nova inspeção visual foi bloqueada pela ferramenta de navegador; a disposição final foi validada por testes de cálculo e compilação, sem contornar o bloqueio. Nenhum deploy realizado.
