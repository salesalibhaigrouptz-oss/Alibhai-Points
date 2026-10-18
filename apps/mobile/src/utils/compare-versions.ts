export function compareVersions(left: string, right: string): number | null {
  const parse = (version: string): number[] | null => {
    const value = version.trim();
    if (!/^\d+(?:\.\d+)*$/.test(value)) return null;

    const parts = value.split(".").map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
  };

  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;

  const partCount = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < partCount; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }

  return 0;
}
