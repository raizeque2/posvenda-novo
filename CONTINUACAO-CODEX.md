# Continuação do projeto de pós-venda

O usuário pediu o restante do site na prévia e um acesso de teste com login `teste` e senha `teste`. A implementação está nesta pasta; não reextraia o ZIP original sobre ela.

## Estado

- A prévia reutiliza App.jsx e todas as páginas do aplicativo; não é mais uma página isolada de BI.
- src/preview contém dados fictícios, repositório local, adaptador SDK e login teste/teste.
- scripts/preview-isolation.mjs substitui o Firebase apenas em modo preview e rejeita a inclusão do backend real no pacote demonstrativo.
- Vite normal gera dist conectado; modo preview gera dist-preview local. Não publique dist-preview no Firebase de produção.
- Nenhuma regra comercial original foi reescrita. As alterações administrativas da prévia afetam apenas dados locais.
- Execute `npm test`, `npm run build` e `npm run build:preview` para validar mudanças. Leia VALIDACAO-BI.md para a cobertura e os limites.

## Publicação pendente

Use exatamente o project_id de .openai/hosting.json, copiando o valor literalmente do arquivo local.

Endereço anterior: https://pos-venda-bi-interativo.ryan-santos257271.chatgpt.site/

Em 17/09/2026, get_site retornou projeto não encontrado, e list_sites retornou lista vazia na conexão atual. O usuário não entendeu a solicitação de reconectar a conta e pediu o login de teste, que foi implementado localmente. Não há autorização para substituir o projeto por outro nem para publicar no Firebase real.

Quando a conta proprietária estiver acessível: confirme o público atual, mantenha o acesso privado, obtenha credencial temporária sem expô-la, envie o estado exato do código, leia o SHA completo após o push, empacote dist-preview com o manifesto correto, salve a versão e publique. Verifique o estado final antes de afirmar que o endereço online foi atualizado.

O pacote local e a prévia podem ser usados enquanto a hospedagem está indisponível. Não confunda o login teste/teste da aplicação com a conta que gerencia a hospedagem.

## Gráficos Bklit e blocos arrastáveis — 17/09/2026

O BI personalizável usa os componentes oficiais Bklit para barras, linhas, área, pizza e rosca. Grade e tabela continuam disponíveis. Os gráficos clássicos permanecem no fluxo existente.

Em Configurar análise, as caixinhas selecionam fonte (peças/serviços), medida, agrupamento, formato, legenda, referências, detalhes, valores e comparação com metas quando aplicável. O tamanho pode ser Compacto, Largo, Alto ou Grande. Clique em Aplicar e depois Salvar perfil para preservar as escolhas.

Em Personalizar, arraste pela alça do bloco. No celular, segure a alça antes de mover. Também é possível focar o bloco e usar Alt + setas. Computador e Celular têm layouts próprios.

Fontes Bklit e licença MIT estão em src/components/bklit; PROVENANCE.json registra a origem. O grid enviado pelo usuário foi integrado em src/components/ui/draggable-widget-grid.tsx, sem o dashboard fictício do exemplo. O CSS foi adaptado ao projeto existente, sem inicializar Tailwind globalmente. components.json registra @bklit; futuras instalações podem exigir adaptar classes Tailwind ao CSS atual.

Validação: 24 testes automatizados passaram; build normal e build de prévia passaram. Verificação no navegador: login teste/teste, formato Área e legenda persistidos após recarregar, reordenação por teclado e mouse, visualização com largura 390px sem transbordamento horizontal. Alterações demonstrativas ficam no navegador. A publicação do endereço online continua pendente da conexão proprietária.

## Portal de colaboradores e supervisores — 22/10/2026

Rota própria em `/portal` (link no rodapé do Login). A entrada mostra duas opções (colaborador/supervisor), depois um seletor central só com nome e loja e, ao escolher a pessoa, o campo de senha abre abaixo. No primeiro acesso a pessoa cria a senha; depois só entra com ela.

- Tudo que decide acesso está no servidor (`functions/src/portal.js`): `portalPessoas`, `portalEntrar`, `portalListar`, `portalRedefinir`, `portalPerfil`. Senha com scrypt e sal por conta; cinco erros bloqueiam e só o administrador reabre (aba Portal em `/acesso`). As regras puras ficam em `functions/src/portalPolicy.js`.
- Coleção `portalContas` não tem leitura nem escrita pelo cliente (`firestore.rules`); o Admin SDK ignora a regra. A conta cria/atualiza o perfil em `usuarios/{uid}` com `portal: true`, `nome` igual ao cadastro de colaboradores e cargo `supervisor` ou `operacional` — é o que faz o `lerDadosAutorizados` entregar o escopo certo (a equipe do supervisor é o campo `supervisor` do cadastro, como em Equipes.jsx).
- Conta do portal não entra no aplicativo administrativo: `AppLayout` redireciona para `/portal/desempenho`.
- Visão geral usa `kind: 'overview'` do gateway: totais do mês por loja, sem nomes nem linhas de venda.
- Limite conhecido da regra escolhida pelo usuário: quem souber nome e loja de alguém que ainda não definiu senha pode definir a senha dessa pessoa. O bloqueio de cinco tentativas e a redefinição pelo administrador cobrem o uso indevido depois do primeiro acesso, mas a primeira definição não tem prova de posse. Se isso virar problema, a próxima evolução é exigir um código curto entregue pelo administrador no primeiro acesso.
- Perfil guarda foto (data URL reduzida a 96 px) e nome de exibição no documento do próprio usuário; o servidor recusa qualquer outro campo.
- Testes novos: `tests/portal.test.mjs` (senha, bloqueio, lista, perfil) e as novas negações de `portalContas` em `tests/security-rules.emulator.mjs`; `tests/data-access.test.mjs` cobre o agregado da visão geral.
- Publicar exige regras e funções: `firebase deploy --only functions,firestore:rules` (ver DEPLOY.md). Sem as funções no ar, a entrada do portal não abre.

