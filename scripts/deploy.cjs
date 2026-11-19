const { spawnSync } = require('node:child_process')
const path = require('node:path')
const root = path.join(__dirname, '..'), npm = process.env.npm_execpath, ts = String(Date.now())
if (!npm) throw Error('Execute npm run deploy com Node 24.15+ e npm 12.2+.')
function run(args, cwd = root, env = process.env) {
 const result = spawnSync(process.execPath, [npm, ...args], { cwd, env, stdio: 'inherit', shell: false })
 if (result.error || result.status !== 0) process.exit(result.status || 1)
}
run(['run', 'security:scan'])
run(['test'])
run(['audit', '--audit-level=low'])
run(['audit', '--audit-level=low'], path.join(root, 'functions'))
run(['run', 'test:rules'])
run(['run', 'build'], root, { ...process.env, VITE_BUILD_TS: ts, NODE_ENV: 'production' })
const firebase = ['exec', '--yes', '--package=firebase-tools@15.34.0', '--', 'firebase']
// Publish gateways before activating restrictive client rules.
const core = ['processarCSV','gerenciarUsuario','criarLinkBI','gerenciarLinkBI','portalBI','portalSnapshot','solicitarAcesso','verificarTurnstile','lerDadosAutorizados','gestaoEquipe','npsPesquisa','npsPainel']
run([...firebase, 'deploy', '--project', 'posvenda-bi', '--only', core.map(name => 'functions:' + name).join(',')])
run([...firebase, 'deploy', '--project', 'posvenda-bi', '--only', 'hosting,firestore:rules,storage'])
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
 const result = spawnSync(process.execPath, [path.join(__dirname, 'pos-deploy.cjs'), ts], { cwd: root, stdio: 'inherit', shell: false })
 if (result.status !== 0) { console.error('Publicado; aviso de versão falhou. Reexecute pos-deploy com timestamp ' + ts); process.exit(1) }
} else console.warn('Publicado. Aviso opcional: configure ADC e execute node scripts/pos-deploy.cjs ' + ts)
