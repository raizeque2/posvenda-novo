const fs = require('fs');
const path = require('path');
const esbuild = require('./node_modules/esbuild');

const srcDir = '../crm-source-extracted/alagoas-motos';
const dstDir = './src/crm';

const mapping = [
  ['lib/constants.ts', 'constants.js'],
  ['lib/types.ts', 'types.js'],
  ['lib/tsi-resend.ts', 'tsi-resend.js'],
  ['components/ui/shiny-button.tsx', 'ui/shiny-button.jsx'],
  ['components/ui/status-badge.tsx', 'ui/status-badge.jsx'],
  ['components/ui/circular-progress.tsx', 'ui/circular-progress.jsx'],
  ['components/ui/funnel-chart.tsx', 'ui/funnel-chart.jsx'],
  ['components/views/fieis-view.tsx', 'views/fieis-view.jsx'],
  ['components/views/leads-view.tsx', 'views/leads-view.jsx'],
  ['components/views/dash-view.tsx', 'views/dash-view.jsx'],
  ['components/views/report-view.tsx', 'views/report-view.jsx'],
  ['components/views/tsi-view.tsx', 'views/tsi-view.jsx'],
  ['components/views/tsi-list-view.tsx', 'views/tsi-list-view.jsx'],
  ['components/views/tsi-detail-view.tsx', 'views/tsi-detail-view.jsx'],
  ['components/views/tsi-resend-view.tsx', 'views/tsi-resend-view.jsx'],
  ['components/lead-modal.tsx', 'lead-modal.jsx'],
];

for (const [srcRel, dstRel] of mapping) {
  const srcPath = path.join(srcDir, srcRel);
  const dstPath = path.join(dstDir, dstRel);
  if (!fs.existsSync(srcPath)) continue;

  let raw = fs.readFileSync(srcPath, 'utf-8');
  // Strip Next.js 'use client'
  raw = raw.replace(/^['"]use client['"];?\r?\n/m, '');

  // Esbuild transform TS/TSX directly to JS/JSX
  const transformed = esbuild.transformSync(raw, {
    loader: srcRel.endsWith('.tsx') ? 'tsx' : 'ts',
    jsx: 'preserve',
  }).code;

  let code = transformed;

  // Now fix imports in the cleanly transformed code:
  code = code.replace(/from\s+['"]@\/lib\/constants['"]/g, 'from "../constants.js"');
  code = code.replace(/from\s+['"]@\/lib\/types['"]/g, 'from "../types.js"');
  code = code.replace(/from\s+['"]@\/lib\/tsi-resend['"]/g, 'from "../tsi-resend.js"');
  code = code.replace(/from\s+['"]@\/lib\/utils['"]/g, 'from "../ui/utils.js"');

  code = code.replace(/from\s+['"]@\/components\/ui\/shiny-button['"]/g, 'from "../ui/shiny-button.jsx"');
  code = code.replace(/from\s+['"]@\/components\/ui\/status-badge['"]/g, 'from "../ui/status-badge.jsx"');
  code = code.replace(/from\s+['"]@\/components\/ui\/circular-progress['"]/g, 'from "../ui/circular-progress.jsx"');
  code = code.replace(/from\s+['"]@\/components\/ui\/funnel-chart['"]/g, 'from "../ui/funnel-chart.jsx"');
  code = code.replace(/from\s+['"]@\/components\/toast['"]/g, 'from "../ui/toast-adapter.jsx"');
  code = code.replace(/from\s+['"]@\/components\/lead-modal['"]/g, 'from "../lead-modal.jsx"');

  // Fix relative imports in ui/
  if (dstRel.startsWith('ui/')) {
    code = code.replace(/from\s+['"]\.\.\/ui\/utils\.js['"]/g, 'from "./utils.js"');
  }

  // Fix relative imports in root of crm/
  if (!dstRel.includes('/')) {
    code = code.replace(/from\s+['"]\.\.\/constants\.js['"]/g, 'from "./constants.js"');
    code = code.replace(/from\s+['"]\.\.\/types\.js['"]/g, 'from "./types.js"');
    code = code.replace(/from\s+['"]\.\.\/tsi-resend\.js['"]/g, 'from "./tsi-resend.js"');
    code = code.replace(/from\s+['"]\.\.\/ui\//g, 'from "./ui/');
  }

  fs.writeFileSync(dstPath, code, 'utf-8');
  console.log('Successfully compiled & mapped:', dstRel);
}
