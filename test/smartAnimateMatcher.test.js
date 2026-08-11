const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildLayerKeys,
  matchSmartAnimateLayers,
} = require('../dist/smartAnimateMatcher.js');

function snapshot(id, name, type, pathSegments, bounds, extra = {}) {
  const keys = buildLayerKeys(pathSegments);
  return {
    id,
    name,
    type,
    keyExact: keys.exact,
    keyLoose: keys.loose,
    keyLeaf: keys.leaf,
    keyParentExact: keys.parentExact,
    keyParentLoose: keys.parentLoose,
    depth: keys.depth,
    bounds,
    opacity: extra.opacity ?? 1,
    rotation: extra.rotation ?? 0,
    visible: true,
  };
}

function pairIds(result) {
  return result.matched
    .map(pair => [pair.source.id, pair.destination.id])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

test('matches identical layer trees one-to-one', () => {
  const source = [
    snapshot('s1', 'Title', 'TEXT', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'header', index: 0 },
      { type: 'TEXT', name: 'title', index: 0 },
    ], { x: 24, y: 24, width: 180, height: 40 }),
    snapshot('s2', 'CTA', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'footer', index: 0 },
      { type: 'RECTANGLE', name: 'cta', index: 0 },
    ], { x: 24, y: 520, width: 160, height: 48 }),
  ];

  const destination = [
    snapshot('d1', 'Title', 'TEXT', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'header', index: 0 },
      { type: 'TEXT', name: 'title', index: 0 },
    ], { x: 24, y: 24, width: 180, height: 40 }),
    snapshot('d2', 'CTA', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'footer', index: 0 },
      { type: 'RECTANGLE', name: 'cta', index: 0 },
    ], { x: 24, y: 520, width: 160, height: 48 }),
  ];

  const result = matchSmartAnimateLayers(source, destination);
  assert.equal(result.matched.length, 2);
  assert.deepEqual(pairIds(result), [
    ['s1', 'd1'],
    ['s2', 'd2'],
  ]);
  assert.equal(result.sourceOnly.length, 0);
  assert.equal(result.destinationOnly.length, 0);
});

test('uses geometry to choose between ambiguous candidates', () => {
  const source = [
    snapshot('s1', 'Badge', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'content', index: 0 },
      { type: 'GROUP', name: 'badge holder', index: 0 },
      { type: 'RECTANGLE', name: 'badge', index: 0 },
    ], { x: 24, y: 40, width: 36, height: 20 }),
  ];

  const destination = [
    snapshot('d1', 'Badge', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'panel left', index: 0 },
      { type: 'RECTANGLE', name: 'badge', index: 0 },
    ], { x: 24, y: 40, width: 36, height: 20 }),
    snapshot('d2', 'Badge', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'panel right', index: 0 },
      { type: 'RECTANGLE', name: 'badge', index: 0 },
    ], { x: 320, y: 40, width: 36, height: 20 }),
  ];

  const result = matchSmartAnimateLayers(source, destination);
  assert.equal(result.matched.length, 1);
  assert.deepEqual(result.matched[0].source.id, 's1');
  assert.deepEqual(result.matched[0].destination.id, 'd1');
  assert.equal(result.sourceOnly.length, 0);
  assert.equal(result.destinationOnly.length, 1);
  assert.equal(result.destinationOnly[0].id, 'd2');
});

test('keeps unmatched elements as enter and exit motions', () => {
  const source = [
    snapshot('s1', 'Avatar', 'ELLIPSE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'hero', index: 0 },
      { type: 'ELLIPSE', name: 'avatar', index: 0 },
    ], { x: 24, y: 24, width: 64, height: 64 }),
  ];

  const destination = [
    snapshot('d1', 'Button', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'hero', index: 0 },
      { type: 'RECTANGLE', name: 'button', index: 0 },
    ], { x: 24, y: 120, width: 160, height: 48 }),
  ];

  const result = matchSmartAnimateLayers(source, destination);
  assert.equal(result.matched.length, 0);
  assert.equal(result.sourceOnly.length, 1);
  assert.equal(result.sourceOnly[0].id, 's1');
  assert.equal(result.destinationOnly.length, 1);
  assert.equal(result.destinationOnly[0].id, 'd1');
});

test('distinguishes repeated sibling names under deep nesting', () => {
  const source = [
    snapshot('s1', 'Label', 'TEXT', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'card', index: 0 },
      { type: 'GROUP', name: 'row', index: 0 },
      { type: 'TEXT', name: 'label', index: 0 },
    ], { x: 32, y: 48, width: 64, height: 20 }),
    snapshot('s2', 'Label', 'TEXT', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'card', index: 0 },
      { type: 'GROUP', name: 'row', index: 1 },
      { type: 'TEXT', name: 'label', index: 0 },
    ], { x: 240, y: 48, width: 64, height: 20 }),
  ];

  const destination = [
    snapshot('d1', 'Label', 'TEXT', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'card', index: 0 },
      { type: 'GROUP', name: 'row', index: 1 },
      { type: 'TEXT', name: 'label', index: 0 },
    ], { x: 240, y: 60, width: 64, height: 20 }),
    snapshot('d2', 'Label', 'TEXT', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'card', index: 0 },
      { type: 'GROUP', name: 'row', index: 0 },
      { type: 'TEXT', name: 'label', index: 0 },
    ], { x: 32, y: 60, width: 64, height: 20 }),
  ];

  const result = matchSmartAnimateLayers(source, destination);
  assert.equal(result.matched.length, 2);
  assert.deepEqual(pairIds(result), [
    ['s1', 'd2'],
    ['s2', 'd1'],
  ]);
  assert.equal(result.sourceOnly.length, 0);
  assert.equal(result.destinationOnly.length, 0);
});

test('still matches a reparented layer when geometry and identity clues align', () => {
  const source = [
    snapshot('s1', 'Chip', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'toolbar', index: 0 },
      { type: 'RECTANGLE', name: 'chip', index: 0 },
    ], { x: 24, y: 24, width: 88, height: 32 }),
  ];

  const destination = [
    snapshot('d1', 'Chip', 'RECTANGLE', [
      { type: 'FRAME', name: 'screen', index: 0 },
      { type: 'GROUP', name: 'floating panel', index: 0 },
      { type: 'RECTANGLE', name: 'chip', index: 0 },
    ], { x: 24, y: 24, width: 88, height: 32 }),
  ];

  const result = matchSmartAnimateLayers(source, destination);
  assert.equal(result.matched.length, 1);
  assert.deepEqual(pairIds(result), [
    ['s1', 'd1'],
  ]);
  assert.equal(result.sourceOnly.length, 0);
  assert.equal(result.destinationOnly.length, 0);
});
