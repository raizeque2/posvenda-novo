export function snapshotAchievement(real, target) {
  return Number.isFinite(Number(real)) && Number.isFinite(Number(target)) && Number(target) > 0 ? Number(real) / Number(target) : null
}
export function snapshotPeople(rows, search) {
  const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  return rows.filter(row => key(row.nome).includes(key(search)))
}
