export function secureIndex(
  length: number,
  fill = (a: Uint32Array) => crypto.getRandomValues(a),
): number {
  if (!Number.isInteger(length) || length < 1 || length > 0x100000000)
    throw Error("Invalid selection pool");
  const limit = Math.floor(0x100000000 / length) * length;
  const value = new Uint32Array(1);
  do {
    fill(value);
  } while (value[0] >= limit);
  return value[0] % length;
}
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
