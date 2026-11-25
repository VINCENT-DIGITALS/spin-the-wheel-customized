import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
} from "lucide-react";
import { z } from "zod";
import type { State, Prize } from "../types";
import { prizeSchema } from "../types";
import { audit, editable } from "../engine/event";
import { update } from "../services/store";
import { json } from "../services/export";
import { AssetInput, Field, Panel } from "../components/ui";
import type { Run } from "../components/EventView";
export function Prizes({ state, run }: { state: State; run: Run }) {
  const e = state.event,
    locked = !editable(e);
  const edit = (change: (prizes: Prize[]) => void) =>
    run(() =>
      update((s) => {
        if (!editable(s.event))
          throw Error("Prize pool is locked during the event.");
        change(s.event.prizes);
        audit(s.event, "Prize pool updated");
      }),
    );
  const patch = (id: string, values: Partial<Prize>) =>
    edit((prizes) => {
      const p = prizes.find((p) => p.id === id);
      if (p) Object.assign(p, values);
    });
  return (
    <div className="page-stack">
      <div className="treasury-banner">
        <TrophyMark />
        <div>
          <div className="eyebrow">THE HEAVENLY TREASURY</div>
          <h2>
            {e.prizes.reduce((n, p) => n + p.quantity, 0)} items. One grand
            champion.
          </h2>
          <p>Rewards are recorded for the host to distribute in Roblox.</p>
        </div>
      </div>
      <Panel
        title="Prize pool"
        action={<span className="pill">{e.prizes.length} reward types</span>}
      >
        <div className="button-row">
          <button
            className="primary"
            disabled={locked}
            onClick={() =>
              edit((prizes) =>
                prizes.push({
                  id: crypto.randomUUID(),
                  name: "New reward",
                  quantity: 1,
                  rarity: "Rare",
                  description: "",
                  image: "",
                }),
              )
            }
          >
            <Plus size={16} />
            Add reward
          </button>
          <button onClick={() => json("prizes.json", e.prizes)}>
            <Download size={16} />
            Export prizes
          </button>
          <label className="button">
            <Upload size={16} />
            Import prizes
            <input
              hidden
              disabled={locked}
              type="file"
              accept=".json"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f)
                  run(async () => {
                    const prizes = z
                      .array(prizeSchema)
                      .parse(JSON.parse(await f.text()));
                    if (confirm("Replace the current prize list?"))
                      edit((current) =>
                        current.splice(0, current.length, ...prizes),
                      );
                  });
                ev.target.value = "";
              }}
            />
          </label>
          <button
            disabled={locked}
            onClick={() => {
              const name = prompt("Name this prize preset");
              if (name)
                run(() =>
                  update((s) => {
                    s.prizePresets[name] = structuredClone(e.prizes);
                  }),
                );
            }}
          >
            Save preset
          </button>
          <select
            value=""
            aria-label="Load prize preset"
            disabled={locked}
            onChange={(ev) => {
              const name = ev.target.value;
              edit((prizes) =>
                prizes.splice(
                  0,
                  prizes.length,
                  ...structuredClone(state.prizePresets[name]),
                ),
              );
            }}
          >
            <option value="">Load preset…</option>
            {Object.keys(state.prizePresets).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="prize-grid">
          {e.prizes.map((p, i) => (
            <article key={p.id} className="prize-card">
              <div className="prize-card-heading">
                <span className="rarity">{p.rarity}</span>
                <div className="button-row">
                  <button
                    disabled={locked || i === 0}
                    aria-label={`Move ${p.name} up`}
                    onClick={() =>
                      edit((list) => {
                        [list[i - 1], list[i]] = [list[i], list[i - 1]];
                      })
                    }
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    disabled={locked || i === e.prizes.length - 1}
                    aria-label={`Move ${p.name} down`}
                    onClick={() =>
                      edit((list) => {
                        [list[i + 1], list[i]] = [list[i], list[i + 1]];
                      })
                    }
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    disabled={locked}
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      if (confirm(`Delete ${p.name}?`))
                        edit((list) => list.splice(i, 1));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <Field label="Reward name">
                <input
                  disabled={locked}
                  defaultValue={p.name}
                  onBlur={(ev) => {
                    if (ev.target.value !== p.name)
                      patch(p.id, { name: ev.target.value });
                  }}
                />
              </Field>
              <div className="two-columns">
                <Field label="Quantity">
                  <input
                    disabled={locked}
                    type="number"
                    min="1"
                    value={p.quantity}
                    onChange={(ev) =>
                      patch(p.id, { quantity: Number(ev.target.value) })
                    }
                  />
                </Field>
                <Field label="Rarity">
                  <select
                    disabled={locked}
                    value={p.rarity}
                    onChange={(ev) => patch(p.id, { rarity: ev.target.value })}
                  >
                    {[
                      "Common",
                      "Uncommon",
                      "Rare",
                      "Epic",
                      "Legendary",
                      "Mythic",
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  disabled={locked}
                  defaultValue={p.description}
                  onBlur={(ev) => {
                    if (ev.target.value !== p.description)
                      patch(p.id, { description: ev.target.value });
                  }}
                />
              </Field>
              <AssetInput
                label="Reward image"
                value={p.image}
                disabled={locked}
                onChange={(id) => patch(p.id, { image: id })}
                onError={(error) =>
                  run(() => {
                    throw error;
                  })
                }
              />
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
function TrophyMark() {
  return <div className="treasury-mark">✦</div>;
}
