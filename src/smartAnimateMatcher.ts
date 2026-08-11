export interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerSnapshot {
  id: string;
  name: string;
  type: string;
  keyExact: string;
  keyLoose: string;
  keyLeaf: string;
  keyParentExact: string;
  keyParentLoose: string;
  depth: number;
  bounds: LayerBounds;
  opacity: number;
  rotation: number;
  visible: boolean;
}

export interface SmartAnimateLayerMotion {
  key: string;
  source: {
    id: string;
    bounds: LayerBounds;
    opacity: number;
    rotation: number;
    imageData?: Uint8Array;
  };
  destination: {
    id: string;
    bounds: LayerBounds;
    opacity: number;
    rotation: number;
    imageData?: Uint8Array;
  };
}

export function normalizeLayerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[-_]+/g, ' ');
}

export function roundToPixel(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function scaleBounds(bounds: LayerBounds, scale: number): LayerBounds {
  return {
    x: roundToPixel(bounds.x * scale),
    y: roundToPixel(bounds.y * scale),
    width: roundToPixel(bounds.width * scale),
    height: roundToPixel(bounds.height * scale),
  };
}

export function buildLayerKeys(segments: Array<{ type: string; name: string; index: number }>) {
  const exact = segments.map(seg => `${seg.type}:${seg.name}#${seg.index}`).join('>');
  const loose = segments.map(seg => `${seg.type}:${seg.name}`).join('>');
  const leaf = segments.length > 0
    ? `${segments[segments.length - 1].type}:${segments[segments.length - 1].name}`
    : '';
  const parentSegments = segments.slice(0, -1);
  const parentExact = parentSegments.map(seg => `${seg.type}:${seg.name}#${seg.index}`).join('>');
  const parentLoose = parentSegments.map(seg => `${seg.type}:${seg.name}`).join('>');
  return { exact, loose, leaf, parentExact, parentLoose, depth: segments.length };
}

export function indexLayerSnapshots(layers: LayerSnapshot[]) {
  const exact = new Map<string, LayerSnapshot[]>();
  const loose = new Map<string, LayerSnapshot[]>();
  const leaf = new Map<string, LayerSnapshot[]>();
  const typeLeaf = new Map<string, LayerSnapshot[]>();
  const parentLoose = new Map<string, LayerSnapshot[]>();
  const parentExact = new Map<string, LayerSnapshot[]>();

  for (const layer of layers) {
    if (!exact.has(layer.keyExact)) exact.set(layer.keyExact, []);
    exact.get(layer.keyExact)!.push(layer);
    if (!loose.has(layer.keyLoose)) loose.set(layer.keyLoose, []);
    loose.get(layer.keyLoose)!.push(layer);
    if (!leaf.has(layer.keyLeaf)) leaf.set(layer.keyLeaf, []);
    leaf.get(layer.keyLeaf)!.push(layer);
    if (!typeLeaf.has(`${layer.type}:${layer.keyLeaf}`)) typeLeaf.set(`${layer.type}:${layer.keyLeaf}`, []);
    typeLeaf.get(`${layer.type}:${layer.keyLeaf}`)!.push(layer);
    if (!parentLoose.has(layer.keyParentLoose)) parentLoose.set(layer.keyParentLoose, []);
    parentLoose.get(layer.keyParentLoose)!.push(layer);
    if (!parentExact.has(layer.keyParentExact)) parentExact.set(layer.keyParentExact, []);
    parentExact.get(layer.keyParentExact)!.push(layer);
  }

  return { exact, loose, leaf, typeLeaf, parentLoose, parentExact };
}

export function takeUniqueMatch(
  index: { exact: Map<string, LayerSnapshot[]>; loose: Map<string, LayerSnapshot[]>; leaf: Map<string, LayerSnapshot[]>; typeLeaf: Map<string, LayerSnapshot[]>; parentLoose: Map<string, LayerSnapshot[]>; parentExact: Map<string, LayerSnapshot[]> },
  key: string,
  strategy: 'exact' | 'loose' | 'leaf' | 'typeLeaf' | 'parentLoose' | 'parentExact'
): LayerSnapshot | null {
  const list = index[strategy].get(key);
  if (!list || list.length !== 1) return null;
  return list[0];
}

export function removeSnapshotFromIndex(
  index: { exact: Map<string, LayerSnapshot[]>; loose: Map<string, LayerSnapshot[]>; leaf: Map<string, LayerSnapshot[]>; typeLeaf: Map<string, LayerSnapshot[]>; parentLoose: Map<string, LayerSnapshot[]>; parentExact: Map<string, LayerSnapshot[]> },
  snapshot: LayerSnapshot
) {
  for (const [map, key] of [
    [index.exact, snapshot.keyExact],
    [index.loose, snapshot.keyLoose],
    [index.leaf, snapshot.keyLeaf],
    [index.typeLeaf, `${snapshot.type}:${snapshot.keyLeaf}`],
    [index.parentLoose, snapshot.keyParentLoose],
    [index.parentExact, snapshot.keyParentExact],
  ] as const) {
    const list = map.get(key);
    if (!list) continue;
    const next = list.filter(item => item.id !== snapshot.id);
    if (next.length > 0) map.set(key, next);
    else map.delete(key);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function similarityScore(source: LayerSnapshot, destination: LayerSnapshot): number {
  if (source.id === destination.id) return -Infinity;

  const sourceArea = Math.max(source.bounds.width * source.bounds.height, 1);
  const destArea = Math.max(destination.bounds.width * destination.bounds.height, 1);
  const sourceCx = source.bounds.x + source.bounds.width / 2;
  const sourceCy = source.bounds.y + source.bounds.height / 2;
  const destCx = destination.bounds.x + destination.bounds.width / 2;
  const destCy = destination.bounds.y + destination.bounds.height / 2;
  const diagonal = Math.max(
    Math.hypot(source.bounds.width, source.bounds.height),
    Math.hypot(destination.bounds.width, destination.bounds.height),
    1
  );

  const sameType = source.type === destination.type ? 1 : 0;
  const sameLeaf = source.keyLeaf === destination.keyLeaf ? 1 : 0;
  const sameLoose = source.keyLoose === destination.keyLoose ? 1 : 0;
  const sameExact = source.keyExact === destination.keyExact ? 1 : 0;
  const sameParentLoose = source.keyParentLoose && source.keyParentLoose === destination.keyParentLoose ? 1 : 0;
  const sameParentExact = source.keyParentExact && source.keyParentExact === destination.keyParentExact ? 1 : 0;

  const nameSimilarity = source.name === destination.name ? 1 : 0;
  const sizeDiff = Math.abs(sourceArea - destArea) / Math.max(sourceArea, destArea);
  const widthDiff = Math.abs(source.bounds.width - destination.bounds.width) / Math.max(Math.max(source.bounds.width, destination.bounds.width), 1);
  const heightDiff = Math.abs(source.bounds.height - destination.bounds.height) / Math.max(Math.max(source.bounds.height, destination.bounds.height), 1);
  const centerDiff = Math.hypot(sourceCx - destCx, sourceCy - destCy) / diagonal;
  const opacityDiff = Math.abs(source.opacity - destination.opacity);
  const rotationDiff = Math.abs(source.rotation - destination.rotation) / 180;
  const depthDiff = Math.abs(source.depth - destination.depth) / Math.max(Math.max(source.depth, destination.depth), 1);

  let score = 0;
  score += sameExact ? 120 : 0;
  score += sameLoose ? 90 : 0;
  score += sameParentExact ? 55 : 0;
  score += sameParentLoose ? 35 : 0;
  score += sameLeaf ? 45 : 0;
  score += sameType ? 25 : -35;
  score += nameSimilarity ? 10 : 0;
  score -= clamp(sizeDiff * 40, 0, 40);
  score -= clamp(widthDiff * 18, 0, 18);
  score -= clamp(heightDiff * 18, 0, 18);
  score -= clamp(centerDiff * 50, 0, 50);
  score -= clamp(opacityDiff * 12, 0, 12);
  score -= clamp(rotationDiff * 18, 0, 18);
  score -= clamp(depthDiff * 20, 0, 20);

  if (!sameType && !sameLeaf && !sameLoose && !sameExact) {
    score -= 25;
  }

  return score;
}

export function collectCandidateDestinations(
  index: { exact: Map<string, LayerSnapshot[]>; loose: Map<string, LayerSnapshot[]>; leaf: Map<string, LayerSnapshot[]>; typeLeaf: Map<string, LayerSnapshot[]>; parentLoose: Map<string, LayerSnapshot[]>; parentExact: Map<string, LayerSnapshot[]> },
  source: LayerSnapshot
): LayerSnapshot[] {
  const candidates = new Map<string, LayerSnapshot>();
  const add = (list: LayerSnapshot[] | undefined) => {
    if (!list) return;
    for (const candidate of list) candidates.set(candidate.id, candidate);
  };

  add(index.exact.get(source.keyExact));
  add(index.loose.get(source.keyLoose));
  add(index.leaf.get(source.keyLeaf));
  add(index.typeLeaf.get(`${source.type}:${source.keyLeaf}`));
  add(index.parentLoose.get(source.keyParentLoose));
  add(index.parentExact.get(source.keyParentExact));

  return Array.from(candidates.values()).filter(candidate => candidate.id !== source.id);
}

export function matchSmartAnimateLayers(sourceLayers: LayerSnapshot[], destinationLayers: LayerSnapshot[]) {
  const destinationIndex = indexLayerSnapshots(destinationLayers);
  const matched: Array<{ source: LayerSnapshot; destination: LayerSnapshot }> = [];
  const sourceOnly: LayerSnapshot[] = [];

  const orderedSource = [...sourceLayers].sort((a, b) => {
    const areaA = a.bounds.width * a.bounds.height;
    const areaB = b.bounds.width * b.bounds.height;
    return areaB - areaA;
  });

  for (const source of orderedSource) {
    const exact = takeUniqueMatch(destinationIndex, source.keyExact, 'exact');
    const loose = exact ? null : takeUniqueMatch(destinationIndex, source.keyLoose, 'loose');
    const leaf = exact || loose ? null : takeUniqueMatch(destinationIndex, source.keyLeaf, 'leaf');
    const unique = exact || loose || leaf;
    if (unique) {
      matched.push({ source, destination: unique });
      removeSnapshotFromIndex(destinationIndex, unique);
      continue;
    }

    const candidates = collectCandidateDestinations(destinationIndex, source);
    if (candidates.length === 0) {
      sourceOnly.push(source);
      continue;
    }

    let bestDestination: LayerSnapshot | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const score = similarityScore(source, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestDestination = candidate;
      }
    }

    if (!bestDestination || bestScore < 10) {
      sourceOnly.push(source);
      continue;
    }

    matched.push({ source, destination: bestDestination });
    removeSnapshotFromIndex(destinationIndex, bestDestination);
  }

  const destinationOnly = Array.from(destinationIndex.exact.values()).flat();
  return { matched, sourceOnly, destinationOnly };
}
