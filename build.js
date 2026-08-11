const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Build main plugin code (runs in Figma sandbox)
const buildCode = () => {
  return esbuild.build({
    entryPoints: ['src/code.ts'],
    bundle: true,
    outfile: 'dist/code.js',
    target: 'es2017',
    platform: 'node',
    tsconfig: 'tsconfig.json',
    logLevel: 'info',
  });
};

// Build UI (runs in iframe)
const buildUI = () => {
  return esbuild.build({
    entryPoints: ['src/ui.tsx'],
    bundle: true,
    outfile: 'dist/ui.js',
    target: 'es2020',
    platform: 'browser',
    tsconfig: 'tsconfig.json',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    logLevel: 'info',
  });
};

const buildMatcher = () => {
  return esbuild.build({
    entryPoints: ['src/smartAnimateMatcher.ts'],
    bundle: true,
    outfile: 'dist/smartAnimateMatcher.js',
    target: 'es2017',
    platform: 'node',
    tsconfig: 'tsconfig.json',
    logLevel: 'info',
  });
};

const buildUIModel = () => {
  return esbuild.build({
    entryPoints: ['src/uiModel.ts'],
    bundle: true,
    outfile: 'dist/uiModel.js',
    target: 'es2017',
    platform: 'node',
    tsconfig: 'tsconfig.json',
    logLevel: 'info',
  });
};

const buildExportPreflight = () => {
  return esbuild.build({
    entryPoints: ['src/exportPreflight.ts'],
    bundle: true,
    outfile: 'dist/exportPreflight.js',
    target: 'es2017',
    platform: 'node',
    tsconfig: 'tsconfig.json',
    logLevel: 'info',
  });
};

const buildExportAnalytics = () => {
  return esbuild.build({
    entryPoints: ['src/exportAnalytics.ts'],
    bundle: true,
    outfile: 'dist/exportAnalytics.js',
    target: 'es2017',
    platform: 'node',
    tsconfig: 'tsconfig.json',
    logLevel: 'info',
  });
};

// Copy and inject UI HTML
const copyUI = () => {
  const html = fs.readFileSync('src/ui.html', 'utf8');
  const js = fs.readFileSync('dist/ui.js', 'utf8');
  const icon = fs.readFileSync('logo128x128.png').toString('base64');
  const iconDataUrl = `data:image/png;base64,${icon}`;
  const injected = html
    .replace('<!-- INJECT_JS -->', `<script>${js}</script>`)
    .split('__PROTOVID_ICON__')
    .join(iconDataUrl);
  fs.writeFileSync('dist/ui.html', injected);
};

const build = async () => {
  try {
    await buildCode();
    await buildUI();
    await buildMatcher();
    await buildUIModel();
    await buildExportPreflight();
    await buildExportAnalytics();
    copyUI();
    console.log('✅ Build complete');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
};

if (isWatch) {
  console.log('👀 Watching for changes...');
  const chokidar = require('chokidar');
  chokidar.watch('src/**/*').on('change', () => {
    console.log('🔄 Rebuilding...');
    build();
  });
}

build();
