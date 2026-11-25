import { useState } from "react";
import type { State } from "../types";
import { defaultEvent } from "../data/defaults";
import { editable } from "../engine/event";
import { update } from "../services/store";
import {
  csv,
  download,
  json,
  resultCSV,
  announcement,
  championImage,
} from "../services/export";
import { Panel } from "../components/ui";
import type { Run } from "../components/EventView";
export function History({ state, run }: { state: State; run: Run }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  return (
    <Panel
      title="Event archives"
      action={
        <span className="pill">
          {state.event.test ? "TEST RECORDS" : "OFFICIAL RECORDS"}
        </span>
      }
    >
      <div className="button-row">
        <input
          aria-label="Search event history"
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter event history"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
        <button
          onClick={() =>
            download(
              "event-history.csv",
              csv([
                ["Event", "Status", "Date", "Mode", "Winners"],
                ...state.history.map((e) => [
                  e.config.title,
                  e.status,
                  new Date(e.startedAt ?? 0).toISOString(),
                  e.config.mode,
                  e.winners
                    .map((id) => e.participants.find((p) => p.id === id)?.name)
                    .join("; "),
                ]),
              ]),
              "text/csv",
            )
          }
        >
          Export history
        </button>
      </div>
      {!state.history.length && (
        <div className="empty">
          <h3>A chronicle waiting to be written</h3>
          <p>Completed and cancelled events will be preserved here.</p>
        </div>
      )}
      {state.history
        .filter(
          (e) =>
            e.config.title.toLowerCase().includes(search.toLowerCase()) &&
            (status === "all" || status === e.status),
        )
        .map((e) => (
          <details className="history-event" key={e.id}>
            <summary>
              <b>{e.config.title}</b>
              <span>
                {e.status} · {new Date(e.finishedAt ?? 0).toLocaleString()}
              </span>
            </summary>
            <p>
              {e.config.mode} · {e.original.filter((p) => p.enabled).length}{" "}
              participants · {e.results.length} rounds ·{" "}
              {Math.round(
                ((e.finishedAt ?? 0) - (e.startedAt ?? e.finishedAt ?? 0)) /
                  1000,
              )}{" "}
              seconds
            </p>
            <h3>
              {e.winners
                .map((id) => e.participants.find((p) => p.id === id)?.name)
                .join(", ") || "No champion"}
            </h3>
            <div className="button-row">
              <button onClick={() => json("event-results.json", e)}>
                Export JSON
              </button>
              <button
                onClick={() =>
                  download("event-results.csv", resultCSV(e), "text/csv")
                }
              >
                Export rounds CSV
              </button>
              <button onClick={() => json("audit.json", e.audit)}>
                Export audit
              </button>
              <button
                onClick={() =>
                  run(() => navigator.clipboard.writeText(announcement(e)))
                }
              >
                Copy Discord
              </button>
              <button
                disabled={!e.winners.length}
                onClick={() => run(() => championImage(e))}
              >
                Winner PNG
              </button>
              <button
                disabled={
                  !editable(state.event) &&
                  !["Completed", "Cancelled"].includes(state.event.status)
                }
                onClick={() => {
                  if (
                    confirm(
                      "Use this configuration for a new draft? Current draft will be replaced.",
                    )
                  )
                    run(() =>
                      update((s) => {
                        if (
                          !editable(s.event) &&
                          !["Completed", "Cancelled"].includes(s.event.status)
                        )
                          throw Error(
                            "Finish or cancel the current event first.",
                          );
                        const next = defaultEvent(s.event.test);
                        next.config = structuredClone(e.config);
                        next.config.scheduledAt = null;
                        next.participants = structuredClone(
                          e.original.length ? e.original : e.participants,
                        ).map((p) => ({ ...p, lives: 1 }));
                        next.prizes = structuredClone(e.prizes);
                        s.event = next;
                      }),
                    );
                }}
              >
                Duplicate configuration
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm("Permanently delete this archived event?"))
                    run(() =>
                      update((s) => {
                        s.history = s.history.filter((h) => h.id !== e.id);
                      }),
                    );
                }}
              >
                Delete record
              </button>
            </div>
            <h4>Round results</h4>
            <ol>
              {e.results.map((r) => (
                <li key={r.spinId}>
                  {r.name} ·{" "}
                  {r.eliminated ? "eliminated" : `${r.livesLeft} lives`} ·{" "}
                  {new Date(r.at).toLocaleString()}
                </li>
              ))}
            </ol>
            <details>
              <summary>Original participants, rewards and settings</summary>
              <pre>
                {JSON.stringify(
                  {
                    participants: e.original,
                    prizes: e.prizes,
                    settings: e.config,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            <details>
              <summary>Audit history</summary>
              {e.audit.map((a, i) => (
                <p key={i}>
                  {new Date(a.at).toLocaleString()} — {a.message}
                </p>
              ))}
            </details>
          </details>
        ))}
    </Panel>
  );
}
