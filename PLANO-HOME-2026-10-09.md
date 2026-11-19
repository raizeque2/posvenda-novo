# Início e acompanhamento pessoal

Referência visual: home com saudação e entrada de conversa fornecida pelo usuário; cartões de serviços com objetos 3D. Resumo diário compacto, status com texto e cor, alertas que levam ao perfil. Reutilizar SF Pro, temas, Dialog, filtros e fontes de dados existentes. Não instalar uma segunda estrutura de UI.

Capacidades e critérios:
- Início: rota própria, cartões conforme permissões, receita sem duplicar consultor/técnico, data da base explícita, estoque realmente carregado e pessoas sem vendas incluídas. Atenção significa projeção abaixo da meta, não julgamento da pessoa.
- Desempenho: seleção individual, período selecionável, métricas separadas de peças/MO/peças OS, metas de cada mês, área vermelho/verde, projeção, necessidade diária, histórico e calendário. Devoluções descontadas. Não inferir WhatsApp a partir do setor.
- Interface: filtros compactos em metas/comissões, sugestões de metas em bloco separado, remover totais duplicados, evolução de comissões em área, limites do mapa com contraste.
- Novidades: tour com destaque real de elementos, navegação e saída por teclado; novidades em bloco com shimmer que respeita movimento reduzido.
- Assistente: chat local demonstrativo identificado, respostas baseadas na base disponível e propostas explícitas de alteração. Integração real depende de servidor e credenciais/registro oficiais; nenhuma senha ou chave no navegador. Não simular login de provedor. Mudanças de meta exigem revisão, permissão administrativa, versão atual e auditoria no servidor.

Validação: testes de cálculo/isolamento/períodos/devoluções e autorização de propostas; builds normal e preview; navegação, conversa, tour, filtros e leitura em celular e ambos os temas no navegador.

Fontes de pesquisa: https://linear.app/now/dashboards-best-practices (leitura diária rápida e propósito explícito); https://developers.openai.com/siwc/quickstart (elegibilidade e escopos distintos); https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account (integrações de terceiros pela API).

## Resultado da validação

- 47 testes passaram: receita sem duplicação de MO, devoluções, isolamento por pessoa/UF, meses com metas distintas, calendário e pessoa sem vendas, prioridade de papel consultor/técnico, propostas/conflitos de metas, permissões antigas e revogação do dashboard.
- Navegador: consulta/ranking com gráfico; aumento fictício de ANA COSTA de R$ 36.000 para R$ 39.600, confirmado e restaurado para R$ 36.000; perfil JULIA NUNES sem vendas; período anual; detalhe de dia; filtros; tour até aparência com menu móvel e destaque descoberto.
- Home, chat e conexões conferidos em 320, 768 e 1440 px; ambos os temas; cartões 3D e limites municipais visíveis. Dimensões de teste restauradas.
- Builds normal e preview; módulo de funções importado localmente com os quatro exports do assistente. Chamadas externas e gravações reais continuam sem teste por falta de configuração do proprietário.
- IA local é uma demonstração por intenções; login OAuth ainda depende de registro/elegibilidade oficial. Limites e setup detalhados em ASSISTENTE-IA.md.
