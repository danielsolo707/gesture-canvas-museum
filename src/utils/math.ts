export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distance2D(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distance3D(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function normalize(x: number, y: number, z: number): [number, number, number] {
  const m = magnitude(x, y, z);
  if (m < 1e-10) return [0, 0, 0];
  return [x / m, y / m, z / m];
}

export function dot(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
  return x1 * x2 + y1 * y2 + z1 * z2;
}

export function cross(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): [number, number, number] {
  return [
    y1 * z2 - z1 * y2,
    z1 * x2 - x1 * z2,
    x1 * y2 - y1 * x2,
  ];
}

export function angleBetweenVectors(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): number {
  const d = dot(x1, y1, z1, x2, y2, z2);
  const m1 = magnitude(x1, y1, z1);
  const m2 = magnitude(x2, y2, z2);
  if (m1 < 1e-10 || m2 < 1e-10) return 0;
  const cosA = clamp(d / (m1 * m2), -1, 1);
  return Math.acos(cosA);
}

export function vec3Sub(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): [number, number, number] {
  return [ax - bx, ay - by, az - bz];
}

export function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
