# Versão real: estado do código

As telas da demonstração foram levadas para este código, em `src/pv/`, com rotas, menu e permissões. **Nada aqui foi compilado ou executado**: a máquina usada não tinha npm. Antes de publicar, rode os passos abaixo.

## O que entrou

- `src/pv/`: Meu Painel, Canais, Organograma, Perfil (`/conta`), Análise Geográfica, top bar, notificações, onboarding, tema e fonte Geist.
- `src/bi/Workspace.jsx`: cards com ícone e gráfico, tabela da equipe, ranking no lugar do mapa, detalhe da pessoa por dia e mês.
- `src/pages/Comissoes.jsx`: lista operacional com detalhe e bônus. `src/pages/metas/MetasTable.jsx`: resumo no topo.
- `src/components/Sidebar.jsx` e `src/data/permissoes.js`: categorias novas e permissões.
- `.github/workflows/build.yml`: compila e testa a cada envio ao GitHub, sem publicar.

## Validar antes de publicar

```sh
npm ci
npm test
npm run test:rules
npm run build
npm run dev:preview
```

Confira no navegador: Faturamento, Canais, Comissões, Metas, Organograma, Perfil e Análise Geográfica.

## O que falta para ser completo

| Item | Situação |
|---|---|
| Correções feitas direto no build em 29/10 (itens A a J do `PROGRESSO.md` do pacote de deploy) | Não estão neste código. Refazer em `src/` |
| Monitor de Requisições e de Reservas | A tela existe, mas lê `/assets/dados/...`, que não existe aqui. Ligar a `Dados/Requisicoes` e `Dados/Reservas` no Storage. O site no ar já tem esses módulos, em código que não veio neste pacote |
| Tela nova de entrar e cadastro em etapas | Não trazida: a da demonstração guarda contas no navegador. Refazer `src/pages/Login.jsx` e `Registro.jsx` com o visual novo, usando Firebase Auth e `solicitarAcesso` |
| Organograma, períodos, solicitações, fotos | Funcionam só no navegador de quem usa (`localStorage`). Mover para Firestore e Storage, com regras por nível |
| Acesso por setor | Só existia na conta de demonstração. Criar campo em `usuarios/{uid}` e validar em `firestore.rules` |
| Separar dados por equipe | Hoje é só na tela. Exige regras no servidor |
| Testes em `tests/` | Podem falhar onde verificam o mapa regional do dashboard, que foi trocado pelo ranking |

## Publicar

Siga `DEPLOY.md`: backup, depois `npm run deploy`, com autorização do responsável.

## Antes de ir ao ar

- Trocar `public/flags/`, que veio de um site de terceiros, por uma fonte oficial.
- Confirmar a licença do template AdminCN.
- Não enviar dados reais para o GitHub.
