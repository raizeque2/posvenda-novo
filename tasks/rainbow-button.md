# Rainbow Button

O projeto usa React/Vite, componentes JSX e TSX e o alias `@` para `src`. Os componentes de interface já ficam em `src/components/ui`; o CSS global é `src/index.css`, com temas em `src/theme/appearance.css`. Essa pasta de componentes concentra os controles reutilizáveis; não é necessário criar outra pasta `/components/ui` fora de `src`.

O botão está em `src/components/ui/rainbow-button.tsx`, com a receita de gradiente, brilho, variáveis e animação do componente fornecido convertida em CSS em `rainbow-button.css`. O site usa CSS comum, sem Tailwind configurado. A adaptação acompanha os componentes existentes, sem adicionar dependências nem o reset global do Tailwind. Vite compila TSX; isso não equivale a uma verificação completa de tipos com TypeScript.

Aplicado em confirmações gerais, revisão das alterações da IA, salvar BI e Novidades. Novidades usa `animated={false}` após visto. Foco por teclado, propriedades nativas, referência do botão, estado desabilitado e preferência de movimento reduzido são preservados.

## Se migrar o projeto inteiro para Tailwind/shadcn

Esta migração não é necessária para o botão integrado. Para configurar a stack completa posteriormente:

1. Instalar `typescript`, `@types/react` e `@types/react-dom` como dependências de desenvolvimento. Criar `tsconfig.json` para React/Vite com `jsx: react-jsx`, resolução `Bundler`, `allowJs: true`, `noEmit: true` e alias `@/*` para `src/*`. Usar `tsc --noEmit` para checar os arquivos TS/TSX; migrar JSX gradualmente.
2. Instalar `tailwindcss` e `@tailwindcss/vite`, adicionar `tailwindcss()` aos plugins de `vite.config.js` e importar `@import "tailwindcss";` no CSS principal. Revisar primeiro o efeito do Preflight nas tabelas, botões e temas existentes.
3. Executar `npx shadcn@latest init` no projeto existente. Configurar `components.json` para `src/index.css`, `@/components`, `@/components/ui` e um utilitário `cn` compartilhado. Revisar o diff antes de aceitar alterações nos estilos globais.
4. Tailwind atual usa configuração em CSS; o trecho `tailwind.config.js` enviado corresponde ao fluxo anterior. As variáveis e keyframes do rainbow já estão no CSS do componente.

Fontes: [shadcn com Vite](https://ui.shadcn.com/docs/installation/vite), [Tailwind com Vite](https://tailwindcss.com/docs/installation/using-vite).
