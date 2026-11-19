# Importação de folha e metas — 21/10/2026

Entrada: Upload → CSV — Folha do Pessoal. Modelo público em `/modelos/folha-pessoal.csv`.

- Arquivo CSV até 5 MB e 10.000 pessoas; separador ponto-e-vírgula ou vírgula; leitura UTF-8 ou Windows-1252. Nome obrigatório, competência opcional MM/AAAA. Uma competência por arquivo; o mês de aplicação é revisado no diálogo.
- Cadastro e salário: nome, loja, cargo, setor/cargo_movimento, centro_custo, salario_base, supervisor, apelido e ativo.
- Metas: meta_varejo, meta_atacado, meta_web, meta_televendas, meta_mo, meta_pecas_os. Meta_pecas/mp exige um único canal de peças definido. Valores monetários BR ou decimais simples. Vazio preserva; zero explícito zera. Metas multicanais ambíguas não são distribuídas automaticamente.
- Revisão por pessoa: antes/depois, identificação de novos funcionários e seleção de loja. Nomes normalizados evitam duplicatas por acento/caixa. Pessoas fora da folha, vendas, regras de comissão, bônus e outros meses são preservados.
- Confirmação rainbow. Administrador obrigatório. Transação grava cadastro e metas juntos, verifica alterações concorrentes e só atualiza o estado após sucesso. Falha mantém revisão e erro. Não usa a antiga substituição integral de cadastro.
- Ao concluir, seleciona o mês importado e oferece links para Colaboradores, Metas e Comissões. Prévia salva apenas no navegador; modo conectado salva no Firebase existente.

Validação: 37 testes relacionados passaram, incluindo modelo real fornecido, cálculo de metas no ranking, preservação de campos omitidos, zero explícito, cadastros legados, permissão, concorrência e falha sem gravação parcial. Inspeção visual não realizada devido ao bloqueio anterior da ferramenta de navegador. Nenhum arquivo pessoal do usuário importado automaticamente e nenhum deploy.
