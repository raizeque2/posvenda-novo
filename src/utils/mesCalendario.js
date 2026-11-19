// Helpers de calendário compartilhados entre cloudStorage.js (Estoque) e
// configSlice.js (Regras, Colaboradores/Metas) — fonte única dentro do app
// para "que mês é hoje" e comparação de meses. Antes desta extração, essa
// mesma lógica estava copiada em cada arquivo separadamente.
//
// A Cloud Function (functions/index.js) e o robô (posvenda-rpa/src/uploader.js)
// mantêm cópias próprias e deliberadas — são pacotes Node separados, sem
// como importar arquivo do app sem uma estrutura de monorepo. Se mudar a
// lógica aqui, replicar manualmente lá também.

// 'MM/YYYY' a partir de um Date
export function mesDe(data) {
  return `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`
}

// Mês seguinte a 'MM/YYYY', também em 'MM/YYYY'
export function proximoMes(mesAno) {
  const [m, a] = mesAno.split('/').map(Number)
  return mesDe(new Date(a, m, 1))
}

// Compara dois 'MM/YYYY': negativo se a < b, positivo se a > b, 0 se igual
export function cmpMes(a, b) {
  const [ma, aa] = a.split('/').map(Number)
  const [mb, ab] = b.split('/').map(Number)
  return aa !== ab ? aa - ab : ma - mb
}

// Mês corrente de verdade, pelo relógio local — nunca derivado de dado
// armazenado (é a base do fechamento por calendário, Fase 1).
export function mesCalendarioAtual() {
  return mesDe(new Date())
}
