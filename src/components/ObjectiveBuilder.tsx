import { ObjectiveRow, emptyObjectiveRow } from "../builderUtils";

interface Props {
  rows: ObjectiveRow[];
  onChange: (rows: ObjectiveRow[]) => void;
  hostNames?: string[]; // when provided (project mode), show host selectors + network type
}

const LABELS: Record<ObjectiveRow["type"], string> = {
  file_exists: "A file or directory must exist",
  permission: "A file must have a specific permission",
  service_running: "A service must be running",
  file_contains: "A file must contain specific text",
  network_reachable: "One host must be able to reach another",
};

export default function ObjectiveBuilder({ rows, onChange, hostNames }: Props) {
  const update = (i: number, patch: Partial<ObjectiveRow>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const availableTypes: ObjectiveRow["type"][] = hostNames
    ? ["file_exists", "permission", "service_running", "file_contains", "network_reachable"]
    : ["file_exists", "permission", "service_running", "file_contains"];

  return (
    <div className="field-group">
      <label>Objectives (all must pass for the challenge/project to be marked complete)</label>
      {rows.map((row, i) => (
        <div className="objective-row" key={i}>
          <select
            value={row.type}
            onChange={(e) => update(i, { type: e.target.value as ObjectiveRow["type"] })}
          >
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {LABELS[t]}
              </option>
            ))}
          </select>

          {hostNames && row.type !== "network_reachable" && (
            <select value={row.host ?? ""} onChange={(e) => update(i, { host: e.target.value })}>
              <option value="">Select host…</option>
              {hostNames.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          )}

          {(row.type === "file_exists" || row.type === "permission" || row.type === "file_contains") && (
            <input
              placeholder="/path/to/file"
              value={row.path ?? ""}
              onChange={(e) => update(i, { path: e.target.value })}
            />
          )}

          {row.type === "permission" && (
            <input placeholder="mode e.g. 755" value={row.mode ?? ""} onChange={(e) => update(i, { mode: e.target.value })} />
          )}

          {row.type === "service_running" && (
            <input placeholder="service name e.g. nginx" value={row.service ?? ""} onChange={(e) => update(i, { service: e.target.value })} />
          )}

          {row.type === "file_contains" && (
            <input placeholder="text the file must contain" value={row.text ?? ""} onChange={(e) => update(i, { text: e.target.value })} />
          )}

          {row.type === "network_reachable" && hostNames && (
            <>
              <select value={row.from ?? ""} onChange={(e) => update(i, { from: e.target.value })}>
                <option value="">From host…</option>
                {hostNames.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <select value={row.to ?? ""} onChange={(e) => update(i, { to: e.target.value })}>
                <option value="">To host…</option>
                {hostNames.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="port"
                value={row.port ?? ""}
                onChange={(e) => update(i, { port: e.target.value ? Number(e.target.value) : undefined })}
              />
            </>
          )}

          <button type="button" className="btn-remove" onClick={() => remove(i)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-add" onClick={() => onChange([...rows, emptyObjectiveRow()])}>
        + Add objective
      </button>
    </div>
  );
}
