const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f\[\]]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
export function dataScope(profile, collaborators, stores, month) {
  const states = profile.estados?.length ? profile.estados : profile.estado ? [profile.estado] : null
  const people = new Set(), ownStores = new Set(), meuNome = key(profile.nome)
  for (const records of Object.values(month ? { [month]: collaborators[month] || {} } : collaborators)) for (const [name, person] of Object.entries(records || {})) {
    if (states && !states.includes(stores[person.loja]?.uf)) continue
    // Sem nome no perfil, ninguém é 'próprio' (antes um nome vazio casava com registros sem nome).
    const own = !!meuNome && (key(name) === meuNome || key(person.colaborador) === meuNome)
    if (profile.role === 'operacional' && !own) continue
    if (profile.role === 'supervisor' && !own && !(meuNome && String(person.supervisor || '').split(';').some(value => key(value) === meuNome))) continue
    for (const value of [name, person.colaborador, person.apelido]) if (value) people.add(key(value))
    if (person.loja) ownStores.add(person.loja)
  }
  const nameAllowed = name => people.has(key(name))
  const storeAllowed = store => (!states || states.includes(stores[store]?.uf)) && (!['operacional', 'supervisor'].includes(profile.role) || ownStores.has(store))
  const monthly = new Map()
  const forMonth = value => {
    if (!monthly.has(value)) monthly.set(value, dataScope(profile, collaborators, stores, value))
    return monthly.get(value)
  }
  const rowAllowed = row => {
    if (!month && row.mes) return forMonth(row.mes).rowAllowed(row)
    return storeAllowed(row.empresa || row.loja) && (['admin', 'coordenador'].includes(profile.role) || [row.responsavel, row.consultor, row.tecnico].some(nameAllowed))
  }
  const namedConfig = value => Object.fromEntries(Object.entries(value || {}).map(([month, records]) => [month, Object.fromEntries(Object.entries(records || {}).filter(([name, person]) => dataScope(profile, collaborators, stores, month).nameAllowed(person?.colaborador || name)))]))
  return { nameAllowed, storeAllowed, rowAllowed, namedConfig }
}
