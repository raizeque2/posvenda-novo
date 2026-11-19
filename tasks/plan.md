# Melhorias do assistente e revisão do portal pessoal — 15/10/2026

Pedido autorizado: revisar a experiência do funcionário por link e implementar as melhorias propostas na conversa. Destino oficial informado: https://posvenda-bi.web.app/; projeto local confirmado em `.firebaserc`: posvenda-bi. Publicação e ativação de segredos dependem de acesso do proprietário; não publicar a prévia com dados fictícios.

## Módulos e ordem

| Módulo | Entrega verificável | Depende de |
|---|---|---|
| portal-pessoal | Conferir acesso isolado, mês, metas, perfil e experiência móvel; demonstração fictícia e correções encontradas | — |
| consulta-analitica | Resolver período, comparativos e filtros explícitos/da página com validação no servidor | — |
| continuidade | Histórico recente limitado e continuidade do recorte por conversa; edição/reenvio não envia mensagens posteriores | consulta-analitica |
| procedencia | Mostrar fontes, períodos, recorte e última carga; consulta dos agregados usados nos gráficos | consulta-analitica |
| recuperacao | Erros distinguíveis, espera/reconexão e tentativas manuais; sem fallback pago ou reenvio automático | — |
| conexoes-firebase | Chaves pessoais nomeadas em cofre criptografado no servidor, por administrador; preservar modo Windows | recuperacao |
| validacao | Testes, builds e navegador; uma consulta real no Gemini somente com conexão autorizada disponível | demais |

## Contrato

- O link pessoal segue sendo um acesso de posse revogável: só retorna dados do titular, sem clientes/contatos ou resultados de terceiros. Não criar nem revogar links reais durante a revisão.
- Consultas externas seguem restritas ao administrador ativo e aos seus estados permitidos; filtros enviados pelo navegador nunca ampliam a autorização.
- Histórico: só mensagens de texto recentes, com papéis permitidos e orçamento de caracteres; nenhuma instrução de sistema enviada pelo cliente, pensamento interno ou segredo de conexão. Os fatos da análise são recalculados da base autorizada.
- Períodos limitados por consulta e validados contra o índice de meses carregados. Ausência de base não vira zero inventado. Metas não são redistribuídas para filtros sem alocação oficial.
- Credenciais: criptografia autenticada no servidor, chave mestra no Secret Manager; documentos não acessíveis pelo cliente, nunca retornar API key. Não migrar automaticamente segredos do computador para Firebase.
- UI preserva tokens e componentes atuais; não instalar nova biblioteca para gráficos ou chat.
- Alterações de metas continuam exclusivamente no fluxo revisável existente.

## Verificação

`npm test`, `npm run build`, `npm run build:preview`; testes de isolamento por pessoa/UF, datas, filtros, continuação, edição, criptografia, erros e cotas. Verificar a tela pessoal e o chat em desktop/mobile, temas e console. Registrar separadamente testes com provedor simulado e chamada real. Sem Firebase CLI/login ou segredo configurado, entregar código/documentação e informar precisamente o que falta para ativar no domínio oficial.
