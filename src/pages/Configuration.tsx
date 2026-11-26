import { useState } from "react";
import { Clock3, LockKeyhole } from "lucide-react";
import type { State, Config } from "../types";
import { audit, editable, estimate, editAsDraft } from "../engine/event";
import { formatTime } from "../engine/timer";
import { update } from "../services/store";
import { Duration, Field, Panel, Toggle } from "../components/ui";
import type { Run } from "../components/EventView";
export function Configuration({ state, run }: { state: State; run: Run }) {
  const [section, setSection] = useState("basics");
  const e = state.event,
    c = e.config,
    locked = !editable(e);
  const patch = (values: Partial<Config>) =>
    run(() =>
      update((s) => {
        if (!editable(s.event)) throw Error("Event configuration is locked.");
        Object.assign(s.event.config, values);
        audit(
          s.event,
          `Configuration updated: ${Object.keys(values).join(", ")}`,
        );
      }),
    );
  return (
    <div className="page-stack configuration-page" data-section={section}>
      <div
        className="configuration-tabs"
        role="tablist"
        aria-label="Configuration sections"
      >
        {["basics", "rounds", "rules", "announcement"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={section === t}
            onClick={() => setSection(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {locked && (
        <div className="notice">
          <LockKeyhole size={17} />
          {e.status === "Paused"
            ? "Pause keeps the current spin locked."
            : "This event is locked."}
          <button
            onClick={() => {
              if (
                !["Completed", "Cancelled"].includes(e.status) &&
                !confirm(
                  "Stop this event and edit? This run will be archived and a new draft will keep your settings.",
                )
              )
                return;
              run(() => update((s) => editAsDraft(s)));
            }}
          >
            {["Completed", "Cancelled"].includes(e.status)
              ? "Edit configuration"
              : "Stop & edit settings"}
          </button>
        </div>
      )}
      <div className="two-columns configuration-basics">
        <Panel title="Event identity">
          <Field label="Event title">
            <input
              disabled={locked}
              defaultValue={c.title}
              onBlur={(ev) => {
                if (ev.target.value !== c.title)
                  patch({ title: ev.target.value });
              }}
            />
          </Field>
          <Field label="Organization">
            <input
              disabled={locked}
              defaultValue={c.organization}
              onBlur={(ev) => {
                if (ev.target.value !== c.organization)
                  patch({ organization: ev.target.value });
              }}
            />
          </Field>
          <Field label="Game mode">
            <select
              disabled={locked}
              value={c.mode}
              onChange={(ev) =>
                patch({ mode: ev.target.value as Config["mode"] })
              }
            >
              <option value="elimination">
                Elimination · last contender wins
              </option>
              <option value="winner">Winner selection · choose a winner</option>
              <option value="survival">Survival · multiple lives</option>
            </select>
          </Field>
          {c.mode === "survival" && (
            <Field label="Starting lives">
              <input
                disabled={locked}
                type="number"
                min="1"
                max="100"
                value={c.lives}
                onChange={(ev) => patch({ lives: Number(ev.target.value) })}
              />
            </Field>
          )}
          {c.mode === "winner" && (
            <>
              <Field label="Number of winners">
                <input
                  disabled={locked}
                  type="number"
                  min="1"
                  value={c.winnerCount}
                  onChange={(ev) =>
                    patch({ winnerCount: Number(ev.target.value) })
                  }
                />
              </Field>
              <Toggle
                disabled={locked}
                label="Remove selected winners from future draws"
                value={c.removeWinners}
                onChange={(v) => patch({ removeWinners: v })}
              />
            </>
          )}
          <p className="muted">
            All enabled participants have equal odds in each draw. Retaining
            winners permits repeat selections.
          </p>
        </Panel>
        <Panel title="The rhythm of fate">
          <Duration
            disabled={locked}
            value={c.duration}
            onChange={(v) => patch({ duration: v })}
          />
          <div className="presets">
            {[
              5, 10, 30, 60, 300, 600, 1800, 3600, 7200, 21600, 43200, 86400,
            ].map((s) => (
              <button
                disabled={locked}
                className={c.duration === s * 1000 ? "selected" : ""}
                key={s}
                onClick={() => patch({ duration: s * 1000 })}
              >
                {s < 60 ? `${s}s` : s < 3600 ? `${s / 60}m` : `${s / 3600}h`}
              </button>
            ))}
          </div>
          <Field label="Final deceleration (seconds)">
            <input
              disabled={locked}
              type="number"
              min=".1"
              value={c.deceleration / 1000}
              onChange={(ev) =>
                patch({ deceleration: Number(ev.target.value) * 1000 })
              }
            />
          </Field>
          <div className="notice">
            <Clock3 size={17} />
            {formatTime(estimate(e))} estimated event duration
            {c.mode === "survival" ? " (maximum)" : ""}
          </div>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel title="Round flow" className="configuration-rounds">
          <Toggle
            disabled={locked}
            label="Automatically start the next round"
            value={c.auto}
            onChange={(v) => patch({ auto: v })}
          />
          <Toggle
            disabled={locked}
            label="Require confirmation before each next round"
            value={c.confirmRound}
            onChange={(v) => patch({ confirmRound: v })}
          />
          <Field label="Interval between rounds (seconds)">
            <input
              disabled={locked}
              type="number"
              min="0"
              value={c.interval / 1000}
              onChange={(ev) =>
                patch({ interval: Number(ev.target.value) * 1000 })
              }
            />
          </Field>
          <Field
            label="Per-round durations in seconds"
            hint="Optional comma-separated durations; remaining rounds use the default."
          >
            <textarea
              disabled={locked}
              defaultValue={c.roundDurations.map((v) => v / 1000).join(", ")}
              onBlur={(ev) =>
                patch({
                  roundDurations: ev.target.value.trim()
                    ? ev.target.value
                        .split(",")
                        .map((v) => Number(v.trim()) * 1000)
                    : [],
                })
              }
            />
          </Field>
          <Field
            label="Scheduled start (local time)"
            hint="The app must be running. A missed start begins when reopened."
          >
            <input
              disabled={locked}
              type="datetime-local"
              onChange={(ev) =>
                patch({
                  scheduledAt: ev.target.value
                    ? new Date(ev.target.value).getTime()
                    : null,
                })
              }
            />
          </Field>
          {c.scheduledAt && <p>{new Date(c.scheduledAt).toLocaleString()}</p>}
          <div className="button-row">
            <button
              disabled={locked}
              onClick={() =>
                run(() =>
                  update((s) => {
                    if (!editable(s.event)) throw Error("Event is locked.");
                    s.event.status = "Ready";
                    audit(s.event, "Event marked ready");
                  }),
                )
              }
            >
              Mark ready
            </button>
            <button
              disabled={locked || !c.scheduledAt}
              onClick={() =>
                run(() =>
                  update((s) => {
                    if (!editable(s.event) || !s.event.config.scheduledAt)
                      throw Error("Choose a start time first.");
                    if (
                      s.event.participants.filter((p) => p.enabled).length < 2
                    )
                      throw Error("Enable at least two participants.");
                    s.event.status = "Scheduled";
                    audit(s.event, "Event scheduled");
                  }),
                )
              }
            >
              Schedule event
            </button>
          </div>
        </Panel>
        <Panel title="Event rules" className="configuration-rules">
          <Field label="Rules shown in documentation and exports">
            <textarea
              rows={12}
              disabled={locked}
              defaultValue={c.rules}
              onBlur={(ev) => {
                if (ev.target.value !== c.rules)
                  patch({ rules: ev.target.value });
              }}
            />
          </Field>
        </Panel>
      </div>
      <Panel
        title="Champion announcement"
        className="configuration-announcement"
      >
        <Field
          label="Discord announcement template"
          hint="Available tokens: {title}, {winner}, {prizes}"
        >
          <textarea
            rows={10}
            disabled={locked}
            defaultValue={c.announcement}
            onBlur={(ev) => {
              if (ev.target.value !== c.announcement)
                patch({ announcement: ev.target.value });
            }}
          />
        </Field>
      </Panel>
    </div>
  );
}
