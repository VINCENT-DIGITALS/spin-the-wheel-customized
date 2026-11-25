import { useEffect, useRef } from "react";
import type { Appearance, FateEvent } from "../types";
import { active } from "../engine/event";
import { rotation } from "../engine/timer";
import { AssetImage, useAsset } from "./ui";
export function Wheel({
  event,
  appearance,
}: {
  event: FateEvent;
  appearance: Appearance;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wheelBackground = useAsset(appearance.wheelBackground);
  const pool = event.spin ? event.spin.pool : active(event);
  const moving = event.status === "Spinning";
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let frame = 0,
      last = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (stamp = 0) => {
      if (stamp - last < 33 && moving) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = stamp;
      const size = el.clientWidth;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (el.width !== Math.round(size * dpr)) {
        el.width = Math.round(size * dpr);
        el.height = el.width;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const center = size / 2,
        radius = center - 14;
      const angle = event.spin
        ? rotation(
            event.spin,
            (reduced && moving) || (!appearance.effects.wheel && moving)
              ? event.spin.startedAt
              : Date.now(),
          )
        : 0;
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle - Math.PI / 2);
      const count = pool.length;
      pool.forEach((p, i) => {
        const start = (i * Math.PI * 2) / count,
          end = ((i + 1) * Math.PI * 2) / count;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(225,202,138,.32)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (count <= 100) {
          ctx.save();
          ctx.rotate((start + end) / 2);
          ctx.fillStyle = "#fff";
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.font = `500 ${Math.max(8, Math.min(13, size / 38, count > 30 ? 9 : 13))}px system-ui`;
          const name = appearance.showDiscord && p.discord ? p.discord : p.name;
          ctx.fillText(
            name.length > 19 ? name.slice(0, 17) + "…" : name,
            radius - 20,
            0,
            radius - 65,
          );
          ctx.restore();
        }
      });
      ctx.restore();
      ctx.beginPath();
      ctx.arc(center, center, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (moving && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      draw();
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(el);
    document.addEventListener("visibilitychange", refresh);
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    pool,
    event.spin,
    moving,
    appearance.effects.wheel,
    appearance.showDiscord,
  ]);
  return (
    <div
      className={`wheel-wrap ${moving && appearance.effects.pointer ? "is-spinning" : ""}`}
      style={
        wheelBackground
          ? {
              backgroundImage: `url(${wheelBackground})`,
              backgroundSize: "cover",
              borderRadius: "50%",
            }
          : undefined
      }
    >
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="wheel-pointer" />
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Wheel with ${pool.length} equally sized participant segments`}
      />
      <div className="wheel-center">
        {appearance.centerpiece ? (
          <AssetImage id={appearance.centerpiece} alt="Wheel centerpiece" />
        ) : (
          <>
            <span>☯</span>
            <small>HEAVENLY FATE</small>
          </>
        )}
      </div>
      <span className="orbit-star star-one">✦</span>
      <span className="orbit-star star-two">✧</span>
    </div>
  );
}
