import { z } from "zod";
const text = z.string().max(10000);
export const participantSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  discord: text.default(""),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  avatar: text.default(""),
  enabled: z.boolean(),
  lives: z.number().int().nonnegative(),
});
export const prizeSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  quantity: z.number().int().positive().max(1e9),
  description: text,
  rarity: text,
  image: text,
});
export const configSchema = z.object({
  title: z.string().min(1).max(120),
  organization: text,
  mode: z.enum(["elimination", "winner", "survival"]),
  duration: z.number().min(1000).max(1e12),
  roundDurations: z.array(z.number().min(1000).max(1e12)),
  interval: z.number().min(0).max(1e12),
  deceleration: z.number().min(100).max(1e12),
  auto: z.boolean(),
  confirmRound: z.boolean(),
  lives: z.number().int().min(1).max(100),
  winnerCount: z.number().int().min(1).max(10000),
  removeWinners: z.boolean(),
  rules: text,
  announcement: text,
  scheduledAt: z.number().nullable(),
});
export const spinSchema = z.object({
  id: z.string(),
  selectedId: z.string(),
  pool: z.array(participantSchema).min(1),
  startedAt: z.number(),
  duration: z.number().positive(),
  pausedAt: z.number().nullable(),
  pausedMs: z.number().nonnegative(),
  angle: z.number(),
  deceleration: z.number().positive(),
});
export const resultSchema = z.object({
  round: z.number().int(),
  participantId: z.string(),
  name: text,
  at: z.number(),
  poolSize: z.number().int(),
  eliminated: z.boolean(),
  livesLeft: z.number().int(),
  spinId: z.string(),
});
export const eventSchema = z.object({
  id: z.string(),
  test: z.boolean(),
  status: z.enum([
    "Draft",
    "Ready",
    "Scheduled",
    "Spinning",
    "Paused",
    "Between Rounds",
    "Completed",
    "Cancelled",
  ]),
  config: configSchema,
  participants: z.array(participantSchema).max(10000),
  prizes: z.array(prizeSchema),
  original: z.array(participantSchema),
  results: z.array(resultSchema),
  winners: z.array(z.string()),
  spin: spinSchema.nullable(),
  nextAt: z.number().nullable(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  audit: z.array(z.object({ at: z.number(), message: text })),
});
export const appearanceSchema = z.object({
  appTitle: text,
  sect: text,
  theme: z.enum([
    "Heavenly",
    "Demonic",
    "Celestial",
    "Minimal Dark",
    "Minimal Light",
    "Custom",
  ]),
  accent: z.string(),
  background: z.string(),
  logo: text,
  centerpiece: text,
  backgroundImage: text,
  wheelBackground: text.default(""),
  font: z.enum(["sans", "serif"]),
  intensity: z.number().min(0).max(1),
  effects: z.record(z.string(), z.boolean()),
  showAvatars: z.boolean(),
  showDiscord: z.boolean(),
  audienceLayout: z.enum(["balanced", "wheel"]),
});
export const audioSchema = z.object({
  muted: z.boolean(),
  master: z.number().min(0).max(1),
  music: z.number().min(0).max(1),
  effects: z.number().min(0).max(1),
  enabled: z.record(z.string(), z.boolean()),
  custom: text,
  musicAsset: text,
  audience: z.boolean(),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int(),
    event: eventSchema,
    history: z.array(eventSchema),
    appearance: appearanceSchema,
    audio: audioSchema,
    participantPresets: z.record(z.string(), z.array(participantSchema)),
    prizePresets: z.record(z.string(), z.array(prizeSchema)),
    removed: z.array(participantSchema),
  })
  .superRefine((s, ctx) => {
    for (const e of [s.event, ...s.history]) {
      const ids = e.participants.map((p) => p.id);
      const names = e.participants.map((p) =>
        p.name.trim().toLowerCase().replace(/^@/, ""),
      );
      if (new Set(names).size !== names.length)
        ctx.addIssue({
          code: "custom",
          message: "Duplicate participant names",
        });
      if (
        e.status === "Completed" &&
        (!e.winners.length || e.winners.some((id) => !ids.includes(id)))
      )
        ctx.addIssue({ code: "custom", message: "Invalid champion record" });
      if (e.status === "Paused" && e.spin?.pausedAt === null)
        ctx.addIssue({ code: "custom", message: "Missing pause timestamp" });
      if (e.spin) {
        const count = e.spin.pool.length;
        const index = e.spin.pool.findIndex((p) => p.id === e.spin!.selectedId);
        const pointer =
          (2 * Math.PI - (e.spin.angle % (2 * Math.PI))) % (2 * Math.PI);
        if (Math.floor(pointer / ((2 * Math.PI) / count)) !== index)
          ctx.addIssue({
            code: "custom",
            message: "Wheel trajectory does not match its selected result",
          });
      }
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", message: "Duplicate participant IDs" });
      if (
        e.spin &&
        (!e.spin.pool.some((p) => p.id === e.spin!.selectedId) ||
          !e.participants.some((p) => p.id === e.spin!.selectedId))
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid selected participant",
        });
      if (["Spinning", "Paused"].includes(e.status) && !e.spin)
        ctx.addIssue({
          code: "custom",
          message: "Active event is missing spin",
        });
      if (
        e.results.some((r, i) => r.round !== i + 1) ||
        new Set(e.results.map((r) => r.spinId)).size !== e.results.length
      )
        ctx.addIssue({ code: "custom", message: "Invalid round history" });
    }
  });
export type Participant = z.infer<typeof participantSchema>;
export type Prize = z.infer<typeof prizeSchema>;
export type Config = z.infer<typeof configSchema>;
export type Spin = z.infer<typeof spinSchema>;
export type FateEvent = z.infer<typeof eventSchema>;
export type State = z.infer<typeof stateSchema>;
export type Appearance = State["appearance"];
