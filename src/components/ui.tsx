import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAsset, saveAsset } from "../services/assets";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement<{ id?: string }>(child) &&
        ["input", "select", "textarea"].includes(String(child.type))
          ? cloneElement(child, { id: child.props.id ?? id })
          : child,
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function useAsset(id: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    setUrl("");
    if (id)
      void getAsset(id)
        .then((blob) => {
          if (blob && !disposed) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {});
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}
export function AssetImage({
  id,
  alt,
  className = "",
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const url = useAsset(id);
  return url ? <img src={url} alt={alt} className={className} /> : null;
}
export function AssetInput({
  label,
  value,
  onChange,
  onError,
  audio = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  onError: (error: unknown) => void;
  audio?: boolean;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        disabled={disabled}
        type="file"
        accept={audio ? "audio/*" : "image/png,image/jpeg,image/webp,image/gif"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void saveAsset(file).then(onChange).catch(onError);
          e.target.value = "";
        }}
      />
      {value && (
        <>
          <span className="muted">Asset saved on this device</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            Remove asset
          </button>
          {!audio && (
            <AssetImage id={value} alt={label} className="asset-preview" />
          )}
        </>
      )}
    </Field>
  );
}
export function Duration({
  value,
  onChange,
  label = "Spin duration",
  disabled = false,
}: {
  value: number;
  onChange: (ms: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const seconds = Math.floor(value / 1000);
  return (
    <fieldset className="duration" disabled={disabled}>
      <legend>{label}</legend>
      {[
        ["Hours", Math.floor(seconds / 3600)],
        ["Minutes", Math.floor((seconds % 3600) / 60)],
        ["Seconds", seconds % 60],
      ].map(([name, v], i) => (
        <label key={name}>
          {name}
          <input
            aria-label={`${label} ${name}`}
            type="number"
            min="0"
            max={i === 0 ? undefined : 59}
            value={v}
            onChange={(e) => {
              const n = Math.max(0, Number(e.target.value));
              const values = [
                Math.floor(seconds / 3600),
                Math.floor((seconds % 3600) / 60),
                seconds % 60,
              ];
              values[i] = n;
              onChange(
                Math.max(
                  1000,
                  (values[0] * 3600 + values[1] * 60 + values[2]) * 1000,
                ),
              );
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
