import type { State, Appearance } from "../types";
import { defaults } from "../data/defaults";
import { update } from "../services/store";
import { play, unlock, syncMusic } from "../services/audio";
import { AssetInput, Field, Panel, Toggle } from "../components/ui";
import { Wheel } from "../components/Wheel";
import type { Run } from "../components/EventView";
export function AppearancePage({ state, run }: { state: State; run: Run }) {
  const a = state.appearance;
  const patch = (v: Partial<Appearance>) =>
    run(() =>
      update((s) => {
        Object.assign(s.appearance, v);
      }),
    );
  return (
    <div className="two-columns">
      <div className="page-stack">
        <Panel title="Your celestial signature">
          <Field label="Application title">
            <input
              key={a.appTitle}
              defaultValue={a.appTitle}
              onBlur={(e) => patch({ appTitle: e.target.value })}
            />
          </Field>
          <Field label="Sect name">
            <input
              key={a.sect}
              defaultValue={a.sect}
              onBlur={(e) => patch({ sect: e.target.value })}
            />
          </Field>
          <Field label="Theme">
            <select
              value={a.theme}
              onChange={(e) =>
                patch({ theme: e.target.value as Appearance["theme"] })
              }
            >
              {[
                "Heavenly",
                "Demonic",
                "Celestial",
                "Minimal Dark",
                "Minimal Light",
                "Custom",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <div className="two-columns">
            <Field label="Custom accent">
              <input
                type="color"
                value={a.accent}
                onChange={(e) => patch({ accent: e.target.value })}
              />
            </Field>
            <Field label="Custom background">
              <input
                type="color"
                value={a.background}
                onChange={(e) => patch({ background: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Typography">
            <select
              value={a.font}
              onChange={(e) =>
                patch({ font: e.target.value as Appearance["font"] })
              }
            >
              <option value="sans">Modern system sans</option>
              <option value="serif">Classic serif</option>
            </select>
          </Field>
          <Field label="Audience layout">
            <select
              value={a.audienceLayout}
              onChange={(e) =>
                patch({
                  audienceLayout: e.target
                    .value as Appearance["audienceLayout"],
                })
              }
            >
              <option value="balanced">Balanced · wheel and details</option>
              <option value="wheel">Wheel focus</option>
            </select>
          </Field>
          <Toggle
            label="Show participant avatars"
            value={a.showAvatars}
            onChange={(v) => patch({ showAvatars: v })}
          />
          <Toggle
            label="Show Discord usernames"
            value={a.showDiscord}
            onChange={(v) => patch({ showDiscord: v })}
          />
          <button
            onClick={() => {
              if (confirm("Reset appearance to defaults?"))
                patch(defaults().appearance);
            }}
          >
            Reset appearance
          </button>
        </Panel>
        <Panel title="Custom imagery">
          {(
            [
              "logo",
              "centerpiece",
              "backgroundImage",
              "wheelBackground",
            ] as const
          ).map((key, i) => (
            <AssetInput
              key={key}
              label={
                [
                  "Organization logo",
                  "Wheel centerpiece",
                  "Background image",
                  "Wheel background",
                ][i]
              }
              value={a[key]}
              onChange={(id) => patch({ [key]: id })}
              onError={(err) =>
                run(() => {
                  throw err;
                })
              }
            />
          ))}
        </Panel>
      </div>
      <div className="page-stack">
        <Panel title="Live preview">
          <Wheel event={state.event} appearance={a} />
          <p className="muted">
            Segment colors are editable in Participants before the event starts.
          </p>
        </Panel>
        <Panel title="Motion and atmosphere">
          <Field
            label={`Animation intensity · ${Math.round(a.intensity * 100)}%`}
          >
            <input
              type="range"
              min="0"
              max="1"
              step=".1"
              value={a.intensity}
              onChange={(e) => patch({ intensity: Number(e.target.value) })}
            />
          </Field>
          <div className="toggle-grid">
            {Object.entries(a.effects).map(([key, value]) => (
              <Toggle
                key={key}
                label={key}
                value={value}
                onChange={(v) => patch({ effects: { ...a.effects, [key]: v } })}
              />
            ))}
          </div>
          <p className="muted">
            Reduced-motion preferences override decorative motion. Visual
            effects use soft glows without flashing.
          </p>
        </Panel>
      </div>
    </div>
  );
}
export function AudioPage({ state, run }: { state: State; run: Run }) {
  const a = state.audio;
  const patch = (v: Partial<State["audio"]>) =>
    run(async () => {
      await unlock();
      await update((s) => {
        Object.assign(s.audio, v);
      });
      await syncMusic({ ...a, ...v });
    });
  return (
    <div className="two-columns">
      <Panel title="Soundscape">
        <Toggle
          label="Mute all audio"
          value={a.muted}
          onChange={(v) => patch({ muted: v })}
        />
        {(["master", "music", "effects"] as const).map((k) => (
          <Field key={k} label={`${k} volume · ${Math.round(a[k] * 100)}%`}>
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={a[k]}
              onChange={(e) => patch({ [k]: Number(e.target.value) })}
            />
          </Field>
        ))}
        <Toggle
          label="Play audio in audience view instead of host"
          value={a.audience}
          onChange={(v) => patch({ audience: v })}
        />
        <p className="muted">
          Audio starts after a click. Only one tab plays event sounds, using a
          browser lock. Enable presentation audio in the audience window if
          selected.
        </p>
        <div className="toggle-grid">
          {Object.entries(a.enabled).map(([k, v]) => (
            <div key={k}>
              <Toggle
                label={k}
                value={v}
                onChange={(value) =>
                  patch({ enabled: { ...a.enabled, [k]: value } })
                }
              />
              <button
                onClick={() =>
                  run(async () => {
                    await unlock();
                    await play(
                      k,
                      {
                        ...a,
                        muted: false,
                        enabled: { ...a.enabled, [k]: true },
                      },
                      a.audience,
                    );
                  })
                }
              >
                Preview {k}
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Your own audio">
        <AssetInput
          audio
          label="Custom effect (replaces synthesized effects)"
          value={a.custom}
          onChange={(id) => patch({ custom: id })}
          onError={(err) =>
            run(() => {
              throw err;
            })
          }
        />
        <AssetInput
          audio
          label="Looping background music"
          value={a.musicAsset}
          onChange={(id) => patch({ musicAsset: id })}
          onError={(err) =>
            run(() => {
              throw err;
            })
          }
        />
        <button
          onClick={() =>
            run(async () => {
              await unlock();
              await syncMusic({ ...a, muted: false }, a.audience);
            })
          }
        >
          Preview background music
        </button>
        <button onClick={() => run(() => syncMusic({ ...a, muted: true }))}>
          Stop music
        </button>
        <p className="muted">
          Built-in effects are generated locally with Web Audio. Uploaded media
          stays in this browser’s IndexedDB and is included in full backups.
        </p>
      </Panel>
    </div>
  );
}
