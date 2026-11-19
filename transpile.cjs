const fs = require('fs');
const path = require('path');
const esbuild = require('./node_modules/esbuild');

const dir = './src/crm';
function scan(d) {
  for (const item of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, item.name);
    if (item.isDirectory()) {
      scan(p);
    } else if (p.endsWith('.js') || p.endsWith('.jsx')) {
      const code = fs.readFileSync(p, 'utf-8');
      try {
        const res = esbuild.transformSync(code, { loader: 'tsx', jsx: 'preserve' });
        fs.writeFileSync(p, res.code, 'utf-8');
        console.log('Transpiled:', p);
      } catch (err) {
        console.error('Error in:', p, err.message);
      }
    }
  }
}
scan(dir);
