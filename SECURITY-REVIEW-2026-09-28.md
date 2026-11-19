# Revisão de segurança — 28/09/2026

O plano de [Ray0907/security-scan](https://github.com/Ray0907/security-scan) foi executado sem modificar o projeto. O resultado normalizado está em `security-reports/security-findings.json`. A saída vazia de `findings` **não significa ausência de vulnerabilidades**: o planejador considerou inconclusiva a raiz com `package-lock.json` e `pnpm-lock.yaml` simultâneos; `gitleaks`, `osv-scanner` e `semgrep` não estavam disponíveis.

O audit nativo de `pnpm-lock.yaml` está em `security-reports/pnpm-audit.json`: **1 alerta alto e 6 moderados**, nenhum crítico. Foram apontados:

| Pacote | Severidade | Aviso |
| --- | --- | --- |
| Vite | Alta | [Bypass de `server.fs.deny` no Windows](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) |
| Vite | Moderada | [Path traversal em mapas de dependências otimizadas](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) |
| Vite | Moderada | [Exposição de hash NTLMv2 no `launch-editor` do Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) |
| esbuild | Moderada | [Leitura de respostas do servidor de desenvolvimento](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| uuid | Moderada | [Verificação de limites ausente com buffer fornecido](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |
| react-router | Moderada | [Redirecionamento aberto com barra invertida](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) |
| react-router | Moderada | [Injeção no `deserializeErrors()` durante hidratação SSR](https://github.com/advisories/GHSA-337j-9hxr-rhxg) |

O servidor local da prévia deve permanecer vinculado a `127.0.0.1`. Os links pessoais da tela Acessos contêm tokens; a mensagem em lote só deve ser compartilhada com quem distribui os links individualmente. A prévia fictícia bloqueia sua geração. O serviço conectado de criação permanece restrito a administradores e armazena somente o hash do token, conforme os testes do projeto.

Não houve atualização de dependências nesta etapa. Antes de disponibilizar o projeto em rede ou publicar uma nova versão, atualizar os pacotes afetados com revisão de compatibilidade e repetir o audit, inclusive no pacote `functions`. A análise de código e de segredos por `semgrep` e `gitleaks` também segue pendente de ferramentas disponíveis.
