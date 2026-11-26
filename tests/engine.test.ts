import { describe, it, expect, vi, afterEach } from "vitest";
import { defaults } from "../src/data/defaults";
import {
  active,
  begin,
  cancel,
  estimate,
  pause,
  reconcile,
  resume,
  startSpin,
} from "../src/engine/event";
import { elapsed, remaining, rotation, targetAngle } from "../src/engine/timer";
import { secureIndex, shuffle } from "../src/engine/random";
import { stateSchema } from "../src/types";
import {
  csv,
  mergeParticipants,
  parseParticipants,
  validateBackup,
} from "../src/services/export";
afterEach(() => vi.restoreAllMocks());
describe("secure unbiased selection", () => {
  it("rejects modulo bias before selecting", () => {
    let calls = 0;
    expect(
      secureIndex(10, (a) => {
        a[0] = calls++ === 0 ? 0xffffffff : 12;
        return a;
      }),
    ).toBe(2);
    expect(calls).toBe(2);
  });
  it("rejects invalid pools", () => {
    expect(() => secureIndex(0)).toThrow();
    expect(() => secureIndex(1.5)).toThrow();
  });
  it("maps each accepted residue equally", () => {
    const counts = Array(10).fill(0);
    for (let i = 0; i < 1000; i++)
      counts[
        secureIndex(10, (a) => {
          a[0] = i;
          return a;
        })
      ]++;
    expect(counts).toEqual(Array(10).fill(100));
  });
  it("shuffles without losses", () =>
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]));
});
describe("timing and trajectory", () => {
  it("matches the exact default event duration", () =>
    expect(estimate(defaults().event)).toBe(16280000));
  it("keeps multi-hour deadlines across serialization and sleep", () => {
    const s = defaults();
    s.event.config.duration = 24 * 3600000;
    begin(s.event, 1000);
    const restored = stateSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(remaining(restored.event.spin!, 1000 + 12 * 3600000)).toBe(
      12 * 3600000,
    );
    const selected = restored.event.spin!.selectedId;
    reconcile(restored, 1000 + 25 * 3600000);
    expect(restored.event.results[0].participantId).toBe(selected);
    expect(restored.event.status).toBe("Between Rounds");
  });
  it("pause survives refresh and excludes paused time", () => {
    const s = defaults(true);
    begin(s.event, 1000);
    pause(s.event, 2000);
    const restored = stateSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(remaining(restored.event.spin!, 1000000)).toBe(4000);
    resume(restored.event, 1000000);
    expect(remaining(restored.event.spin!, 1001000)).toBe(3000);
    expect(elapsed(restored.event.spin!, 1001000)).toBe(2000);
  });
  it("stops on the chosen segment for every segment and duration", () => {
    for (const count of [2, 3, 10, 100])
      for (let i = 0; i < count; i++)
        for (const duration of [1000, 1800000, 86400000]) {
          const angle = targetAngle(i, count, duration);
          const pointer =
            (Math.PI * 2 - (angle % (Math.PI * 2))) % (Math.PI * 2);
          expect(Math.floor(pointer / ((Math.PI * 2) / count))).toBe(i);
          const s = defaults();
          begin(s.event, 100);
          s.event.spin!.duration = duration;
          s.event.spin!.angle = angle;
          expect(rotation(s.event.spin!, 100 + duration)).toBeCloseTo(angle, 6);
          expect(rotation(s.event.spin!, 100)).toBe(0);
          expect(rotation(s.event.spin!, 100 + duration / 2)).toBeGreaterThan(
            0,
          );
        }
  });
});
describe("event state transitions", () => {
  it("ten participants produce nine unique eliminations and one champion", () => {
    const s = defaults(true);
    begin(s.event, 1000);
    let time = 1000;
    for (let i = 0; i < 9; i++) {
      time += 5000;
      reconcile(s, time);
      if (i < 8) {
        time += 1000;
        reconcile(s, time);
      }
    }
    expect(s.event.results).toHaveLength(9);
    expect(new Set(s.event.results.map((r) => r.participantId)).size).toBe(9);
    expect(active(s.event)).toHaveLength(1);
    expect(s.event.winners).toEqual([active(s.event)[0].id]);
    expect(s.event.status).toBe("Completed");
    expect(s.history).toHaveLength(1);
    expect(s.event.prizes.reduce((n, p) => n + p.quantity, 0)).toBe(350);
  });
  it("reconciliation is idempotent and never rerolls", () => {
    const s = defaults(true);
    s.event.config.auto = false;
    begin(s.event, 0);
    const spin = structuredClone(s.event.spin!);
    reconcile(s, 6000);
    reconcile(s, 7000);
    expect(s.event.results).toHaveLength(1);
    expect(s.event.results[0].participantId).toBe(spin.selectedId);
    expect(s.event.spin).toEqual(spin);
  });
  it("manual next round waits and stays locked", () => {
    const s = defaults(true);
    s.event.config.auto = false;
    begin(s.event, 0);
    reconcile(s, 6000);
    reconcile(s, 100000);
    expect(s.event.status).toBe("Between Rounds");
    startSpin(s.event, 100000);
    expect(s.event.status).toBe("Spinning");
    expect(s.event.spin!.pool).toHaveLength(9);
  });
  it("confirmation prevents auto rounds", () => {
    const s = defaults(true);
    s.event.config.confirmRound = true;
    begin(s.event, 0);
    reconcile(s, 6000);
    reconcile(s, 9000);
    expect(s.event.status).toBe("Between Rounds");
  });
  it("survival removes lives and eventually declares champion", () => {
    const s = defaults(true);
    s.event.config.mode = "survival";
    s.event.config.lives = 2;
    begin(s.event, 0);
    let now = 0;
    while (s.event.status !== "Completed") {
      now += 5000;
      reconcile(s, now);
      now += 1000;
      reconcile(s, now);
    }
    expect(active(s.event)).toHaveLength(1);
    expect(s.event.results.length).toBeGreaterThanOrEqual(18);
    expect(s.event.results.length).toBeLessThanOrEqual(19);
    expect(s.event.results.every((r) => r.livesLeft >= 0)).toBe(true);
  });
  it("winner selection supports removal and retention", () => {
    for (const remove of [true, false]) {
      const s = defaults(true);
      s.event.config.mode = "winner";
      s.event.config.winnerCount = 3;
      s.event.config.removeWinners = remove;
      begin(s.event, 0);
      for (let i = 0; i < 3; i++) {
        reconcile(s, i * 6000 + 5000);
        reconcile(s, i * 6000 + 6000);
      }
      expect(s.event.winners).toHaveLength(3);
      expect(active(s.event)).toHaveLength(remove ? 7 : 10);
      expect(s.event.status).toBe("Completed");
    }
  });
  it("scheduled start reconciles when reopened", () => {
    const s = defaults();
    s.event.status = "Scheduled";
    s.event.config.scheduledAt = 1000;
    reconcile(s, 2000);
    expect(s.event.status).toBe("Spinning");
    expect(s.event.startedAt).toBe(2000);
  });
  it("cancellation archives without erasing result", () => {
    const s = defaults();
    begin(s.event, 1000);
    const selected = s.event.spin!.selectedId;
    cancel(s, 2000);
    expect(s.history[0].spin!.selectedId).toBe(selected);
    expect(s.history[0].status).toBe("Cancelled");
  });
  it("per-round overrides apply", () => {
    const s = defaults();
    s.event.config.roundDurations = [2000, 3000];
    begin(s.event, 0);
    expect(s.event.spin!.duration).toBe(2000);
    reconcile(s, 2000);
    startSpin(s.event, 3000);
    expect(s.event.spin!.duration).toBe(3000);
  });
});
describe("imports and validation", () => {
  it("handles CSV quoting and duplicates", () => {
    const p = parseParticipants(
      'name,discord\n"Alpha, One",@alpha\nBeta,@beta',
      "csv",
    );
    expect(p[0].name).toBe("Alpha, One");
    expect(
      mergeParticipants(p, parseParticipants("beta\n@BETA\nGamma")).duplicates,
    ).toBe(2);
  });
  it("exports formula-safe CSV and round-trips handles", () => {
    const text = csv([
      ["name", "discord"],
      ["@alice", "@alice"],
    ]);
    expect(text).toContain("'@alice");
    expect(parseParticipants(text, "csv")[0].name).toBe("@alice");
  });
  it("rejects corrupted backups and unsupported versions", () => {
    expect(() =>
      validateBackup({ state: { version: 999 }, assets: [] }),
    ).toThrow();
    expect(() => stateSchema.parse({ ...defaults(), version: 2 })).toThrow();
  });
  it("validates full backup including persisted spin", () => {
    const s = defaults();
    begin(s.event, 0);
    expect(
      validateBackup({ state: s, assets: [] }).state.event.spin!.selectedId,
    ).toBe(s.event.spin!.selectedId);
  });
  it("rejects impossible selected identities", () => {
    const s = defaults();
    begin(s.event);
    s.event.spin!.selectedId = "invalid";
    expect(() => stateSchema.parse(s)).toThrow();
  });
});

it("stopping for edits preserves the run and restores an unlocked draft", async () => {
  const { editAsDraft, editable } = await import("../src/engine/event");
  const s = defaults(true);
  s.event.config.title = "My event";
  begin(s.event, 1000);
  const originalId = s.event.id,
    selected = s.event.spin!.selectedId;
  pause(s.event, 2000);
  editAsDraft(s, 3000);
  expect(editable(s.event)).toBe(true);
  expect(s.event.id).not.toBe(originalId);
  expect(s.event.config.title).toBe("My event");
  expect(s.event.participants).toHaveLength(10);
  expect(s.event.spin).toBeNull();
  expect(s.event.results).toHaveLength(0);
  expect(s.history[0].status).toBe("Cancelled");
  expect(s.history[0].spin!.selectedId).toBe(selected);
  expect(stateSchema.safeParse(s).success).toBe(true);
});
