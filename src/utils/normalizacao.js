/**
 * Normaliza string: remove BOM, acento, espaços duplos, caixa alta
 * Usada para comparação fuzzy de nomes e apelidos
 */
export function norm(s) {
  if (!s) return ''
  return s
    .replace(/^\uFEFF/, '')         // BOM
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .toUpperCase()
    .replace(/\s+/g, ' ')           // colapsa espaços
    .replace(/[\[\]]/g, '')          // remove colchetes (apelidos)
    .trim()
}

/**
 * Constrói o mapa apelido normalizado → nome oficial
 * a partir das metas mensais
 */
export function buildApelidoMap(metasPorMes) {
  const map = {}
  // Processa do mais antigo ao mais recente — mês mais recente vence conflitos
  const meses = Object.keys(metasPorMes).sort((a, b) => {
    const [ma, aa] = a.split('/').map(Number)
    const [mb, ab] = b.split('/').map(Number)
    return aa !== ab ? aa - ab : ma - mb
  })
  meses.forEach(mes => {
    Object.values(metasPorMes[mes]).forEach(d => {
      const nNorm = norm(d.colaborador)
      map[nNorm] = d.colaborador
      if (d.apelido) {
        const apNorm = norm(d.apelido)
        if (apNorm) map[apNorm] = d.colaborador
      }
    })
  })
  return map
}

/**
 * Resolve um nome vindo do CSV para o nome oficial do colaborador
 * Tenta match exato normalizado, depois match parcial
 */
export function resolveNome(raw, apelidoMap) {
  if (!raw || !raw.trim()) return null
  const k = norm(raw)
  if (apelidoMap[k]) return apelidoMap[k]
  return raw.trim()
}

/**
 * FONTE ÚNICA — separa o campo .supervisor (string "Fulano;Beltrano", um
 * colaborador pode ter mais de um) num array de nomes limpos. Nunca comparar
 * ou listar esse campo como string bruta — reaproveitar sempre esta função
 * (já foi reescrita à mão, errado, em 3+ arquivos diferentes — normalizar
 * aqui é o que evita a próxima cópia com bug).
 *
 * @param {string} supervisorField — valor bruto de c.supervisor
 * @returns {string[]} nomes individuais, aparados, sem vazios
 */
export function listaSupervisores(supervisorField) {
  return (supervisorField || '').split(';').map(x => x.trim()).filter(Boolean)
}

/**
 * FONTE ÚNICA — nomes que podem ser escolhidos como Supervisor de outro
 * colaborador: quem tem "supervisor" no cargo (entra sozinho, sem precisar
 * ser escolhido por alguém antes) + quem já foi referenciado no campo
 * .supervisor de alguém (cobre supervisores legados com cargo diferente).
 * Usado em Colaboradores, Metas e Comissões — não duplicar essa lógica
 * numa página nova, importar daqui.
 *
 * @param {object[]} colaboradores — lista achatada de registros de colaborador
 *   (cada um com .cargo, .colaborador, .supervisor)
 * @returns {Set<string>} nomes qualificados
 */
export function supervisoresDisponiveis(colaboradores) {
  const s = new Set()
  colaboradores.forEach(c => {
    if (norm(c.cargo || '').includes('SUPERVISOR')) s.add(c.colaborador)
    listaSupervisores(c.supervisor).forEach(x => s.add(x))
  })
  return s
}
