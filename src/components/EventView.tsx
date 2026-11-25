import { useEffect, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Clock3,
  Users,
  Trophy,
  Sparkles,
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  Maximize,
  Volume2,
  VolumeX,
  Copy,
  Download,
  FlaskConical,
} from "lucide-react";
import type { State } from "../types";
import {
  active,
  begin,
  cancel,
  editable,
  estimate,
  pause,
  resume,
  roundsLeft,
  startSpin,
} from "../engine/event";
import { formatTime, remaining } from "../engine/timer";
import { update, demo } from "../services/store";
import { announcement, championImage, json } from "../services/export";
import { unlock, syncMusic } from "../services/audio";
import { Wheel } from "./Wheel";
import { Panel, AssetImage } from "./ui";
export type Run = (action: () => Promise<unknown> | void) => void;
export function EventView({
  state,
  run,
  audience = false,
}: {
  state: State;
  run: Run;
  audience?: boolean;
}) {
  const e = state.event;
  const [now, setNow] = useState(Date.now());
  const reduced = useReducedMotion();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const participants = active(e);
  const last = e.results.at(-1);
  const remainingTime =
    e.spin && ["Spinning", "Paused"].includes(e.status)
      ? remaining(e.spin, now)
      : e.config.duration;
  const total = e.original.length
    ? e.original.filter((p) => p.enabled).length
    : e.participants.filter((p) => p.enabled).length;
  const progress =
    e.status === "Completed"
      ? 100
      : e.config.mode === "winner"
        ? (e.results.length / e.config.winnerCount) * 100
        : ((total - participants.length) / Math.max(1, total - 1)) * 100;
  const completed = e.status === "Completed";
  const busy = ["Spinning", "Paused", "Scheduled"].includes(e.status);
  const canStart = editable(e) || e.status === "Between Rounds";
  const control = () =>
    run(async () => {
      await unlock();
      await update((s) => {
        if (editable(s.event)) begin(s.event);
        else if (s.event.status === "Paused") resume(s.event);
        else if (s.event.status === "Spinning") pause(s.event);
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
  return (
    <>
      {audience && (
        <header className="audience-header">
          <div className="eyebrow">{e.config.organization}</div>
          <h1>{e.config.title}</h1>
          <button onClick={full}>
            <Maximize size={16} /> Fullscreen
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
        </header>
      )}
      <div className="stats-grid">
        <div className="stat">
          <span>
            <Users size={17} /> PARTICIPANTS
          </span>
          <strong>
            {total.toString().padStart(2, "0")}
            <small>{participants.length} remaining</small>
          </strong>
        </div>
        <div className="stat">
          <span>
            <Sparkles size={17} /> CURRENT ROUND
          </span>
          <strong>
            {Math.min(
              e.results.length + (busy ? 1 : 0),
              e.results.length + roundsLeft(e),
            )
              .toString()
              .padStart(2, "0")}
            <small>
              {e.config.mode === "survival"
                ? "survival"
                : `of ${e.results.length + roundsLeft(e)}`}
            </small>
          </strong>
        </div>
        <div className="stat">
          <span>
            <Trophy size={17} /> PRIZE POOL
          </span>
          <strong>
            {e.prizes.reduce((n, p) => n + p.quantity, 0)}
            <small>{e.prizes.length} unique rewards</small>
          </strong>
        </div>
        <div className="stat">
          <span>
            <Clock3 size={17} /> EST. REMAINING
          </span>
          <strong className="time-stat">
            {completed ? "00:00:00" : formatTime(estimate(e, now))}
            <small>
              {e.config.mode === "survival"
                ? "maximum estimate"
                : "including round intervals"}
            </small>
          </strong>
        </div>
      </div>
      <div className="event-meta">
        <span>{total - participants.length} eliminated / removed</span>
        <span>
          {roundsLeft(e)} rounds remaining
          {e.config.mode === "survival" ? " at most" : ""}
        </span>
        <span>
          Round duration{" "}
          {formatTime(
            e.config.roundDurations[e.results.length] ?? e.config.duration,
          )}
        </span>
        <span>
          {completed
            ? "Finished"
            : e.status === "Paused"
              ? "Completion after resume"
              : "Estimated completion"}
          :{" "}
          {completed
            ? new Date(e.finishedAt ?? now).toLocaleString()
            : e.status === "Paused"
              ? formatTime(estimate(e, now))
              : new Date(now + estimate(e, now)).toLocaleString()}
        </span>
      </div>
      <div
        className={`event-grid ${audience && state.appearance.audienceLayout === "wheel" ? "wide-wheel" : ""}`}
      >
        <section className="wheel-panel panel">
          <div className="wheel-panel-top">
            <span className="pill">
              <i className={e.status === "Spinning" ? "pulse" : ""} />
              {e.status.toUpperCase()}
            </span>
            <span className="muted">
              {e.test ? "TEST EVENT" : e.config.mode.toUpperCase() + " MODE"}
            </span>
          </div>
          <div className="wheel-heading">
            <div className="eyebrow">LET THE HEAVENS DECIDE</div>
            <h2>
              {participants.length === 2 &&
              !completed &&
              state.appearance.effects.showdown
                ? "The final showdown"
                : completed
                  ? "Fate has chosen"
                  : "One wheel. One destiny."}
            </h2>
            <p>
              {e.config.mode === "winner"
                ? "Every entry has an equal chance to be chosen."
                : "Each round, one falls. The last standing claims it all."}
            </p>
          </div>
          <Wheel event={e} appearance={state.appearance} />
          <div className="timer-label">
            {e.status === "Between Rounds" &&
            e.config.auto &&
            !e.config.confirmRound
              ? "NEXT ROUND IN"
              : "ROUND COUNTDOWN"}
          </div>
          <div
            className={`countdown ${state.appearance.effects.countdown ? "animated-countdown" : ""}`}
            role="timer"
            aria-label="Round countdown"
          >
            {e.status === "Between Rounds" &&
            e.config.auto &&
            !e.config.confirmRound
              ? formatTime(Math.max(0, (e.nextAt ?? now) - now))
              : formatTime(remainingTime)}
          </div>
          {!audience && (
            <div className="spin-controls">
              <button
                className="primary spin-button"
                onClick={control}
                disabled={
                  !canStart && !["Spinning", "Paused"].includes(e.status)
                }
              >
                {e.status === "Spinning" ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}{" "}
                {e.status === "Spinning"
                  ? "Pause spin"
                  : e.status === "Paused"
                    ? "Resume spin"
                    : e.status === "Between Rounds"
                      ? "Start next round"
                      : "Begin the event"}
                <ArrowRight size={17} />
              </button>
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
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Fullscreen"
                onClick={full}
              >
                <Maximize size={18} />
              </button>
            </div>
          )}
          <div className="fairness">
            <ShieldCheck size={14} /> Equal chances · Secure randomness ·
            Automatically saved
          </div>
          <div className="event-progress">
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-label">
            <span>EVENT PROGRESS</span>
            <span>{Math.round(progress)}%</span>
          </div>
          {last && (
            <motion.div
              key={last.spinId}
              initial={
                reduced ||
                state.appearance.intensity === 0 ||
                !state.appearance.effects.announcement
                  ? false
                  : { opacity: 0, y: 10 }
              }
              animate={{ opacity: 1, y: 0 }}
              className={`round-result ${state.appearance.effects.lightning ? "lightning" : ""} ${state.appearance.effects.tribulation ? "tribulation" : ""}`}
              role="status"
            >
              <Sparkles size={18} />
              <div>
                <small>
                  ROUND {last.round} ·{" "}
                  {e.config.mode === "winner"
                    ? "SELECTED"
                    : last.eliminated
                      ? "ELIMINATED"
                      : "LIFE LOST"}
                </small>
                <strong>{last.name}</strong>
              </div>
            </motion.div>
          )}
        </section>
        <div className="event-side">
          <Panel
            title="The contenders"
            action={
              <span className="count-badge">{participants.length} remain</span>
            }
          >
            <div className="contenders">
              {participants.map((p, i) => (
                <motion.div
                  layout={
                    !!state.appearance.effects["segment removal"] && !reduced
                  }
                  key={p.id}
                  className="contender"
                >
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
                    <small>
                      {e.config.mode === "survival"
                        ? `${p.lives} lives remaining`
                        : `Contender ${String(i + 1).padStart(2, "0")}`}
                    </small>
                  </span>
                  <span className="live-dot" />
                </motion.div>
              ))}
            </div>
            <div className="panel-footer">
              <ShieldCheck size={14} />
              {e.config.mode === "elimination"
                ? "The last contender wins everything."
                : "Every active entry has equal odds."}
            </div>
          </Panel>
          <Panel
            title="Grand prize"
            action={<Trophy className="gold" size={18} />}
          >
            <div className="prize-summary">
              <div className="prize-orb">✦</div>
              <div>
                <div className="eyebrow">WINNER TAKES ALL</div>
                <h3>The heavenly treasury</h3>
                <p>
                  {e.prizes.length} rewards ·{" "}
                  {e.prizes.reduce((n, p) => n + p.quantity, 0)} total items
                </p>
              </div>
            </div>
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
          </Panel>
        </div>
      </div>
      {completed && (
        <motion.section
          initial={
            reduced ||
            state.appearance.intensity === 0 ||
            !state.appearance.effects.champion
              ? false
              : { opacity: 0, scale: 0.95 }
          }
          animate={{ opacity: 1, scale: 1 }}
          className={`champion panel ${state.appearance.effects.celebration ? "celebration" : ""} ${state.appearance.effects.particles ? "particles" : ""} ${state.appearance.effects.confetti ? "confetti" : ""}`}
        >
          {(state.appearance.effects.confetti ||
            state.appearance.effects.particles) && (
            <div className="celebration-particles" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <i
                  key={i}
                  className={
                    state.appearance.effects.confetti
                      ? "falling-confetti"
                      : "rising-particle"
                  }
                  style={
                    {
                      "--x": `${(i * 43) % 100}%`,
                      "--delay": `${(i % 7) * 0.3}s`,
                      "--drift": `${(i % 2 ? 1 : -1) * (20 + i * 3)}px`,
                      "--hue":
                        i % 3 === 0
                          ? "#a7bff0"
                          : i % 3 === 1
                            ? "#d4af37"
                            : "#e9dcae",
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          <Trophy size={40} />
          <div className="eyebrow">
            {e.test ? "TEST EVENT · " : ""}HEAVENLY FATE CHAMPION
          </div>
          <h2>
            {e.winners
              .map((id) => e.participants.find((p) => p.id === id)?.name)
              .join(", ")}
          </h2>
          <p>
            The heavens have decided.{" "}
            {e.winners.length === 1
              ? "The entire prize pool is yours."
              : "Selected winners are recorded below; the host distributes rewards."}
          </p>
          <p>
            {total} participants · {e.results.length} rounds ·{" "}
            {formatTime((e.finishedAt ?? now) - (e.startedAt ?? now))}
          </p>
          {e.winners.map((id) => {
            const p = e.participants.find((p) => p.id === id);
            return p?.avatar ? (
              <AssetImage
                key={id}
                id={p.avatar}
                alt={p.name}
                className="asset-preview"
              />
            ) : null;
          })}
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
          {!audience && (
            <div className="button-row">
              <button
                onClick={() =>
                  run(() => navigator.clipboard.writeText(announcement(e)))
                }
              >
                <Copy size={16} />
                Copy announcement
              </button>
              <button onClick={() => run(() => championImage(e))}>
                <Download size={16} />
                Winner image
              </button>
              <button onClick={() => json("event-results.json", e)}>
                Export results
              </button>
            </div>
          )}
          <small>
            Prize assignment is a record for the host; items are not
            automatically transferred in Roblox.
          </small>
        </motion.section>
      )}
      <div className="bottom-grid">
        <Panel
          title="Chronicles of fate"
          action={<span className="muted">ROUND HISTORY</span>}
        >
          {e.results.length ? (
            <div className="history-list">
              {[...e.results].reverse().map((r) => (
                <div key={r.spinId}>
                  <span className="round-number">
                    {r.round.toString().padStart(2, "0")}
                  </span>
                  <b>{r.name}</b>
                  <span>
                    {e.config.mode === "winner"
                      ? "Winner"
                      : r.eliminated
                        ? "Eliminated"
                        : `${r.livesLeft} lives left`}
                  </span>
                  <time>{new Date(r.at).toLocaleTimeString()}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <Sparkles size={23} />
              <h3>Your story is yet to unfold</h3>
              <p>Round results will appear here when the first spin ends.</p>
            </div>
          )}
        </Panel>
        <Panel title="The path to victory">
          <div className="rule-summary">
            <span>01</span>
            <div>
              <b>Every entry is equal</b>
              <p>No weighting. No contribution advantage.</p>
            </div>
          </div>
          <div className="rule-summary">
            <span>02</span>
            <div>
              <b>Fate chooses each round</b>
              <p>
                {e.config.mode === "survival"
                  ? "Lose a life until only one remains."
                  : e.config.mode === "winner"
                    ? "The wheel selects your configured winners."
                    : "Selected contenders leave the wheel."}
              </p>
            </div>
          </div>
          <div className="rule-summary">
            <span>03</span>
            <div>
              <b>A champion ascends</b>
              <p>The final contender claims the treasury.</p>
            </div>
          </div>
        </Panel>
      </div>
      {!audience && (
        <div className="host-toolbar">
          <button
            onClick={() => {
              window.open(
                `${location.pathname}${location.search}#/audience`,
                "heavenly-audience",
              );
            }}
          >
            <ExternalLink size={16} />
            Open audience view
          </button>
          <button
            onClick={() => {
              location.href = `${location.pathname}${demo ? "" : "?demo=1"}#/dashboard`;
            }}
          >
            <FlaskConical size={16} />
            {demo ? "Return to official event" : "Try a separate demo"}
          </button>
          {!editable(e) && !["Completed", "Cancelled"].includes(e.status) && (
            <button
              className="danger"
              onClick={() => {
                if (
                  confirm(
                    "Cancel this event? The determined result and audit remain in history.",
                  )
                )
                  run(() => update((s) => cancel(s)));
              }}
            >
              <RotateCcw size={16} />
              Cancel event
            </button>
          )}
        </div>
      )}
    </>
  );
}
