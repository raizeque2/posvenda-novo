# Revisão de dependências — 08/10/2026

Foi executado `npm audit --json` no projeto, sem instalação automática de correções. O relatório está em `security-reports/npm-audit-2026-10-08.json`.

Resultado: 30 pacotes sinalizados (2 baixos, 15 moderados, 12 altos e 1 crítico). A classificação descreve avisos de dependências; não prova exploração na aplicação. O aviso crítico envolve `websocket-driver@0.7.4`. Há também alertas nas cadeias Firebase Admin/Google Cloud, Vite, React Router e ferramentas de compilação.

As versões de todos os nós sinalizados foram comparadas com o `package-lock.json` do commit anterior `a7ae03f`: são as mesmas. As novas dependências diretas `@radix-ui/react-dialog` e `react-is` não foram sinalizadas pelo relatório. Os dois arquivos de lock foram sincronizados.

Pendência: atualizar e validar as dependências existentes, começando pelo aviso crítico e pelas dependências usadas em produção. Algumas correções sugeridas exigem mudança de versão principal do Vite e do plugin legacy; por isso não foi aplicado `audit fix --force` dentro de uma alteração de interface. O aplicativo não deve ser apresentado como livre de vulnerabilidades.

Esta atualização não altera autenticação, regras de acesso, comissões nem envio de dados. A prévia continua isolada do Firebase real, com dados fictícios e login demonstrativo. A importação opcional de GeoJSON mantém a validação e o limite de tamanho existentes. Os mapas incluídos são dados estáticos do IBGE servidos localmente.
