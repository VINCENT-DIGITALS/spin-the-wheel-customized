import type { State } from "../types";
import { eventSchema } from "../types";
import { defaultEvent, defaults } from "../data/defaults";
import { audit, editable } from "../engine/event";
import { demo, recovery, update } from "../services/store";
import { exportAssets, importAssets, clearAssets } from "../services/assets";
import {
  announcement,
  eventAnnouncement,
  download,
  json,
  resultCSV,
  validateBackup,
} from "../services/export";
import { Panel, Field } from "../components/ui";
import type { Run } from "../components/EventView";
export function DataSettings({
  state,
  run,
  general = false,
}: {
  state: State;
  run: Run;
  general?: boolean;
}) {
  const canReplace =
    editable(state.event) ||
    ["Completed", "Cancelled"].includes(state.event.status);
  const fresh = () => {
    if (
      confirm(
        "Create a fresh event? The current draft is replaced; archived events remain.",
      )
    )
      run(() =>
        update((s) => {
          if (
            !editable(s.event) &&
            !["Completed", "Cancelled"].includes(s.event.status)
          )
            throw Error("Finish or cancel the current event first.");
          s.event = defaultEvent(demo);
          s.removed = [];
        }),
      );
  };
  return (
    <div className="two-columns">
      <Panel
        title={general ? "Local storage and recovery" : "Portable backups"}
      >
        <p>
          Everything is stored on this device. Download a full backup before
          clearing browser data or moving to another computer.
        </p>
        <div className="button-row">
          <button
            className="primary"
            onClick={() =>
              run(async () =>
                json("heavenly-fate-backup.json", {
                  state,
                  assets: await exportAssets(),
                }),
              )
            }
          >
            Download full backup
          </button>
          <button onClick={() => download("recovery-data.json", recovery())}>
            Export raw recovery data
          </button>
        </div>
        <Field label="Restore a full backup">
          <input
            type="file"
            accept=".json"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f)
                run(async () => {
                  if (f.size > 100 * 1024 * 1024)
                    throw Error("Backup exceeds 100 MB.");
                  const backup = validateBackup(JSON.parse(await f.text()));
                  if (
                    backup.state.event.test !== demo ||
                    backup.state.history.some((e) => e.test !== demo)
                  )
                    throw Error(
                      "Demo and official records must be restored in their matching workspace.",
                    );
                  if (
                    !confirm(
                      "Replace all current settings, event and history with this backup?",
                    )
                  )
                    return;
                  await importAssets(backup.assets);
                  await update((s) => Object.assign(s, backup.state), true);
                });
              ev.target.value = "";
            }}
          />
        </Field>
        <p className="muted">
          Backups are validated before replacement. Version 1 is supported.
          Unknown versions are rejected without discarding existing data.
          Restoring an active event preserves its determined result and
          timestamps.
        </p>
      </Panel>
      <Panel title={general ? "Event lifecycle" : "Configurations and results"}>
        <div className="button-row">
          <button disabled={!canReplace} onClick={fresh}>
            New event with defaults
          </button>
          <button
            onClick={() =>
              json("event-configuration.json", {
                ...state.event,
                status: "Draft",
                original: [],
                results: [],
                winners: [],
                spin: null,
                nextAt: null,
                startedAt: null,
                finishedAt: null,
                audit: [],
                participants: state.event.original.length
                  ? state.event.original
                  : state.event.participants,
              })
            }
          >
            Export event configuration
          </button>
        </div>
        <Field label="Import event configuration">
          <input
            disabled={!canReplace}
            type="file"
            accept=".json"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f)
                run(async () => {
                  const imported = eventSchema.parse(
                    JSON.parse(await f.text()),
                  );
                  if (
                    confirm(
                      "Replace the current draft with this configuration?",
                    )
                  )
                    await update((s) => {
                      if (
                        !editable(s.event) &&
                        !["Completed", "Cancelled"].includes(s.event.status)
                      )
                        throw Error("Cancel or complete the event first.");
                      s.event = {
                        ...defaultEvent(demo),
                        config: imported.config,
                        participants: imported.participants.map((p) => ({
                          ...p,
                          lives: 1,
                        })),
                        prizes: imported.prizes,
                      };
                      s.event.config.scheduledAt = null;
                      audit(s.event, "Imported event configuration");
                    });
                });
              ev.target.value = "";
            }}
          />
        </Field>
        <div className="button-row">
          <button onClick={() => json("event-results.json", state.event)}>
            Results JSON
          </button>
          <button
            onClick={() =>
              download("event-results.csv", resultCSV(state.event), "text/csv")
            }
          >
            Results CSV
          </button>
          <button onClick={() => json("event-audit.json", state.event.audit)}>
            Audit JSON
          </button>
          <button
            onClick={() =>
              run(() =>
                navigator.clipboard.writeText(
                  state.event.status === "Completed"
                    ? announcement(state.event)
                    : eventAnnouncement(state.event),
                ),
              )
            }
          >
            Copy Discord announcement
          </button>
          <button
            onClick={() =>
              run(() =>
                navigator.clipboard.writeText(
                  state.event.results
                    .map(
                      (r) =>
                        `${r.round}. ${r.name} — ${r.eliminated ? "eliminated" : "selected / life lost"}`,
                    )
                    .join("\n"),
                ),
              )
            }
          >
            Copy round results
          </button>
        </div>
        {general && (
          <>
            <hr />
            <h3>Factory reset</h3>
            <p>
              Deletes this workspace’s events, history, presets and settings.
              Uploaded assets in this workspace are also removed.
            </p>
            <button
              className="danger"
              onClick={() => {
                if (
                  confirm(
                    `Permanently reset all ${demo ? "demo" : "official"} data? Download a backup first.`,
                  )
                )
                  run(async () => {
                    await update((s) => Object.assign(s, defaults(demo)), true);
                    await clearAssets();
                  });
              }}
            >
              Factory reset
            </button>
          </>
        )}
      </Panel>
    </div>
  );
}
export function Help({ state }: { state: State }) {
  return (
    <div className="page-stack">
      <div className="two-columns">
        <Panel title="Host your first event">
          <ol className="help-list">
            <li>
              Review Participants and Prize Pool. Each enabled person gets
              exactly one entry.
            </li>
            <li>
              Choose your mode and timing in Event Configuration. Default: nine
              30-minute spins and eight 10-second intervals, totaling 4:31:20.
            </li>
            <li>Try the separate demo workspace with five-second rounds.</li>
            <li>
              Open Audience Presentation in a second tab. Share that tab or
              window in Discord.
            </li>
            <li>
              Begin the event. Entries, prizes and timing lock. Pause or resume
              at any time.
            </li>
            <li>
              After completion, copy the announcement and download results or
              the champion image.
            </li>
          </ol>
        </Panel>
        <Panel title="Timing and recovery">
          <p>
            Each spin stores its selected participant and timing before the
            wheel begins. A timestamp determines completion; animation frames do
            not count down the event.
          </p>
          <p>
            Refreshes, background tabs and computer sleep preserve the result.
            On reopening, an expired spin is completed once. The next automatic
            round starts when a host is running; missed rounds are not silently
            simulated. Between-round deadlines resume after reopening.
          </p>
          <p>
            A powered-off computer cannot execute the app. Scheduled starts and
            automatic rounds require an open host; missed schedules begin on
            reopening. Paused time does not count toward a spin.
          </p>
          <p>
            Keep system time correct. Changing the computer clock can change
            elapsed wall-clock timing.
          </p>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel title="Fairness and privacy">
          <p>
            Selection uses Web Crypto with rejection sampling. No hidden
            weighting, contribution advantage, or host-selected winner is
            implemented.
          </p>
          <p>
            The selected result is saved before animation. Browser Web Locks
            serialize changes across host tabs, and BroadcastChannel plus
            storage events keep audience views updated.
          </p>
          <p>
            This is a client-side application, not a tamper-proof service.
            Someone with source-code or browser-storage access can modify data.
            Audit records provide transparency, not independent proof.
          </p>
          <p>
            Audience sync works in the same browser profile and origin. Remote
            viewers watch Discord screen sharing; they do not connect directly
            to local state.
          </p>
          <p>
            Assets and records stay on your device. Offline use is available
            after the first successful production load. Updates activate after
            all app tabs close.
          </p>
        </Panel>
        <Panel title="Event rules">
          <ol>
            {state.event.config.rules
              .split("\n")
              .filter(Boolean)
              .map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
          </ol>
        </Panel>
      </div>
      <Panel title="Accessibility and shortcuts">
        <p>
          All controls support keyboard navigation. Use Tab to move focus, Enter
          or Space to activate buttons, and Escape to exit fullscreen.
          Reduced-motion preferences disable decorative animations. Native
          confirmation dialogs protect destructive actions.
        </p>
        <p>
          Browser storage is finite. Saving errors stop state changes and show a
          message; export a backup before removing data. Keep backups outside
          the browser. For missing or corrupted data, export raw recovery data
          before resetting.
        </p>
      </Panel>
    </div>
  );
}
