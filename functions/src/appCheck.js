// App Check nas funções chamáveis. Precisa ser o PRIMEIRO import de index.js:
// onCall lê as opções globais no momento em que cada função é definida.
//
// Desligado por padrão para não derrubar quem ainda usa uma versão do site sem
// App Check. Para ligar, depois de publicar o site com VITE_APPCHECK_SITE_KEY e
// conferir as métricas de App Check no console, grave em functions/.env.posvenda-bi:
//   APPCHECK_ENFORCE=true
// e publique as funções de novo. Pedidos sem token válido passam a receber 401.
import { setGlobalOptions } from 'firebase-functions/v2'

export const APP_CHECK_OBRIGATORIO = process.env.APPCHECK_ENFORCE === 'true'
setGlobalOptions({ enforceAppCheck: APP_CHECK_OBRIGATORIO })
