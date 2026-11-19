# Regras individuais de gestão — 21/10/2026

- Entrada em Comissões → Gestão → Editar metas e indicadores, disponível ao administrador.
- Configuração por gestor e mês: canais/base, metas específicas (vazio herda equipe, zero sem meta), percentuais de remuneração e indicadores automáticos, valores medidos ou sim/não.
- Condição opcional para bônus: faturamento real da base / meta da base ≥ mínimo configurado. Sem meta não libera. Bloqueia bonificação, bônus próprios, indicadores e extra; preserva comissão e valor extra informado. Não utiliza projeção.
- Rascunho → revisão → confirmação rainbow → gravação em transação. Detecta regra alterada por outra sessão e preserva outros gestores/meses. Falha mantém o editor aberto com erro; não anuncia sucesso.
- Persiste no documento existente config/regras; proteção de administrador permanece nas regras do Firestore. Prévia usa transação local do adaptador existente.
- Não ativa o exemplo de 95% automaticamente para todos; o administrador escolhe a condição de cada pessoa.
- Verificação visual indisponível por bloqueio anterior da ferramenta de navegador. Verificar cálculos automatizados e compilações antes da entrega.

Validação: 9 testes específicos passaram. Suíte geral: 121/123 na primeira execução; os dois testes do cofre Windows que falharam passaram na repetição isolada (6/6 testes de cofre/Gemini), sem alterar código ou limites de segurança. Builds de produção e prévia passaram. Nenhum deploy ou alteração automática nas regras existentes.
