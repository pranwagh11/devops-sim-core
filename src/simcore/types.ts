// SimCore — shared types
// Simplified single-technology (Linux-only) SystemState model.

export interface FileEntry {
  type: "dir" | "file";
  content?: string;
  mode: string; // e.g. "755", "644"
}

// Flat map of absolute path -> entry. "/" always exists.
export type FileSystem = Record<string, FileEntry>;

export interface ServiceEntry {
  running: boolean;
  port?: number;
  // Set the first time a service transitions to running; cleared on stop.
  // Used to render a realistic "Active: active (running) since ... ago"
  // line and a stable Main PID in `systemctl status`.
  pid?: number;
  startedAt?: string; // ISO timestamp
}

export interface HostState {
  fs: FileSystem;
  users: string[];
  currentUser: string;
  services: Record<string, ServiceEntry>;
  cwd: string;
}

export interface NetworkRule {
  from: string;
  to: string;
  port: number;
  allowed: boolean;
}

export type Objective =
  | { type: "file_exists"; host?: string; path: string }
  | { type: "permission"; host?: string; path: string; mode: string }
  | { type: "service_running"; host?: string; service: string }
  | { type: "file_contains"; host?: string; path: string; text: string }
  | { type: "network_reachable"; from: string; to: string; port: number };

export interface ObjectiveResult {
  objective: Objective;
  passed: boolean;
  label: string;
}

// Deep-clone helper.
export function cloneHostState(state: HostState): HostState {
  return JSON.parse(JSON.stringify(state));
}

export function makeDefaultHostState(): HostState {
  return {
    fs: { "/": { type: "dir", mode: "755" } },
    users: ["student"],
    currentUser: "student",
    services: {},
    cwd: "/",
  };
}

// --- persisted record shapes --------------------------------------------

export type ContentStatus = "draft" | "published";

export interface ChallengeRecord {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  xp: number;
  initial_state: HostState;
  objectives: Objective[];
  hints: string[];
  status: ContentStatus;
  // Captured the first time the author's own test run passes every
  // objective. Shown for transparency only — grading always runs against
  // `objectives`, never a diff against this snapshot.
  reference_snapshot: HostState | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  xp: number;
  hosts: Record<string, HostState>;
  network_rules: NetworkRule[];
  objectives: Objective[];
  hints: string[];
  status: ContentStatus;
  reference_snapshot: Record<string, HostState> | null;
  created_at: string;
  updated_at: string;
}
