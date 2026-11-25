import type { FateEvent, Participant, State } from "../types";
import { participantSchema, stateSchema } from "../types";
import { participant } from "../data/defaults";
import { z } from "zod";
export function download(
  name: string,
  data: string | Blob,
  type = "application/json",
) {
  const url = URL.createObjectURL(
    typeof data === "string" ? new Blob([data], { type }) : data,
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const json = (name: string, data: unknown) =>
  download(name, JSON.stringify(data, null, 2));
export const csvCell = (value: unknown) =>
  `"${String(value)
    .replace(/^[=+\-@]/, "'$&")
    .replaceAll('"', '""')}"`;
export function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function parseCSV(input: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw Error("Unclosed CSV quote.");
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseParticipants(
  input: string,
  extension = "txt",
): Participant[] {
  if (extension === "json") {
    const data: unknown = JSON.parse(input);
    if (Array.isArray(data) && data.every((v) => typeof v === "string"))
      return data.map(participant);
    return z
      .array(participantSchema)
      .parse(data)
      .map((p) => ({ ...p, id: crypto.randomUUID() }));
  }
  const rows =
    extension === "csv"
      ? parseCSV(input)
      : input.split(/\r?\n/).map((v) => [v]);
  if (rows[0]?.[0].toLowerCase() === "name") rows.shift();
  return rows
    .filter((r) => r[0]?.trim())
    .map((r, i) => ({
      ...participant(r[0].replace(/^'(?=[=+\-@])/, "").trim(), i),
      discord: (r[1] ?? r[0]).replace(/^'(?=[=+\-@])/, ""),
    }));
}
export function mergeParticipants(
  existing: Participant[],
  incoming: Participant[],
) {
  const seen = new Set(
    existing.map((p) => p.name.toLowerCase().replace(/^@/, "")),
  );
  const accepted: Participant[] = [];
  let duplicates = 0;
  for (const p of incoming) {
    const key = p.name.toLowerCase().replace(/^@/, "");
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    accepted.push(p);
  }
  return { participants: [...existing, ...accepted], duplicates };
}
export const resultCSV = (e: FateEvent) =>
  csv([
    [
      "Round",
      "Participant",
      "Timestamp",
      "Pool size",
      "Eliminated",
      "Lives remaining",
    ],
    ...e.results.map((r) => [
      r.round,
      r.name,
      new Date(r.at).toISOString(),
      r.poolSize,
      r.eliminated,
      r.livesLeft,
    ]),
  ]);
export function announcement(e: FateEvent) {
  return `${e.test ? "[TEST EVENT — NOT OFFICIAL]\n" : ""}${e.config.announcement
    .replaceAll("{title}", e.config.title)
    .replaceAll(
      "{winner}",
      e.winners
        .map((id) => e.participants.find((p) => p.id === id)?.name)
        .join(", "),
    )
    .replaceAll(
      "{prizes}",
      e.prizes.map((p) => `• ${p.quantity} × ${p.name}`).join("\n"),
    )}`;
}
export async function championImage(e: FateEvent) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720 + e.prizes.length * 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 3;
  ctx.strokeRect(35, 35, 1130, canvas.height - 70);
  ctx.textAlign = "center";
  ctx.fillStyle = "#d4af37";
  ctx.font = "32px Georgia";
  ctx.fillText("☯ HEAVENLY FATE CHAMPION", 600, 130);
  ctx.font = "22px sans-serif";
  ctx.fillText(e.test ? "TEST EVENT" : e.config.organization, 600, 190);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 42px sans-serif";
  const winner = e.winners
    .map((id) => e.participants.find((p) => p.id === id)?.name)
    .join(", ");
  ctx.fillText(winner, 600, 290, 1060);
  ctx.font = "24px sans-serif";
  ctx.fillText(e.config.title, 600, 350, 1060);
  ctx.fillStyle = "#d4af37";
  ctx.fillText("THE ENTIRE PRIZE POOL", 600, 440);
  ctx.fillStyle = "#dbe3ee";
  ctx.font = "22px sans-serif";
  e.prizes.forEach((p, i) =>
    ctx.fillText(`${p.quantity} × ${p.name}`, 600, 495 + i * 32),
  );
  ctx.font = "18px sans-serif";
  ctx.fillText(
    `${e.original.filter((p) => p.enabled).length} participants · ${e.results.length} rounds · ${Math.round(((e.finishedAt ?? Date.now()) - (e.startedAt ?? Date.now())) / 60000)} minutes`,
    600,
    canvas.height - 120,
  );
  ctx.fillText(
    "Rewards recorded for distribution by the host.",
    600,
    canvas.height - 80,
  );
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r));
  if (blob) download("heavenly-fate-champion.png", blob);
}
export function validateBackup(input: unknown): {
  state: State;
  assets: { id: string; data: string }[];
} {
  const envelope = z.object({
    state: stateSchema,
    assets: z
      .array(
        z.object({
          id: z.string(),
          data: z
            .string()
            .max(30e6)
            .regex(
              /^data:(image\/(png|jpeg|webp|gif)|audio\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/=]+$/,
            ),
        }),
      )
      .max(1000),
  });
  return envelope.parse(input);
}

export function eventAnnouncement(e: FateEvent) {
  return `${e.test ? "[TEST EVENT]\n" : ""}# ☯ ${e.config.title}\n${e.config.organization}\n\nMode: ${e.config.mode}\nParticipants: ${e.participants.filter((p) => p.enabled).length}\nEqual chances for every eligible entry.\n\nPRIZE POOL\n${e.prizes.map((p) => `${p.quantity} × ${p.name}`).join("\n")}\n\nRULES\n${e.config.rules}`;
}
