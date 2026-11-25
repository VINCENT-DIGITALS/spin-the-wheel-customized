import type { State } from "../types";
import { getAsset } from "./assets";
let context: AudioContext | undefined;
let custom: AudioBuffer | undefined;
let customId = "";
let music: HTMLAudioElement | undefined;
let musicId = "";
let musicUrl = "";
const effectGains = new Set<GainNode>();
export async function unlock() {
  context ??= new AudioContext();
  await context.resume();
}
export async function play(
  kind: string,
  settings: State["audio"],
  audience = false,
) {
  if (
    settings.muted ||
    !settings.enabled[kind] ||
    settings.audience !== audience ||
    !context ||
    context.state !== "running"
  )
    return;
  const gain = context.createGain();
  gain.gain.value = settings.master * settings.effects * 0.15;
  gain.connect(context.destination);
  effectGains.add(gain);
  if (settings.custom) {
    if (customId !== settings.custom) {
      const blob = await getAsset(settings.custom);
      if (blob) {
        custom = await context.decodeAudioData(await blob.arrayBuffer());
        customId = settings.custom;
      }
    }
    if (custom) {
      const source = context.createBufferSource();
      source.buffer = custom;
      source.connect(gain);
      source.onended = () => {
        gain.disconnect();
        effectGains.delete(gain);
      };
      source.start();
      return;
    }
  }
  const notes: Record<string, number[]> = {
    start: [220, 330, 440],
    tick: [700],
    countdown: [440],
    suspense: [330, 440],
    elimination: [220, 164, 110],
    lightning: [90, 65],
    transition: [330, 440],
    victory: [262, 330, 392, 523, 659],
  };
  (notes[kind] ?? [440]).forEach((frequency, i) => {
    const oscillator = context!.createOscillator();
    const envelope = context!.createGain();
    const start = context!.currentTime + i * 0.14;
    oscillator.type = kind === "lightning" ? "sawtooth" : "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    oscillator.connect(envelope);
    envelope.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + 0.26);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  });
  setTimeout(() => {
    gain.disconnect();
    effectGains.delete(gain);
  }, 2000);
}
export async function syncMusic(settings: State["audio"], audience = false) {
  for (const gain of effectGains)
    gain.gain.value =
      settings.muted || settings.audience !== audience
        ? 0
        : settings.master * settings.effects * 0.15;
  if (
    !settings.musicAsset ||
    settings.muted ||
    settings.audience !== audience
  ) {
    music?.pause();
    return;
  }
  if (musicId !== settings.musicAsset) {
    music?.pause();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    const blob = await getAsset(settings.musicAsset);
    if (!blob) return;
    musicUrl = URL.createObjectURL(blob);
    music = new Audio(musicUrl);
    music.loop = true;
    musicId = settings.musicAsset;
  }
  if (music) {
    music.volume = settings.master * settings.music;
    await music.play().catch(() => {});
  }
}
