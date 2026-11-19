import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const failure = () => Error('Não foi possível abrir ou salvar o cofre de chaves deste Windows. Nenhuma chave foi substituída.')
const project = createHash('sha256').update(fileURLToPath(new URL('../', import.meta.url))).digest('hex').slice(0, 16)

// DPAPI CurrentUser binds encryption to this Windows account. Secrets travel
// through stdin, never command arguments, browser storage or application logs.
function protect(value, decrypt = false) {
  if (process.platform !== 'win32') return Promise.reject(failure())
  const method = decrypt ? 'Unprotect' : 'Protect'
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::${method}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
    let output = '', overflow = false
    const timer = setTimeout(() => { child.kill(); reject(failure()) }, 15000)
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 200000) { overflow = true; child.kill() } })
    child.on('error', () => { clearTimeout(timer); reject(failure()) })
    child.on('close', code => { clearTimeout(timer); code || overflow ? reject(failure()) : resolve(Buffer.from(output, 'base64')) })
    child.stdin.on('error', () => {})
    child.stdin.end(Buffer.from(value).toString('base64'))
  })
}

function cleanName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60 || /[\x00-\x1f\x7f]/.test(value)) throw Error('Informe um nome de até 60 caracteres para a chave.')
  return value.trim()
}
const metadata = ({ id, name }) => ({ id, name })

export function createCredentialVault({ directory = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'PosVenda', 'credentials', project) } = {}) {
  let queue = Promise.resolve()
  function transact(owner, update) {
    const task = queue.then(async () => {
      if (!/^[a-f0-9]{64}$/.test(owner)) throw failure()
      const path = join(directory, `${owner}.dpapi`)
      let entries = []
      try {
        const ciphertext = await readFile(path)
        if (ciphertext.length > 100000) throw failure()
        entries = JSON.parse((await protect(ciphertext, true)).toString('utf8'))
        if (!Array.isArray(entries) || entries.length > 20 || entries.some(entry => !/^[a-f0-9]{32}$/.test(entry.id) || typeof entry.key !== 'string' || typeof entry.name !== 'string')) throw failure()
      } catch (error) { if (error.code !== 'ENOENT') throw failure() }
      const result = update(entries)
      if (result.write) {
        const ciphertext = await protect(JSON.stringify(entries)), temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`
        try { await mkdir(directory, { recursive: true }); await writeFile(temporary, ciphertext, { mode: 0o600, flag: 'wx' }); await rename(temporary, path) }
        catch { throw failure() }
        finally { await unlink(temporary).catch(() => {}) }
      }
      return result.value
    })
    queue = task.catch(() => {})
    return task
  }
  function find(entries, id) {
    const entry = entries.find(item => item.id === id)
    if (!entry) throw Error('Chave salva não encontrada neste navegador.')
    return entry
  }
  function unique(entries, name, id) {
    if (entries.some(entry => entry.id !== id && entry.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw Error('Já existe uma chave com esse nome. Escolha outro nome.')
  }
  return {
    list: owner => transact(owner, entries => ({ value: entries.map(metadata) })),
    get: (owner, id) => transact(owner, entries => ({ value: find(entries, id).key })),
    add: (owner, name, key) => transact(owner, entries => {
      name = cleanName(name); unique(entries, name)
      if (entries.length >= 20) throw Error('Limite de 20 chaves salvas. Exclua uma antes de adicionar outra.')
      if (typeof key !== 'string' || key.length < 20 || key.length > 256 || /\s/.test(key)) throw Error('Chave inválida.')
      const entry = { id: randomBytes(16).toString('hex'), name, key }; entries.push(entry)
      return { write: true, value: metadata(entry) }
    }),
    rename: (owner, id, name) => transact(owner, entries => { const entry = find(entries, id); name = cleanName(name); unique(entries, name, id); entry.name = name; return { write: true } }),
    remove: (owner, id) => transact(owner, entries => { const entry = find(entries, id); entries.splice(entries.indexOf(entry), 1); return { write: true } }),
  }
}
