import type { FateEvent, State } from "../types";
import { secureIndex } from "./random";
import { remaining, targetAngle } from "./timer";
export const editable = (e: FateEvent) =>
  e.status === "Draft" || e.status === "Ready";
export const active = (e: FateEvent) =>
  e.participants.filter((p) => p.enabled && p.lives > 0);
export const audit = (e: FateEvent, message: string, now = Date.now()) =>
  e.audit.push({ at: now, message });
export function roundsLeft(e: FateEvent) {
  if (["Completed", "Cancelled"].includes(e.status)) return 0;
  const pool = active(e);
  if (e.config.mode === "winner")
    return Math.max(0, e.config.winnerCount - e.results.length);
  if (e.config.mode === "survival")
    return Math.max(
      0,
      (e.startedAt === null
        ? pool.length * e.config.lives
        : pool.reduce((n, p) => n + p.lives, 0)) - 1,
    );
  return Math.max(0, pool.length - 1);
}
export function estimate(e: FateEvent, now = Date.now()) {
  const rounds = roundsLeft(e);
  let total = 0;
  for (let i = 0; i < rounds; i++)
    total += e.config.roundDurations[e.results.length + i] ?? e.config.duration;
  if (e.spin && ["Spinning", "Paused"].includes(e.status))
    total += remaining(e.spin, now) - e.spin.duration;
  return Math.max(
    0,
    total +
      Math.max(0, rounds - 1) * e.config.interval +
      (e.status === "Scheduled" && e.config.scheduledAt
        ? Math.max(0, e.config.scheduledAt - now)
        : 0) +
      (e.status === "Between Rounds" && e.nextAt
        ? Math.max(0, e.nextAt - now)
        : 0),
  );
}
export function begin(e: FateEvent, now = Date.now()) {
  if (!editable(e) && e.status !== "Scheduled") return;
  if (e.participants.filter((p) => p.enabled).length < 2)
    throw Error("Enable at least two participants.");
  if (
    e.config.mode === "winner" &&
    e.config.removeWinners &&
    e.config.winnerCount > e.participants.filter((p) => p.enabled).length
  )
    throw Error("Winner count exceeds enabled participants.");
  e.participants.forEach(
    (p) => (p.lives = e.config.mode === "survival" ? e.config.lives : 1),
  );
  e.original = structuredClone(e.participants);
  e.startedAt = now;
  e.status = "Between Rounds";
  audit(e, "Event started; configuration and participants locked", now);
  startSpin(e, now);
}
export function startSpin(e: FateEvent, now = Date.now()) {
  if (e.status !== "Between Rounds") return;
  const pool = active(e);
  if (!pool.length) throw Error("No eligible participants.");
  const index = secureIndex(pool.length);
  const duration =
    e.config.roundDurations[e.results.length] ?? e.config.duration;
  e.spin = {
    id: crypto.randomUUID(),
    selectedId: pool[index].id,
    pool: structuredClone(pool),
    startedAt: now,
    duration,
    pausedAt: null,
    pausedMs: 0,
    angle: targetAngle(index, pool.length, duration),
    deceleration: e.config.deceleration,
  };
  e.status = "Spinning";
  e.nextAt = null;
  audit(
    e,
    `Round ${e.results.length + 1}: selection persisted from ${pool.length} equal entries`,
    now,
  );
}
export function pause(e: FateEvent, now = Date.now()) {
  if (e.status === "Spinning" && e.spin) {
    e.spin.pausedAt = now;
    e.status = "Paused";
    audit(e, "Spin paused", now);
  }
}
export function resume(e: FateEvent, now = Date.now()) {
  if (e.status === "Paused" && e.spin && e.spin.pausedAt !== null) {
    e.spin.pausedMs += now - e.spin.pausedAt;
    e.spin.pausedAt = null;
    e.status = "Spinning";
    audit(e, "Spin resumed", now);
  }
}
export function reconcile(s: State, now = Date.now()) {
  const e = s.event;
  if (
    e.status === "Scheduled" &&
    e.config.scheduledAt !== null &&
    now >= e.config.scheduledAt
  ) {
    begin(e, now);
    return;
  }
  if (
    e.status === "Between Rounds" &&
    e.config.auto &&
    !e.config.confirmRound &&
    e.nextAt !== null &&
    now >= e.nextAt
  ) {
    startSpin(e, now);
    return;
  }
  if (e.status !== "Spinning" || !e.spin || remaining(e.spin, now) > 0) return;
  const spin = e.spin;
  if (e.results.some((r) => r.spinId === spin.id)) return;
  const p = e.participants.find((p) => p.id === spin.selectedId);
  if (!p || p.lives <= 0)
    throw Error("Invalid persisted result. Restore a valid backup.");
  if (e.config.mode === "winner") {
    e.winners.push(p.id);
    if (e.config.removeWinners) p.lives = 0;
  } else p.lives--;
  e.results.push({
    round: e.results.length + 1,
    participantId: p.id,
    name: p.name,
    at: spin.startedAt + spin.pausedMs + spin.duration,
    poolSize: spin.pool.length,
    eliminated: p.lives === 0,
    livesLeft: p.lives,
    spinId: spin.id,
  });
  audit(
    e,
    `Round ${e.results.length}: ${p.name} ${e.config.mode === "winner" ? "selected" : p.lives ? "lost one life" : "eliminated"}`,
    now,
  );
  const done =
    e.config.mode === "winner"
      ? e.results.length >= e.config.winnerCount
      : active(e).length === 1;
  if (done) {
    if (e.config.mode !== "winner") e.winners = [active(e)[0].id];
    e.status = "Completed";
    e.finishedAt = now;
    audit(
      e,
      "Event completed; prizes recorded for winner(s), no in-game transfer",
      now,
    );
    if (!s.history.some((h) => h.id === e.id))
      s.history.unshift(structuredClone(e));
  } else {
    e.status = "Between Rounds";
    e.nextAt = now + e.config.interval;
  }
}
export function cancel(s: State, now = Date.now()) {
  const e = s.event;
  e.status = "Cancelled";
  e.finishedAt = now;
  e.nextAt = null;
  audit(e, "Event cancelled", now);
  if (!s.history.some((h) => h.id === e.id))
    s.history.unshift(structuredClone(e));
}
