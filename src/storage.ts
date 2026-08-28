import { ChallengeRecord, ProjectRecord } from "./simcore/types";

const CHALLENGES_KEY = "devops-sim:challenges";
const PROJECTS_KEY = "devops-sim:projects";
const SEEDED_KEY = "devops-sim:seeded";

function readAll<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeAll<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- one-time seed on first load ---------------------------------------

export async function ensureSeeded(): Promise<void> {
  if (localStorage.getItem(SEEDED_KEY)) return;
  try {
    //const base = import.meta.env.BASE_URL || "/";
	const base = "/";
    const res = await fetch(`${base}seed-data.json`);
    if (res.ok) {
      const seed = await res.json();
      if (readAll<ChallengeRecord>(CHALLENGES_KEY).length === 0) {
        writeAll(CHALLENGES_KEY, seed.challenges ?? []);
      }
      if (readAll<ProjectRecord>(PROJECTS_KEY).length === 0) {
        writeAll(PROJECTS_KEY, seed.projects ?? []);
      }
    }
  } catch {
    // No seed file available — app still works, just starts empty.
  } finally {
    localStorage.setItem(SEEDED_KEY, "true");
  }
}

// --- challenges ----------------------------------------------------------

export const storage = {
  listChallenges(): ChallengeRecord[] {
    return readAll<ChallengeRecord>(CHALLENGES_KEY).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },
  getChallenge(id: string): ChallengeRecord | undefined {
    return readAll<ChallengeRecord>(CHALLENGES_KEY).find((c) => c.id === id);
  },
  saveChallenge(data: Omit<ChallengeRecord, "id" | "created_at" | "updated_at"> & { id?: string }): ChallengeRecord {
    const all = readAll<ChallengeRecord>(CHALLENGES_KEY);
    const ts = nowIso();
    if (data.id) {
      const idx = all.findIndex((c) => c.id === data.id);
      if (idx === -1) throw new Error("Challenge not found");
      const updated: ChallengeRecord = { ...all[idx], ...data, id: data.id, updated_at: ts };
      all[idx] = updated;
      writeAll(CHALLENGES_KEY, all);
      return updated;
    }
    const created: ChallengeRecord = { ...data, id: newId(), created_at: ts, updated_at: ts } as ChallengeRecord;
    all.push(created);
    writeAll(CHALLENGES_KEY, all);
    return created;
  },
  deleteChallenge(id: string): void {
    writeAll(CHALLENGES_KEY, readAll<ChallengeRecord>(CHALLENGES_KEY).filter((c) => c.id !== id));
  },

  // --- projects ----------------------------------------------------------

  listProjects(): ProjectRecord[] {
    return readAll<ProjectRecord>(PROJECTS_KEY).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },
  getProject(id: string): ProjectRecord | undefined {
    return readAll<ProjectRecord>(PROJECTS_KEY).find((p) => p.id === id);
  },
  saveProject(data: Omit<ProjectRecord, "id" | "created_at" | "updated_at"> & { id?: string }): ProjectRecord {
    const all = readAll<ProjectRecord>(PROJECTS_KEY);
    const ts = nowIso();
    if (data.id) {
      const idx = all.findIndex((p) => p.id === data.id);
      if (idx === -1) throw new Error("Project not found");
      const updated: ProjectRecord = { ...all[idx], ...data, id: data.id, updated_at: ts };
      all[idx] = updated;
      writeAll(PROJECTS_KEY, all);
      return updated;
    }
    const created: ProjectRecord = { ...data, id: newId(), created_at: ts, updated_at: ts } as ProjectRecord;
    all.push(created);
    writeAll(PROJECTS_KEY, all);
    return created;
  },
  deleteProject(id: string): void {
    writeAll(PROJECTS_KEY, readAll<ProjectRecord>(PROJECTS_KEY).filter((p) => p.id !== id));
  },

  // --- export / import (the "JSON file" the person interacts with) ------

  exportAll(): string {
    const data = {
      exported_at: nowIso(),
      challenges: readAll<ChallengeRecord>(CHALLENGES_KEY),
      projects: readAll<ProjectRecord>(PROJECTS_KEY),
    };
    return JSON.stringify(data, null, 2);
  },

  importAll(json: string, mode: "replace" | "merge" = "merge"): void {
    const parsed = JSON.parse(json);
    const incomingChallenges: ChallengeRecord[] = parsed.challenges ?? [];
    const incomingProjects: ProjectRecord[] = parsed.projects ?? [];

    if (mode === "replace") {
      writeAll(CHALLENGES_KEY, incomingChallenges);
      writeAll(PROJECTS_KEY, incomingProjects);
      return;
    }

    const existingChallenges = readAll<ChallengeRecord>(CHALLENGES_KEY);
    const existingProjects = readAll<ProjectRecord>(PROJECTS_KEY);
    const mergedChallenges = [...existingChallenges];
    incomingChallenges.forEach((c) => {
      const idx = mergedChallenges.findIndex((x) => x.id === c.id);
      if (idx === -1) mergedChallenges.push(c);
      else mergedChallenges[idx] = c;
    });
    const mergedProjects = [...existingProjects];
    incomingProjects.forEach((p) => {
      const idx = mergedProjects.findIndex((x) => x.id === p.id);
      if (idx === -1) mergedProjects.push(p);
      else mergedProjects[idx] = p;
    });
    writeAll(CHALLENGES_KEY, mergedChallenges);
    writeAll(PROJECTS_KEY, mergedProjects);
  },

  clearAll(): void {
    localStorage.removeItem(CHALLENGES_KEY);
    localStorage.removeItem(PROJECTS_KEY);
    localStorage.removeItem(SEEDED_KEY);
  },
};

export function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
