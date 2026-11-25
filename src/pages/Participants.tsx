import { useState } from "react";
import {
  Plus,
  Trash2,
  Shuffle,
  Download,
  Upload,
  Search,
  Undo2,
  LockKeyhole,
} from "lucide-react";
import type { State } from "../types";
import { participant } from "../data/defaults";
import { editable, audit } from "../engine/event";
import { shuffle } from "../engine/random";
import { update } from "../services/store";
import {
  csv,
  download,
  json,
  mergeParticipants,
  parseParticipants,
} from "../services/export";
import { AssetInput, Field, Panel, Toggle } from "../components/ui";
import type { Run } from "../components/EventView";
export function Participants({ state, run }: { state: State; run: Run }) {
  const [bulk, setBulk] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const e = state.event;
  const locked = !editable(e);
  const add = (text: string, ext = "txt") =>
    run(() =>
      update((s) => {
        if (!editable(s.event)) throw Error("Participants are locked.");
        const merged = mergeParticipants(
          s.event.participants,
          parseParticipants(text, ext),
        );
        s.event.participants = merged.participants;
        setMessage(
          `${merged.participants.length - e.participants.length} added · ${merged.duplicates} duplicates skipped`,
        );
        audit(s.event, "Participant list updated");
        setBulk("");
      }),
    );
  const patch = (
    id: string,
    values: Partial<State["event"]["participants"][number]>,
  ) =>
    run(() =>
      update((s) => {
        if (!editable(s.event)) throw Error("Participants are locked.");
        const p = s.event.participants.find((p) => p.id === id);
        if (p) Object.assign(p, values);
        const names = s.event.participants.map((p) =>
          p.name.toLowerCase().replace(/^@/, ""),
        );
        if (new Set(names).size !== names.length)
          throw Error("That participant already exists.");
        audit(s.event, "Participant edited");
      }),
    );
  return (
    <div className="page-stack">
      {locked && (
        <div className="notice">
          <LockKeyhole size={17} />
          Participants are locked for this event. Start a new event to edit
          entries.
        </div>
      )}
      <div className="two-columns">
        <Panel title="Invite your contenders">
          <Field label="Add names · one per line">
            <textarea
              placeholder="@discord_username"
              value={bulk}
              onChange={(ev) => setBulk(ev.target.value)}
              disabled={locked}
              rows={5}
            />
          </Field>
          <div className="button-row">
            <button
              className="primary"
              disabled={locked || !bulk.trim()}
              onClick={() => add(bulk)}
            >
              <Plus size={16} />
              Add participants
            </button>
            <label className={`button ${locked ? "disabled" : ""}`}>
              <Upload size={16} />
              Import CSV / TXT / JSON
              <input
                hidden
                type="file"
                accept=".csv,.txt,.json"
                disabled={locked}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f)
                    run(async () =>
                      add(await f.text(), f.name.split(".").pop()),
                    );
                  ev.target.value = "";
                }}
              />
            </label>
          </div>
          <p role="status" className="muted">
            {message ||
              "Names are checked for duplicates, ignoring @ and letter case."}
          </p>
        </Panel>
        <Panel title="Reusable participant lists">
          <div className="button-row">
            <button
              disabled={locked}
              onClick={() => {
                const name = prompt("Name this participant preset");
                if (name)
                  run(() =>
                    update((s) => {
                      s.participantPresets[name] = structuredClone(
                        s.event.participants,
                      );
                    }),
                  );
              }}
            >
              Save preset
            </button>
            <select
              aria-label="Load participant preset"
              disabled={locked}
              value=""
              onChange={(ev) => {
                const name = ev.target.value;
                run(() =>
                  update((s) => {
                    if (!editable(s.event))
                      throw Error("Participants are locked.");
                    s.event.participants = structuredClone(
                      s.participantPresets[name],
                    );
                    audit(s.event, `Loaded participant preset: ${name}`);
                  }),
                );
              }}
            >
              <option value="">Load a preset…</option>
              {Object.keys(state.participantPresets).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="button-row">
            <button
              onClick={() =>
                download(
                  "participants.csv",
                  csv([
                    ["name", "discord"],
                    ...e.participants.map((p) => [p.name, p.discord]),
                  ]),
                  "text/csv",
                )
              }
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={() =>
                download(
                  "participants.txt",
                  e.participants.map((p) => p.name).join("\n"),
                  "text/plain",
                )
              }
            >
              TXT
            </button>
            <button onClick={() => json("participants.json", e.participants)}>
              JSON
            </button>
            <button
              disabled={locked}
              onClick={() =>
                run(() =>
                  update((s) => {
                    if (!editable(s.event))
                      throw Error("Participants are locked.");
                    s.event.participants = shuffle(s.event.participants);
                    audit(s.event, "Participant order securely shuffled");
                  }),
                )
              }
            >
              <Shuffle size={16} />
              Shuffle
            </button>
            <button
              disabled={locked || !state.removed.length}
              onClick={() =>
                run(() =>
                  update((s) => {
                    if (!editable(s.event))
                      throw Error("Participants are locked.");
                    const p = s.removed.pop();
                    if (p)
                      s.event.participants = mergeParticipants(
                        s.event.participants,
                        [p],
                      ).participants;
                  }),
                )
              }
            >
              <Undo2 size={16} />
              Restore last removed
            </button>
          </div>
          <p className="muted">
            Every enabled participant receives one equal entry.
          </p>
        </Panel>
      </div>
      <Panel
        title={`${e.participants.length} participants`}
        action={
          <div className="search">
            <Search size={16} />
            <input
              aria-label="Search participants"
              placeholder="Find a contender…"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
            />
          </div>
        }
      >
        <div className="tabs">
          {["all", "active", "eliminated", "disabled"].map((f) => (
            <button
              className={filter === f ? "selected" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="participant-table">
          {e.participants
            .filter(
              (p) =>
                p.name.toLowerCase().includes(search.toLowerCase()) &&
                (filter === "all" ||
                  (filter === "active" && p.enabled && p.lives > 0) ||
                  (filter === "eliminated" && p.enabled && p.lives === 0) ||
                  (filter === "disabled" && !p.enabled)),
            )
            .map((p) => (
              <div className="participant-edit" key={p.id}>
                <input
                  aria-label={`Color for ${p.name}`}
                  disabled={locked}
                  type="color"
                  value={p.color}
                  onChange={(ev) => patch(p.id, { color: ev.target.value })}
                />
                <Field label="Display name">
                  <input
                    aria-label={`Name for ${p.name}`}
                    key={p.name}
                    defaultValue={p.name}
                    disabled={locked}
                    onBlur={(ev) => {
                      if (ev.target.value !== p.name)
                        patch(p.id, { name: ev.target.value.trim() });
                    }}
                  />
                </Field>
                <Field label="Discord username">
                  <input
                    defaultValue={p.discord}
                    disabled={locked}
                    onBlur={(ev) => {
                      if (ev.target.value !== p.discord)
                        patch(p.id, { discord: ev.target.value });
                    }}
                  />
                </Field>
                <Toggle
                  label={
                    p.lives === 0
                      ? "Eliminated"
                      : e.config.mode === "survival" && !editable(e)
                        ? `${p.lives} lives`
                        : "Enabled"
                  }
                  value={p.enabled}
                  disabled={locked}
                  onChange={(v) => patch(p.id, { enabled: v })}
                />
                <details>
                  <summary>Avatar</summary>
                  <AssetInput
                    label={`Avatar for ${p.name}`}
                    value={p.avatar}
                    disabled={locked}
                    onChange={(id) => patch(p.id, { avatar: id })}
                    onError={(err) =>
                      run(() => {
                        throw err;
                      })
                    }
                  />
                </details>
                <button
                  className="icon-button danger"
                  aria-label={`Remove ${p.name}`}
                  disabled={locked}
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${p.name}? You can restore it before the event starts.`,
                      )
                    )
                      run(() =>
                        update((s) => {
                          if (!editable(s.event))
                            throw Error("Participants are locked.");
                          s.removed.push(p);
                          s.event.participants = s.event.participants.filter(
                            (v) => v.id !== p.id,
                          );
                          audit(s.event, `Removed ${p.name}`);
                        }),
                      );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
        </div>
        {!e.participants.length && (
          <div className="empty">Add contenders to begin.</div>
        )}
        <button
          disabled={locked}
          onClick={() =>
            run(() =>
              update((s) => {
                if (!editable(s.event)) throw Error("Participants are locked.");
                s.event.participants.push(
                  participant(
                    `Contender ${s.event.participants.length + 1}`,
                    s.event.participants.length,
                  ),
                );
              }),
            )
          }
        >
          <Plus size={16} />
          Add an individual participant
        </button>
      </Panel>
    </div>
  );
}
