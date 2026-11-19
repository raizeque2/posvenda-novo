# Revisão do assistente — 09/10/2026

Nenhuma dependência nova foi adicionada. As 30 sinalizações do relatório de dependências de 08/10 continuam pendentes; não houve atualização automática de versões nem novo resultado de audit que permita declarar o projeto livre de vulnerabilidades.

O novo servidor de IA consulta o perfil autenticado no Firestore e aceita somente administrador ativo. Aplica o recorte de estados, limita 3 consultas/minuto e 40/dia, exige consentimento explícito, usa destinos fixos dos provedores e mantém segredos nas Cloud Functions. O navegador não recebe chaves. O contexto contém agregados mensais de pessoas, setores e metas; não envia CSV bruto, e-mails, credenciais ou tokens. A integração real deve ser habilitada pelo proprietário após configurar o provedor.

O modelo não executa escrita. Alterações passam por proposta revisável e uma função separada que revalida perfil/UF, cadastro ativo, mês atual, setor/campo, faixa de valor e valor anterior dentro da transação. Auditoria e meta são gravadas juntas. As regras atuais negam acesso de clientes a assistantAudit e assistantLimits, sem novas permissões públicas. Respostas são texto React, sem HTML arbitrário.

Verificações locais: testes das políticas, isolamento e conflitos; revisão dos caminhos de chamada e importação dos quatro exports das funções. Não foram realizados chamadas a provedores, deploy, testes de integração com Firestore real ou ensaio do OAuth. A configuração de funções declara Node 20; a importação local usou Node 24. A prévia permanece isolada com dados fictícios.

A ligação por conta ChatGPT/Codex não foi simulada: requer registro e elegibilidade oficiais. A versão entregue oferece demonstração local e código de conexão por API no servidor, com instruções em ASSISTENTE-IA.md.
