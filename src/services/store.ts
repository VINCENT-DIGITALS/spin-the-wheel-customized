import { useSyncExternalStore } from "react";
import { defaults } from "../data/defaults";
import { stateSchema, type State } from "../types";
const isDemo = new URLSearchParams(location.search).get("demo") === "1";
const KEY = `heavenly-fate-v1${isDemo ? "-demo" : ""}`;
let error = "";
let pending = 0;
let failed = false;
const initial = defaults(isDemo);
function read(): State {
  const raw = localStorage.getItem(KEY);
  if (!raw) return initial;
  try {
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    error =
      "Stored data is invalid. It has been preserved. Export recovery data or restore a valid backup before continuing.";
    throw Error(error);
  }
}
let state: State;
try {
  state = read();
} catch {
  state = defaults(isDemo);
}
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(KEY) : null;
const emit = () => listeners.forEach((fn) => fn());
function reload() {
  try {
    const next = read();
    if (next.revision !== state.revision) {
      state = next;
      emit();
    }
  } catch {
    emit();
  }
}
channel?.addEventListener("message", reload);
window.addEventListener("storage", (e) => {
  if (e.key === KEY) reload();
});
export function useStore() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}
export function useSaveStatus() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => (pending ? "Saving…" : failed ? "Save failed" : "Saved locally"),
  );
}
export const storageError = () => error;
export const recovery = () => localStorage.getItem(KEY) ?? "";
export async function update(change: (draft: State) => void, replace = false) {
  if (!navigator.locks)
    throw Error(
      "This browser requires Web Locks support for safe hosting. Use a current Chrome, Edge, Firefox, or Safari.",
    );
  pending++;
  emit();
  try {
    return await navigator.locks.request(KEY, () => {
      if (error && !replace) throw Error(error);
      const before = replace ? state : read();
      const next = structuredClone(before);
      change(next);
      next.event.test = isDemo;
      const validated = stateSchema.parse(next);
      validated.revision = Math.max(state.revision, before.revision) + 1;
      try {
        localStorage.setItem(KEY, JSON.stringify(validated));
      } catch {
        throw Error(
          "Saving failed: browser storage may be full. Export a backup and free storage. No action was committed.",
        );
      }
      failed = false;
      state = validated;
      error = "";
      emit();
      channel?.postMessage(validated.revision);
    });
  } catch (err) {
    failed = true;
    throw err;
  } finally {
    pending--;
    emit();
  }
}
export const demo = isDemo;
