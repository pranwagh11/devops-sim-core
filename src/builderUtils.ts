import { FileSystem, ServiceEntry, Objective } from "./simcore/types";

export interface DirRow {
  path: string;
}
export interface FileRow {
  path: string;
  content: string;
}
export interface ServiceRow {
  name: string;
  port?: number;
  running: boolean;
}

// Builds a SimCore FileSystem map from the friendly form rows a
// non-engineer fills in (list of directory paths + list of files/content).
export function buildFs(dirs: DirRow[], files: FileRow[]): FileSystem {
  const fs: FileSystem = { "/": { type: "dir", mode: "755" } };

  const ensureDir = (path: string) => {
    const parts = path.split("/").filter(Boolean);
    let acc = "";
    for (const part of parts) {
      acc += "/" + part;
      if (!fs[acc]) fs[acc] = { type: "dir", mode: "755" };
    }
  };

  dirs.forEach((d) => {
    if (d.path.trim()) ensureDir(d.path.trim());
  });

  files.forEach((f) => {
    if (!f.path.trim()) return;
    const path = f.path.trim();
    const parent = path.slice(0, path.lastIndexOf("/")) || "/";
    if (parent !== "/") ensureDir(parent);
    fs[path] = { type: "file", content: f.content ?? "", mode: "644" };
  });

  return fs;
}

// Reverse operation — used when loading an existing challenge/project into
// the edit form, so the builder shows the same directories/files back.
export function extractFromFs(fs: FileSystem): { dirs: DirRow[]; files: FileRow[] } {
  const dirs: DirRow[] = [];
  const files: FileRow[] = [];
  Object.entries(fs).forEach(([path, entry]) => {
    if (path === "/") return;
    if (entry.type === "dir") dirs.push({ path });
    else files.push({ path, content: entry.content ?? "" });
  });
  return { dirs, files };
}

export function buildServices(rows: ServiceRow[]): Record<string, ServiceEntry> {
  const services: Record<string, ServiceEntry> = {};
  rows.forEach((r) => {
    if (!r.name.trim()) return;
    services[r.name.trim()] = { running: r.running, port: r.port };
  });
  return services;
}

export function extractServices(services: Record<string, ServiceEntry>): ServiceRow[] {
  return Object.entries(services).map(([name, s]) => ({
    name,
    port: s.port,
    running: s.running,
  }));
}

export function parseUsers(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatUsers(users: string[]): string {
  return users.join(", ");
}

// --- objective builder rows --------------------------------------------

export interface ObjectiveRow {
  type: "file_exists" | "permission" | "service_running" | "file_contains" | "network_reachable";
  host?: string;
  path?: string;
  mode?: string;
  service?: string;
  text?: string;
  from?: string;
  to?: string;
  port?: number;
}

export function emptyObjectiveRow(): ObjectiveRow {
  return { type: "file_exists", path: "" };
}

// Converts friendly form rows into the strict Objective[] shape the
// validator expects. Incomplete rows (missing required fields) are skipped
// rather than sent to the backend half-filled.
export function buildObjectives(rows: ObjectiveRow[]): Objective[] {
  const result: Objective[] = [];
  for (const r of rows) {
    switch (r.type) {
      case "file_exists":
        if (r.path) result.push({ type: "file_exists", host: r.host, path: r.path });
        break;
      case "permission":
        if (r.path && r.mode) result.push({ type: "permission", host: r.host, path: r.path, mode: r.mode });
        break;
      case "service_running":
        if (r.service) result.push({ type: "service_running", host: r.host, service: r.service });
        break;
      case "file_contains":
        if (r.path && r.text) result.push({ type: "file_contains", host: r.host, path: r.path, text: r.text });
        break;
      case "network_reachable":
        if (r.from && r.to && r.port) result.push({ type: "network_reachable", from: r.from, to: r.to, port: r.port });
        break;
    }
  }
  return result;
}

export function extractObjectiveRows(objectives: Objective[]): ObjectiveRow[] {
  return objectives.map((o) => ({ ...o } as unknown as ObjectiveRow));
}
