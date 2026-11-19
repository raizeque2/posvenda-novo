import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const root = process.cwd(), findings = []
const excluded = new Set(['.git', 'node_modules', 'dist', 'dist-preview', 'backups', '.claude', '.openai', 'release', 'security-reports', '_backup_pre_dash_redesign'])
const publicFirebaseKeys = new Set((fs.readFileSync('src/firebase.js', 'utf8').match(/AIza[\w-]{30,}/g) || []))
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['service-account', /"private_key"\s*:\s*"[^"\r\n]{20,}/g],
  ['provider-key', /\b(?:sk-ant-[A-Za-z0-9_-]{30,}|sk-proj-[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{30,}|AQ\.[A-Za-z0-9_-]{35,})/g],
  ['google-key', /AIza[\w-]{30,}/g],
]
function inspect(text, file) {
  for (const [type, pattern] of patterns) for (const match of text.matchAll(pattern)) {
    if (type === 'google-key' && publicFirebaseKeys.has(match[0])) continue
    findings.push({ file, type, line: text.slice(0, match.index).split('\n').length })
  }
}
let count = 0
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.name.endsWith('.log')) continue
    const file = path.join(directory, item.name)
    if (item.isSymbolicLink()) throw Error('Link simbólico precisa de revisão: ' + path.relative(root, file))
    if (item.isDirectory()) walk(file)
    else if (/\.(?:[cm]?js|jsx|tsx?|json|html|md|yml|yaml|rules|toml)$/.test(item.name) || item.name.startsWith('.env')) {
      count++; inspect(fs.readFileSync(file, 'utf8'), path.relative(root, file))
    }
  }
}
walk(root)
let history = 'not-present'
if (fs.existsSync('.git')) {
  try {
    const log = execFileSync('git', ['log', '--all', '-p', '--format=commit:%h', '--', '.', ':!package-lock.json', ':!functions/package-lock.json', ':!pnpm-lock.yaml'], { encoding: 'utf8', maxBuffer: 150000000 })
    inspect(log, 'git-history'); history = 'scanned'
  } catch { history = 'unavailable'; process.exitCode = 1 }
}
const report = { filesScanned: count, history, firebaseWebConfiguration: 'public identifiers, not server credentials', findings }
console.log(JSON.stringify(report, null, 2))
if (findings.length) process.exitCode = 1
