import { DirRow, FileRow, ServiceRow } from "../builderUtils";

export interface HostBuilderValue {
  dirs: DirRow[];
  files: FileRow[];
  usersText: string;
  services: ServiceRow[];
}

interface Props {
  value: HostBuilderValue;
  onChange: (value: HostBuilderValue) => void;
}

export const emptyHostBuilder = (): HostBuilderValue => ({
  dirs: [],
  files: [],
  usersText: "student",
  services: [],
});

export default function HostBuilder({ value, onChange }: Props) {
  const set = (patch: Partial<HostBuilderValue>) => onChange({ ...value, ...patch });

  return (
    <div className="host-builder">
      <div className="field-group">
        <label>Directories to create (starting layout)</label>
        {value.dirs.map((d, i) => (
          <div className="row" key={i}>
            <input
              placeholder="/home/student/backup"
              value={d.path}
              onChange={(e) => {
                const dirs = [...value.dirs];
                dirs[i] = { path: e.target.value };
                set({ dirs });
              }}
            />
            <button type="button" className="btn-remove" onClick={() => set({ dirs: value.dirs.filter((_, idx) => idx !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-add" onClick={() => set({ dirs: [...value.dirs, { path: "" }] })}>
          + Add directory
        </button>
      </div>

      <div className="field-group">
        <label>Files to pre-create (path + starting content)</label>
        {value.files.map((f, i) => (
          <div className="row row-file" key={i}>
            <input
              placeholder="/home/student/notes.txt"
              value={f.path}
              onChange={(e) => {
                const files = [...value.files];
                files[i] = { ...files[i], path: e.target.value };
                set({ files });
              }}
            />
            <input
              placeholder="file content (optional)"
              value={f.content}
              onChange={(e) => {
                const files = [...value.files];
                files[i] = { ...files[i], content: e.target.value };
                set({ files });
              }}
            />
            <button type="button" className="btn-remove" onClick={() => set({ files: value.files.filter((_, idx) => idx !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-add" onClick={() => set({ files: [...value.files, { path: "", content: "" }] })}>
          + Add file
        </button>
      </div>

      <div className="field-group">
        <label>Starting users (comma separated)</label>
        <input value={value.usersText} onChange={(e) => set({ usersText: e.target.value })} />
      </div>

      <div className="field-group">
        <label>Services (name, port, running at start?)</label>
        {value.services.map((s, i) => (
          <div className="row row-service" key={i}>
            <input
              placeholder="nginx"
              value={s.name}
              onChange={(e) => {
                const services = [...value.services];
                services[i] = { ...services[i], name: e.target.value };
                set({ services });
              }}
            />
            <input
              type="number"
              placeholder="port (e.g. 80)"
              value={s.port ?? ""}
              onChange={(e) => {
                const services = [...value.services];
                services[i] = { ...services[i], port: e.target.value ? Number(e.target.value) : undefined };
                set({ services });
              }}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={s.running}
                onChange={(e) => {
                  const services = [...value.services];
                  services[i] = { ...services[i], running: e.target.checked };
                  set({ services });
                }}
              />
              Running at start
            </label>
            <button type="button" className="btn-remove" onClick={() => set({ services: value.services.filter((_, idx) => idx !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-add" onClick={() => set({ services: [...value.services, { name: "", running: false }] })}>
          + Add service
        </button>
      </div>
    </div>
  );
}
