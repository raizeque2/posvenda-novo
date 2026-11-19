# Alterações revisadas no assistente — 20/10/2026

- Administrador ativo solicita no chat uma bonificação, meta, taxa de comissão/bonificação automática ou acréscimo manual de comissão.
- A resposta mostra um cartão com pessoa, mês atual, loja/setor, campo, antes/depois e alcance individual. Confirmar e cancelar são ações explícitas; texto do modelo não confirma.
- Preparar grava somente uma intenção privada com autor e validade de 10 minutos. Confirmar envia apenas ID e autorização explícita; servidor relê dados e permissões, compara versão e grava alteração/auditoria atomicamente. Repetição é idempotente.
- Pedidos ambíguos solicitam esclarecimento. Sem alterações de meses fechados, papéis de acesso, credenciais ou execução arbitrária.
- A prévia usa o mesmo validador e repositório fictício, sem alterar Firebase real.
- Todos os provedores usam o mesmo serviço; modelo pode propor uma operação JSON limitada. Operação só se torna executável depois de validada contra os dados atuais.
- Rainbow Button adaptado ao CSS existente em src/components/ui: confirmar alterações, confirmação global, salvar BI e Novidades não vistas. Tema e redução de movimento respeitados.
- Verificar cancelamento, concorrência, replay, usuário diferente, expiração, tipos/valores inválidos, cálculo refletido no BI e navegação real.
