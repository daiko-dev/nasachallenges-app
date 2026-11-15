import type { Epoch, FieldManifest } from '../types/spherex';

export function sortedEpochs(manifest: FieldManifest): Epoch[] {
  return [...manifest.epochs].sort(
    (a, b) => new Date(a.utc).getTime() - new Date(b.utc).getTime()
  );
}

export function lambdaBadge(
  a: Epoch,
  b: Epoch,
  manifest: FieldManifest
): 'matched' | 'mismatch' {
  if (a.id === b.id) return 'matched';
  const matched = manifest.matchedPairs.some(
    ([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id)
  );
  return matched ? 'matched' : 'mismatch';
}
