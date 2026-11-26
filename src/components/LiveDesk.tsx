import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  Square,
  SlidersHorizontal,
  Maximize,
  VolumeX,
  Volume2,
  Trophy,
  Copy,
  Download,
  FlaskConical,
} from "lucide-react";
import type { Config, State } from "../types";
import {
  active,
  audit,
  begin,
  editable,
  editAsDraft,
  estimate,
  pause,
  resume,
  roundsLeft,
  startSpin,
} from "../engine/event";
import { formatTime, remaining } from "../engine/timer";
import { demo, update } from "../services/store";
import { unlock, syncMusic } from "../services/audio";
import { announcement, championImage, json } from "../services/export";
import { AssetImage, Duration, Field, Toggle } from "./ui";
import { Wheel } from "./Wheel";
import type { Run } from "./EventView";
export function LiveDesk({
  state,
  run,
  audience = false,
}: {
  state: State;
  run: Run;
  audience?: boolean;
}) {
  const e = state.event,
    locked = !editable(e),
    complete = e.status === "Completed";
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState(audience ? "contenders" : "settings");
  const [mobileTab, setMobileTab] = useState("wheel");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const pool = active(e),
    total = (e.original.length ? e.original : e.participants).filter(
      (p) => p.enabled,
    ).length;
  const last = e.results.at(-1);
  const countdown =
    e.spin && ["Spinning", "Paused"].includes(e.status)
      ? remaining(e.spin, now)
      : e.status === "Between Rounds" && e.config.auto && !e.config.confirmRound
        ? Math.max(0, (e.nextAt ?? now) - now)
        : e.config.duration;
  const patch = (values: Partial<Config>) =>
    run(() =>
      update((s) => {
        if (!editable(s.event))
          throw Error("Use Stop & edit to unlock settings.");
        Object.assign(s.event.config, values);
        audit(s.event, `Quick settings: ${Object.keys(values).join(", ")}`);
      }),
    );
  const stop = () => {
    if (
      !["Completed", "Cancelled"].includes(e.status) &&
      !confirm(
        "Stop this event and unlock settings? This run and its determined result will be archived. A fresh draft will keep your participants, prizes and settings.",
      )
    )
      return;
    run(async () => {
      await update((s) => editAsDraft(s));
      setTab("settings");
    });
  };
  const spin = () =>
    run(async () => {
      await unlock();
      await update((s) => {
        if (editable(s.event)) begin(s.event);
        else if (s.event.status === "Spinning") pause(s.event);
        else if (s.event.status === "Paused") resume(s.event);
        else if (s.event.status === "Between Rounds") {
          if (s.event.config.confirmRound && !confirm("Start the next round?"))
            return;
          startSpin(s.event);
        }
      });
    });
  const full = () =>
    run(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    });
  const tabs = audience
    ? ["contenders", "prizes", "history"]
    : ["settings", "contenders", "prizes", "history"];
  return (
    <div
      className={`live-desk ${audience ? "presentation-desk" : ""}`}
      data-mobile-tab={mobileTab}
    >
      {audience && (
        <div className="desk-title">
          <div>
            <div className="eyebrow">{e.config.organization}</div>
            <h1>{e.config.title}</h1>
          </div>
          <button onClick={full}>
            <Maximize size={16} />
            Fullscreen
          </button>
          {state.audio.audience && (
            <button
              onClick={() =>
                run(async () => {
                  await unlock();
                  await syncMusic(state.audio, true);
                })
              }
            >
              Enable presentation audio
            </button>
          )}
        </div>
      )}
      <div className="desk-stats">
        <span>
          <b>
            {pool.length}
            <small> / {total}</small>
          </b>{" "}
          contenders
        </span>
        <span>
          <b>
            {e.results.length +
              (["Spinning", "Paused"].includes(e.status) ? 1 : 0)}
          </b>{" "}
          round · {roundsLeft(e)} left
        </span>
        <span>
          <Trophy size={15} />
          <b>{e.prizes.reduce((n, p) => n + p.quantity, 0)}</b> prize items
        </span>
        <span className="time-stat">
          {formatTime(estimate(e, now))}
          <small> estimated remaining</small>
        </span>
      </div>
      <div className="desk-mobile-tabs">
        <button
          className={mobileTab === "wheel" ? "selected" : ""}
          onClick={() => setMobileTab("wheel")}
        >
          Wheel
        </button>
        <button
          className={mobileTab === "details" ? "selected" : ""}
          onClick={() => setMobileTab("details")}
        >
          {audience ? "Event details" : "Settings & details"}
        </button>
      </div>
      <div className="desk-body">
        <section
          className={`desk-stage panel ${complete ? "completed-stage celebration" : ""}`}
        >
          <div className="stage-top">
            <span className="pill">{e.status.toUpperCase()}</span>
            <span>
              {demo
                ? "TEST EVENT"
                : `${e.config.mode.toUpperCase()} · EQUAL CHANCES`}
            </span>
          </div>
          <div className="stage-heading">
            <div className="eyebrow">
              {complete ? "HEAVENLY FATE CHAMPION" : "LET THE HEAVENS DECIDE"}
            </div>
            <h2>
              {complete
                ? e.winners
                    .map((id) => e.participants.find((p) => p.id === id)?.name)
                    .join(", ")
                : pool.length === 2
                  ? "The final showdown"
                  : "One wheel. One destiny."}
            </h2>
          </div>
          <div className="stage-wheel">
            <Wheel event={e} appearance={state.appearance} />
          </div>
          <div className="stage-result" role="status">
            {complete
              ? "The champion wins the heavenly treasury."
              : last
                ? `Round ${last.round}: ${last.name} · ${e.config.mode === "winner" ? "selected" : last.eliminated ? "eliminated" : `${last.livesLeft} lives left`}`
                : "Every contender has an equal chance."}
          </div>
          <div className="stage-timer">
            <span>
              {e.status === "Between Rounds" &&
              e.config.auto &&
              !e.config.confirmRound
                ? "NEXT ROUND IN"
                : e.status === "Paused"
                  ? "PAUSED"
                  : "ROUND COUNTDOWN"}
            </span>
            <strong role="timer" aria-label="Round countdown">
              {complete ? "00:00:00" : formatTime(countdown)}
            </strong>
          </div>
          {!audience && (
            <div className="desk-controls">
              {complete ? (
                <>
                  <button
                    className="primary"
                    onClick={() =>
                      run(() => navigator.clipboard.writeText(announcement(e)))
                    }
                  >
                    <Copy size={15} />
                    Copy announcement
                  </button>
                  <button onClick={() => run(() => championImage(e))}>
                    <Download size={15} />
                    Winner image
                  </button>
                  <button onClick={() => json("event-results.json", e)}>
                    Export results
                  </button>
                </>
              ) : (
                <button
                  className="primary"
                  disabled={
                    !editable(e) &&
                    !["Spinning", "Paused", "Between Rounds"].includes(e.status)
                  }
                  onClick={spin}
                >
                  {e.status === "Spinning" ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}
                  {e.status === "Spinning"
                    ? "Pause spin"
                    : e.status === "Paused"
                      ? "Resume spin"
                      : e.status === "Between Rounds"
                        ? "Start next round"
                        : "Begin the event"}
                </button>
              )}
              {locked && (
                <button className="stop-edit" onClick={stop}>
                  <Square size={14} />
                  {["Completed", "Cancelled"].includes(e.status)
                    ? "Edit & start again"
                    : "Stop & edit"}
                </button>
              )}
              <button
                className="icon-button"
                aria-label="Toggle sound"
                onClick={() =>
                  run(async () => {
                    await unlock();
                    await update((s) => {
                      s.audio.muted = !s.audio.muted;
                    });
                  })
                }
              >
                {state.audio.muted ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Fullscreen"
                onClick={full}
              >
                <Maximize size={16} />
              </button>
            </div>
          )}
        </section>
        <aside className="desk-inspector panel">
          <div
            className="inspector-tabs"
            role="tablist"
            aria-label="Event details"
          >
            {tabs.map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="inspector-content" role="tabpanel">
            {tab === "settings" && !audience && (
              <>
                <div className="inspector-heading">
                  <SlidersHorizontal size={17} />
                  <h2>Quick settings</h2>
                </div>
                {locked ? (
                  <div className="settings-locked">
                    <p>
                      {e.status === "Paused"
                        ? "Pause holds the current result. To change settings, stop this run and return to an editable draft."
                        : "Stop this run to edit. Your current settings and original participant list will be kept."}
                    </p>
                    <button className="primary" onClick={stop}>
                      {["Completed", "Cancelled"].includes(e.status)
                        ? "Edit configuration"
                        : "Stop & edit settings"}
                    </button>
                  </div>
                ) : (
                  <>
                    <Field label="Game mode">
                      <select
                        value={e.config.mode}
                        onChange={(ev) =>
                          patch({ mode: ev.target.value as Config["mode"] })
                        }
                      >
                        <option value="elimination">Elimination</option>
                        <option value="winner">Winner selection</option>
                        <option value="survival">Survival</option>
                      </select>
                    </Field>
                    <Duration
                      value={e.config.duration}
                      onChange={(duration) => patch({ duration })}
                    />
                    <div className="presets">
                      {[5, 30, 60, 300, 1800, 3600].map((s) => (
                        <button
                          key={s}
                          className={
                            e.config.duration === s * 1000 ? "selected" : ""
                          }
                          onClick={() => patch({ duration: s * 1000 })}
                        >
                          {s < 60 ? `${s}s` : s < 3600 ? `${s / 60}m` : "1h"}
                        </button>
                      ))}
                    </div>
                    <Toggle
                      label="Automatic next round"
                      value={e.config.auto}
                      onChange={(auto) => patch({ auto })}
                    />
                    <Field label="Round interval (seconds)">
                      <input
                        type="number"
                        min="0"
                        value={e.config.interval / 1000}
                        onChange={(ev) =>
                          patch({ interval: Number(ev.target.value) * 1000 })
                        }
                      />
                    </Field>
                    {e.config.mode === "survival" && (
                      <Field label="Starting lives">
                        <input
                          type="number"
                          min="1"
                          value={e.config.lives}
                          onChange={(ev) =>
                            patch({ lives: Number(ev.target.value) })
                          }
                        />
                      </Field>
                    )}
                    {e.config.mode === "winner" && (
                      <Field label="Winner count">
                        <input
                          type="number"
                          min="1"
                          value={e.config.winnerCount}
                          onChange={(ev) =>
                            patch({ winnerCount: Number(ev.target.value) })
                          }
                        />
                      </Field>
                    )}
                  </>
                )}
                <a className="button all-settings" href="#/configuration">
                  All event settings →
                </a>
                <div className="inspector-links">
                  <a href="#/participants">Edit participants</a>
                  <a href="#/prizes">Edit prize pool</a>
                </div>
                <button
                  className="demo-switch"
                  onClick={() =>
                    (location.href = `${location.pathname}${demo ? "" : "?demo=1"}#/dashboard`)
                  }
                >
                  <FlaskConical size={14} />
                  {demo ? "Return to official event" : "Try a separate demo"}
                </button>
              </>
            )}
            {tab === "contenders" && (
              <>
                <div className="inspector-heading">
                  <h2>The contenders</h2>
                  <span className="count-badge">{pool.length} remain</span>
                </div>
                <div className="contenders">
                  {pool.map((p) => (
                    <div className="contender" key={p.id}>
                      <span
                        className="participant-avatar"
                        style={{ background: p.color }}
                      >
                        {p.avatar && state.appearance.showAvatars ? (
                          <AssetImage id={p.avatar} alt="" />
                        ) : (
                          p.name.replace("@", "").slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span>
                        <b>
                          {state.appearance.showDiscord
                            ? p.discord || p.name
                            : p.name}
                        </b>
                        {e.config.mode === "survival" && (
                          <small>
                            {editable(e) ? e.config.lives : p.lives} lives
                          </small>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {tab === "prizes" && (
              <>
                <div className="inspector-heading">
                  <Trophy size={18} />
                  <h2>The heavenly treasury</h2>
                </div>
                <p className="muted">
                  The champion receives the entire prize pool.
                </p>
                <div className="compact-prizes">
                  {e.prizes.map((p) => (
                    <div key={p.id}>
                      <span className="reward-name">
                        {p.image && (
                          <AssetImage
                            id={p.image}
                            alt=""
                            className="reward-thumbnail"
                          />
                        )}
                        {p.name}
                      </span>
                      <b>×{p.quantity}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
            {tab === "history" && (
              <>
                <h2>Chronicles of fate</h2>
                {!e.results.length ? (
                  <p>No rounds completed yet.</p>
                ) : (
                  <div className="history-list">
                    {[...e.results].reverse().map((r) => (
                      <div key={r.spinId}>
                        <span>{r.round}.</span>
                        <b>{r.name}</b>
                        <span>
                          {r.eliminated ? "Eliminated" : `${r.livesLeft} lives`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
