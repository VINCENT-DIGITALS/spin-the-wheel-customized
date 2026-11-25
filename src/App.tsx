import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  LayoutDashboard,
  Radio,
  Users,
  Trophy,
  SlidersHorizontal,
  History as HistoryIcon,
  Palette,
  Volume2,
  ArrowDownUp,
  Settings,
  BookOpen,
  ExternalLink,
  ChevronLeft,
  Menu,
  CheckCircle2,
  FlaskConical,
  X,
  ShieldCheck,
} from "lucide-react";
import {
  useStore,
  useSaveStatus,
  update,
  storageError,
  demo,
} from "./services/store";
import { reconcile } from "./engine/event";
import { remaining } from "./engine/timer";
import { play, syncMusic } from "./services/audio";
import { EventView, type Run } from "./components/EventView";
import { AssetImage, useAsset } from "./components/ui";
import { Participants } from "./pages/Participants";
import { Prizes } from "./pages/Prizes";
import { Configuration } from "./pages/Configuration";
import { AppearancePage, AudioPage } from "./pages/Settings";
import { History } from "./pages/History";
import { DataSettings, Help } from "./pages/DataSettings";
const pages = [
  ["dashboard", "Overview", LayoutDashboard],
  ["live", "Live event", Radio],
  ["participants", "Participants", Users],
  ["prizes", "Prize pool", Trophy],
  ["configuration", "Event configuration", SlidersHorizontal],
  ["history", "Event history", HistoryIcon],
  ["appearance", "Appearance", Palette],
  ["audio", "Audio settings", Volume2],
  ["data", "Import & export", ArrowDownUp],
  ["settings", "General settings", Settings],
  ["help", "Help & documentation", BookOpen],
] as const;
export default function App() {
  const state = useStore();
  const saveStatus = useSaveStatus();
  const [route, setRoute] = useState(location.hash.slice(2) || "dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState("");
  const audience = route === "audience";
  const previous = useRef({
    status: state.event.status,
    round: state.event.results.length,
    second: -1,
  });
  const bg = useAsset(state.appearance.backgroundImage);
  const run: Run = (action) => {
    try {
      Promise.resolve(action()).catch((err) =>
        setMessage(err instanceof Error ? err.message : String(err)),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(2) || "dashboard");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (audience) return;
    let working = false;
    const tick = () => {
      if (working || storageError()) return;
      const e = state.event,
        now = Date.now();
      if (!(
        (e.status === "Spinning" && e.spin && remaining(e.spin, now) === 0) ||
        (e.status === "Scheduled" &&
          e.config.scheduledAt &&
          now >= e.config.scheduledAt) ||
        (e.status === "Between Rounds" &&
          e.config.auto &&
          !e.config.confirmRound &&
          e.nextAt !== null &&
          now >= e.nextAt)
      ))
        return;
      working = true;
      void update((s) => reconcile(s))
        .catch((err) => setMessage(String(err)))
        .finally(() => (working = false));
    };
    const timer = setInterval(tick, 250);
    tick();
    return () => clearInterval(timer);
  }, [state.event, audience]);
  useEffect(() => {
    if (state.audio.audience !== audience) return;
    let disposed = false;
    const soundTimers: ReturnType<typeof setTimeout>[] = [];
    let held = false,
      release: (() => void) | undefined;
    const controller = new AbortController();
    void navigator.locks
      ?.request(
        `heavenly-audio-output-${demo}`,
        { signal: controller.signal },
        async () => {
          held = true;
          await syncMusic(state.audio, audience);
          if (disposed) {
            held = false;
            await syncMusic({ ...state.audio, muted: true }, audience);
            return;
          }
          await new Promise<void>((r) => (release = r));
          held = false;
          await syncMusic({ ...state.audio, muted: true }, audience);
        },
      )
      .catch(() => {});
    const tick = () => {
      if (!held) return;
      const e = state.event,
        prev = previous.current;
      if (
        e.status === "Spinning" &&
        prev.status !== "Spinning" &&
        prev.status !== "Paused"
      )
        void play("start", state.audio, audience);
      if (e.results.length > prev.round) {
        void play(
          e.status === "Completed" ? "victory" : "elimination",
          state.audio,
          audience,
        );
        if (e.status !== "Completed") {
          soundTimers.push(
            setTimeout(
              () => void play("lightning", state.audio, audience),
              400,
            ),
          );
          soundTimers.push(
            setTimeout(
              () => void play("transition", state.audio, audience),
              800,
            ),
          );
        }
      }
      const sec = e.spin ? Math.ceil(remaining(e.spin) / 1000) : -1;
      if (e.status === "Spinning" && sec !== prev.second) {
        void play(
          sec <= 5 ? "suspense" : sec <= 10 ? "countdown" : "tick",
          state.audio,
          audience,
        );
      }
      previous.current = {
        status: e.status,
        round: e.results.length,
        second: sec,
      };
    };
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer);
      disposed = true;
      soundTimers.forEach(clearTimeout);
      controller.abort();
      release?.();
    };
  }, [state.audio, state.event, audience]);
  const a = state.appearance;
  const theme = a.theme.toLowerCase().replaceAll(" ", "-");
  const style = {
    "--accent": a.theme === "Custom" ? a.accent : undefined,
    "--bg": a.theme === "Custom" ? a.background : undefined,
    "--intensity": a.intensity,
    fontFamily: a.font === "serif" ? "Georgia, serif" : undefined,
    backgroundImage: bg
      ? `linear-gradient(#0b1220e8,#0b1220ed),url(${bg})`
      : undefined,
  } as CSSProperties;
  const title =
    pages.find((p) => p[0] === route)?.[1] ?? "Audience presentation";
  let content;
  switch (route) {
    case "participants":
      content = <Participants state={state} run={run} />;
      break;
    case "prizes":
      content = <Prizes state={state} run={run} />;
      break;
    case "configuration":
      content = <Configuration state={state} run={run} />;
      break;
    case "history":
      content = <History state={state} run={run} />;
      break;
    case "appearance":
      content = <AppearancePage state={state} run={run} />;
      break;
    case "audio":
      content = <AudioPage state={state} run={run} />;
      break;
    case "data":
    case "settings":
      content = (
        <DataSettings state={state} run={run} general={route === "settings"} />
      );
      break;
    case "help":
      content = <Help state={state} />;
      break;
    default:
      content = <EventView state={state} run={run} audience={audience} />;
  }
  return (
    <div
      className={`app theme-${theme} ${collapsed ? "collapsed" : ""} ${audience ? "audience" : ""} ${a.intensity === 0 ? "no-motion" : ""} ${!a.effects.transitions ? "no-transitions" : ""}`}
      style={style}
    >
      {!audience && (
        <aside className="sidebar">
          <a href="#/dashboard" className="brand">
            <div className="brand-symbol">
              {a.logo ? (
                <AssetImage id={a.logo} alt="Organization logo" />
              ) : (
                "☯"
              )}
            </div>
            <span>
              {a.appTitle}
              <small>{a.sect}</small>
            </span>
          </a>
          <div className="sidebar-label">EVENT WORKSPACE</div>
          <nav aria-label="Main navigation">
            {pages.map(([key, label, Icon], i) => (
              <a
                key={key}
                href={`#/${key}`}
                className={`${route === key ? "active" : ""} ${i === 6 ? "nav-divider" : ""}`}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === "live" && state.event.status === "Spinning" && (
                  <i className="live-dot" />
                )}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-badge">
              <ShieldCheck size={19} />
              <div>
                Fate, fairly decided<small>Local. Private. Transparent.</small>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
              <span>Collapse sidebar</span>
            </button>
          </div>
        </aside>
      )}
      <div className="workspace">
        {!audience && (
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label="Toggle navigation"
                onClick={() => setCollapsed(!collapsed)}
              >
                <Menu size={18} />
              </button>
              <span>{a.sect}</span>
              <span>/</span>
              <b>{title}</b>
            </div>
            <div className="topbar-right">
              <span className="saved">
                <CheckCircle2 size={14} />
                {storageError() ? "Recovery needed" : saveStatus}
              </span>
              <span className="host-avatar">HO</span>
            </div>
          </header>
        )}
        <main id="main-content">
          {demo && (
            <div className="demo-banner">
              <FlaskConical size={16} />
              TEST WORKSPACE · Separate from official events
              <button
                onClick={() =>
                  (location.href = `${location.pathname}#/dashboard`)
                }
              >
                Return to official
              </button>
            </div>
          )}
          {!audience && (
            <div className="page-header">
              <div>
                <div className="eyebrow">
                  {state.event.config.organization.toUpperCase()} · EVENT
                  COMMAND CENTER
                </div>
                <h1>
                  {route === "dashboard" || route === "live"
                    ? state.event.config.title
                    : title}
                </h1>
                <p>
                  {route === "dashboard"
                    ? "Gather your contenders. Let destiny take the wheel."
                    : route === "live"
                      ? "Your event, unfolding in real time."
                      : "Shape your event with care. Every detail stays on this device."}
                </p>
              </div>
              <button
                onClick={() =>
                  window.open(
                    `${location.pathname}${location.search}#/audience`,
                    "heavenly-audience",
                  )
                }
              >
                <ExternalLink size={15} />
                Audience view
              </button>
            </div>
          )}
          {(message || storageError()) && (
            <div role="alert" className="error">
              <span>{message || storageError()}</span>
              <button aria-label="Dismiss error" onClick={() => setMessage("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {content}
          <footer>
            <span>☯ {a.sect}</span>
            <span>May the heavens favor you.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
