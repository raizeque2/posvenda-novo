# Pós-Venda BI

Dashboard operacional para gestão de pós-venda — Peças e Oficina.

## Requisitos

- Node.js 24.15+ (validado com 24.19.0)
- npm 12.2+; Java 21+ para testar as regras Firebase

> Release revisada em 19/10/2026: leia **DEPLOY.md** antes de publicar e **SECURITY-REVIEW-2026-10-19.md** para resultados e limites da auditoria. O ZIP usa somente package-lock.json e npm.

## Instalação e execução

```bash
# 1. Instale as dependências
npm ci

# 2. Inicie o servidor de desenvolvimento
npm run dev

# 3. Abra no navegador
# http://localhost:5173
```

## Estrutura do projeto

```
src/
├── App.jsx                        # Roteamento principal
├── store.js                       # Estado global (Zustand)
├── index.css                      # Design system / estilos globais
│
├── data/
│   ├── regras.js                  # Regras de peças, oficina, lojas, comissões
│   └── metas.js                   # Metas mensais por colaborador
│
├── pages/
│   ├── Dashboard.jsx              # Painel principal com KPIs e rankings
│   ├── Comissoes.jsx              # Comissão calculada + bonificação manual
│   ├── Upload.jsx                 # Importação de CSVs
│   ├── Colaboradores.jsx          # CRUD de colaboradores e metas
│   ├── Regras.jsx                 # Visualização das regras cadastradas
│   ├── Inconsistencias.jsx        # Painel de tipos não reconhecidos
│   └── portal/                    # Portal do colaborador e do supervisor (/portal)
│
├── components/
│   ├── Sidebar.jsx                # Navegação lateral
│   └── UI.jsx                     # Componentes reutilizáveis (Badge, KpiCard, etc.)
│
├── services/
│   ├── processamento/
│   │   ├── parseCSV.js            # Parser CSV com suporte a aspas duplas
│   │   ├── processarPecas.js      # Engine de processamento de peças
│   │   └── processarOficina.js    # Engine de processamento de oficina
│   └── ranking/
│       └── buildRanking.js        # Consolidação por colaborador + comissão
│
└── utils/
    ├── normalizacao.js            # norm(), buildApelidoMap(), resolveNome()
    ├── datas.js                   # parseDateBR, diasUteis, projeção
    └── formatacao.js              # fmtBRL, fmtPct, parseBR
```

## Como usar

### Portal do colaborador e do supervisor (/portal)

Acesso próprio, separado do login do sistema, com link no rodapé da tela de Login.

- A pessoa escolhe se entra como colaborador ou supervisor, seleciona o próprio nome (só nome e loja aparecem antes do login) e define a senha no primeiro acesso.
- A senha é gravada como hash no servidor (Cloud Functions). Cinco erros bloqueiam o acesso e só o administrador reabilita em **Acessos → Portal**.
- Dentro do portal: **Meu desempenho** (metas do dia, semana e mês, projeção, quanto falta e o necessário por dia útil), **Visão geral** (andamento da empresa em leitura), **Minha equipe** (supervisor: metas por colaborador, definidas pelo campo Supervisor do cadastro) e **Meu perfil** (só foto e nome de exibição).
- Exige as funções publicadas: sem elas a entrada do portal não abre. Veja DEPLOY.md.

### 1. Importar dados
- Vá em **Upload** e arraste os arquivos CSV:
  - `Saída_de_Mercadoria_*.csv` → campo de Peças
  - `Ordem_de_Serviço_*.csv` → campo de Oficina

### 2. Dashboard
- Filtros independentes por **mês**, **estado** e **lojas** (multi-seleção)
- KPIs de realizado, projeção e metas por canal
- Rankings de Peças e Oficina com % de atingimento

### 3. Comissões
- Comissão calculada automaticamente pelos percentuais de cargo/estado
- Campo de **bonificação manual** por colaborador e mês
- Histórico mês a mês com meta × realizado

### 4. Colaboradores
- Adicione novos colaboradores com formulário inline
- Edite metas individualmente por mês
- Copie metas de um mês para outro e ajuste as diferenças
- Apelidos vinculam vendas de técnicos/mecânicos ao nome oficial

### 5. Inconsistências
- Tipos de movimento ou O.S. não reconhecidos aparecem aqui
- Cada tipo novo é registrado apenas uma vez (sem duplicação)

## Formato dos arquivos CSV

- Separador: **ponto-e-vírgula** (`;`)
- Campos entre **aspas duplas** (`"valor"`)
- Encoding: **UTF-8** (com ou sem BOM)

## Adicionando novos tipos de movimento

Edite `src/data/regras.js` nas constantes `REGRA_PECAS` ou `REGRA_OFICINA`:

```js
"NOVO TIPO DE MOVIMENTO": { cat: "CATEGORIA", meta: true, com: true },
```

## Deploy no Firebase

Consulte [DEPLOY.md](DEPLOY.md). A publicação exige Functions, regras e Hosting, nessa ordem; enviar apenas a pasta dist não atualiza as regras nem as funções.
