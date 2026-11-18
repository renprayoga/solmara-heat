// Shared helpers for Solmara Heat: seeded RNG, math, AABB collision helpers.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Circle vs AABB push-out. Returns true when a collision happened.
export function collideCircleAABBs(x, z, r, boxes) {
  let hit = false;
  for (const b of boxes) {
    const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { hit = true; }
  }
  return hit;
}
// Resolve a circle against AABBs by axis-separated movement (caller moves per axis).
export function tryMove(pos, dx, dz, r, boxes) {
  let nx = pos.x + dx;
  if (!hitsAny(nx, pos.z, r, boxes)) pos.x = nx;
  let nz = pos.z + dz;
  if (!hitsAny(pos.x, nz, r, boxes)) pos.z = nz;
}
export function hitsAny(x, z, r, boxes) {
  for (const b of boxes) {
    const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
export function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
