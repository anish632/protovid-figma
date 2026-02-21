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
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    logLevel: 'info',
  });
};

// Copy and inject UI HTML
const copyUI = () => {
  const html = fs.readFileSync('src/ui.html', 'utf8');
  const js = fs.readFileSync('dist/ui.js', 'utf8');
  const injected = html.replace('<!-- INJECT_JS -->', `<script>${js}</script>`);
  fs.writeFileSync('dist/ui.html', injected);
};

const build = async () => {
  try {
    await buildCode();
    await buildUI();
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
