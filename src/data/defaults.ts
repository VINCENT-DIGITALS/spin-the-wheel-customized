import type { State, FateEvent, Participant } from "../types";
export const colors = [
  "#466da5",
  "#926c3d",
  "#665496",
  "#337c80",
  "#9a5363",
  "#3d638c",
  "#788552",
  "#8a634c",
  "#536690",
  "#765c7f",
];
export const names = [
  "@zerochance8629",
  "@yanyan0o7",
  "@xclsv.divs",
  "@acep12kechil7921",
  "@coresotufff",
  "@_shad0w_2",
  "@godtraveler",
  "@coolmannya",
  "@sumtingwong584_66123",
  "@_nedyh",
];
export const participant = (name: string, index = 0): Participant => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  discord: name.trim(),
  enabled: true,
  lives: 1,
  avatar: "",
  color: colors[index % colors.length],
});
export const rules = `The entry period is officially closed.
The original 500K SS and 500K Gold requirements were intended to identify participants who would follow the event instructions.
Anyone who submitted their contribution is eligible, regardless of the amount donated.
Every eligible participant receives one entry.
Contribution amount does not influence their chances.
Each round randomly eliminates one participant.
Eliminated participants cannot return to the event.
The last remaining participant wins the entire prize pool.
The event results and elimination history will be recorded for transparency.
This event does not affect the sect's actual contribution rankings.`;
export const announcement =
  "# 🏆 {title} — GRAND CHAMPION\n\nThe heavens have decided!\n\nCongratulations to {winner} for becoming our HEAVENLY FATE CHAMPION!\n\nYou have won the ENTIRE prize pool!\n\n{prizes}\n\nThank you to everyone who participated and contributed to our sect.\nMay the heavens continue to favor you! ☯️";
export function defaultEvent(test = false): FateEvent {
  return {
    id: crypto.randomUUID(),
    test,
    status: "Draft",
    config: {
      title: "Wheel of Heavenly Fate",
      organization: "Heavenly Order Sect",
      mode: "elimination",
      duration: test ? 5000 : 1800000,
      roundDurations: [],
      interval: test ? 1000 : 10000,
      deceleration: 8000,
      auto: true,
      confirmRound: false,
      lives: 3,
      winnerCount: 1,
      removeWinners: true,
      rules,
      announcement,
      scheduledAt: null,
    },
    participants: names.map(participant),
    prizes: [
      "Heavenly Peach Brew",
      "Heaven Howl Pill",
      "Spirit Spring Brew",
      "YinYang Harmony Pill",
      "Marrow Washing Pill",
      "Foundation Building Pill",
      "Bone Forging Pills",
      "Core Condensing Pill",
      "Heaven Defying Pill",
      "Phoenix Rebirth",
      "Heaven Orchard Peach",
    ].map((name, i) => ({
      id: crypto.randomUUID(),
      name,
      quantity: [2, 5, 50, 30, 50, 50, 50, 50, 40, 20, 3][i],
      description: "",
      rarity: i < 2 ? "Legendary" : "Rare",
      image: "",
    })),
    original: [],
    results: [],
    winners: [],
    spin: null,
    nextAt: null,
    startedAt: null,
    finishedAt: null,
    audit: [],
  };
}
export function defaults(test = false): State {
  return {
    version: 1,
    revision: 0,
    event: defaultEvent(test),
    history: [],
    removed: [],
    participantPresets: {},
    prizePresets: {},
    appearance: {
      appTitle: "Wheel of Heavenly Fate",
      sect: "Heavenly Order Sect",
      theme: "Heavenly",
      accent: "#d4af37",
      background: "#0b1220",
      logo: "",
      centerpiece: "",
      backgroundImage: "",
      wheelBackground: "",
      font: "sans",
      intensity: 0.6,
      effects: Object.fromEntries(
        [
          "wheel",
          "pointer",
          "announcement",
          "segment removal",
          "lightning",
          "tribulation",
          "particles",
          "confetti",
          "champion",
          "countdown",
          "transitions",
          "showdown",
          "celebration",
        ].map((k) => [k, true]),
      ),
      showAvatars: true,
      showDiscord: false,
      audienceLayout: "balanced",
    },
    audio: {
      muted: true,
      master: 0.6,
      music: 0.25,
      effects: 0.6,
      enabled: Object.fromEntries(
        [
          "tick",
          "start",
          "countdown",
          "suspense",
          "elimination",
          "lightning",
          "transition",
          "victory",
        ].map((k) => [k, true]),
      ),
      custom: "",
      musicAsset: "",
      audience: false,
    },
  };
}
