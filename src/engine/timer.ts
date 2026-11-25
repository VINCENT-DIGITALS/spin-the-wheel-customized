import type { Spin } from "../types";
export const elapsed = (spin: Spin, now = Date.now()) =>
  Math.min(
    spin.duration,
    Math.max(0, (spin.pausedAt ?? now) - spin.startedAt - spin.pausedMs),
  );
export const remaining = (spin: Spin, now = Date.now()) =>
  Math.max(0, spin.duration - elapsed(spin, now));
export function rotation(spin: Spin, now = Date.now()): number {
  const t = elapsed(spin, now);
  const d = spin.duration;
  const a = Math.min(2000, d / 4);
  const b = Math.min(spin.deceleration, d / 2);
  const area = d - a / 2 - b / 2;
  let distance: number;
  if (t < a) distance = (t * t) / (2 * a);
  else if (t <= d - b) distance = t - a / 2;
  else {
    const u = t - (d - b);
    distance = d - b - a / 2 + u - (u * u) / (2 * b);
  }
  return spin.angle * Math.min(1, distance / area);
}
export function targetAngle(index: number, count: number, duration: number) {
  const target =
    (Math.PI * 2 - ((index + 0.5) * Math.PI * 2) / count) % (Math.PI * 2);
  return Math.max(5, Math.ceil(duration / 6000)) * Math.PI * 2 + target;
}
export const formatTime = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
};
