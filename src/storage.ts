import { ChallengeRecord, ProjectRecord, ModuleRecord, LessonRecord } from "./simcore/types";

const MODULES_KEY = "devops-sim:modules";
const LESSONS_KEY = "devops-sim:lessons";
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
// Each collection is seeded independently, gated only by "is this specific
// collection currently empty" rather than a single global flag. This is
// deliberately idempotent and self-healing: someone with leftover
// pre-Module-hierarchy data (challenges but no modules/lessons yet) still
// gets the modules/lessons filled in on their next load, instead of being
// permanently skipped because a global "already seeded" flag was set long
// before modules/lessons existed.
export async function ensureSeeded(): Promise<void> {
  try {
    // Resolve against document.baseURI (not simple string concatenation)
    // so this works regardless of whether the deployed URL has a trailing
    // slash, and regardless of HashRouter's #/route suffix. A plain
    // `${base}seed-data.json` fetch is fragile: if the page is loaded as
    // https://user.github.io/repo (no trailing slash) instead of
    // https://user.github.io/repo/, a naive relative fetch resolves one
    // directory too high and 404s even though the file is right there.
    const seedUrl = new URL(`${import.meta.env.BASE_URL}seed-data.json`, document.baseURI).toString();
    const res = await fetch(seedUrl);
    if (!res.ok) {
      console.warn(`[devops-sim] seed-data.json fetch returned ${res.status} for ${seedUrl}. ` +
        "Check that seed-data.json was actually deployed alongside index.html at that exact path.");
      return;
    }
    const seed = await res.json();
    if (readAll<ModuleRecord>(MODULES_KEY).length === 0) writeAll(MODULES_KEY, seed.modules ?? []);
    if (readAll<LessonRecord>(LESSONS_KEY).length === 0) writeAll(LESSONS_KEY, seed.lessons ?? []);
    if (readAll<ChallengeRecord>(CHALLENGES_KEY).length === 0) writeAll(CHALLENGES_KEY, seed.challenges ?? []);
    if (readAll<ProjectRecord>(PROJECTS_KEY).length === 0) writeAll(PROJECTS_KEY, seed.projects ?? []);
  } catch {
    // No seed file available — app still works, just starts empty.
  }
}

export const storage = {
  // --- modules -------------------------------------------------------

  listModules(): ModuleRecord[] {
    return readAll<ModuleRecord>(MODULES_KEY).sort((a, b) => a.order - b.order);
  },
  getModule(id: string): ModuleRecord | undefined {
    return readAll<ModuleRecord>(MODULES_KEY).find((m) => m.id === id);
  },
  saveModule(data: Omit<ModuleRecord, "id" | "created_at" | "updated_at"> & { id?: string }): ModuleRecord {
    const all = readAll<ModuleRecord>(MODULES_KEY);
    const ts = nowIso();
    if (data.id) {
      const idx = all.findIndex((m) => m.id === data.id);
      if (idx === -1) throw new Error("Module not found");
      const updated: ModuleRecord = { ...all[idx], ...data, id: data.id, updated_at: ts };
      all[idx] = updated;
      writeAll(MODULES_KEY, all);
      return updated;
    }
    const created: ModuleRecord = { ...data, id: newId(), created_at: ts, updated_at: ts } as ModuleRecord;
    all.push(created);
    writeAll(MODULES_KEY, all);
    return created;
  },
  // Cascades: every lesson in this module, every challenge under those
  // lessons, and every project attached to this module or its lessons.
  // There are no foreign keys enforcing this, so the app is responsible
  // for not leaving orphaned records behind.
  deleteModule(id: string): void {
    const lessonIds = readAll<LessonRecord>(LESSONS_KEY)
      .filter((l) => l.module_id === id)
      .map((l) => l.id);
    writeAll(MODULES_KEY, readAll<ModuleRecord>(MODULES_KEY).filter((m) => m.id !== id));
    writeAll(LESSONS_KEY, readAll<LessonRecord>(LESSONS_KEY).filter((l) => l.module_id !== id));
    writeAll(
      CHALLENGES_KEY,
      readAll<ChallengeRecord>(CHALLENGES_KEY).filter((c) => !lessonIds.includes(c.lesson_id))
    );
    writeAll(
      PROJECTS_KEY,
      readAll<ProjectRecord>(PROJECTS_KEY).filter(
        (p) => p.module_id !== id && !(p.lesson_id && lessonIds.includes(p.lesson_id))
      )
    );
  },

  // --- lessons -------------------------------------------------------

  listLessons(): LessonRecord[] {
    return readAll<LessonRecord>(LESSONS_KEY).sort((a, b) => a.order - b.order);
  },
  listLessonsByModule(moduleId: string): LessonRecord[] {
    return storage.listLessons().filter((l) => l.module_id === moduleId);
  },
  getLesson(id: string): LessonRecord | undefined {
    return readAll<LessonRecord>(LESSONS_KEY).find((l) => l.id === id);
  },
  saveLesson(data: Omit<LessonRecord, "id" | "created_at" | "updated_at"> & { id?: string }): LessonRecord {
    const all = readAll<LessonRecord>(LESSONS_KEY);
    const ts = nowIso();
    if (data.id) {
      const idx = all.findIndex((l) => l.id === data.id);
      if (idx === -1) throw new Error("Lesson not found");
      const updated: LessonRecord = { ...all[idx], ...data, id: data.id, updated_at: ts };
      all[idx] = updated;
      writeAll(LESSONS_KEY, all);
      return updated;
    }
    const created: LessonRecord = { ...data, id: newId(), created_at: ts, updated_at: ts } as LessonRecord;
    all.push(created);
    writeAll(LESSONS_KEY, all);
    return created;
  },
  deleteLesson(id: string): void {
    writeAll(LESSONS_KEY, readAll<LessonRecord>(LESSONS_KEY).filter((l) => l.id !== id));
    writeAll(CHALLENGES_KEY, readAll<ChallengeRecord>(CHALLENGES_KEY).filter((c) => c.lesson_id !== id));
    writeAll(
      PROJECTS_KEY,
      readAll<ProjectRecord>(PROJECTS_KEY).filter((p) => p.lesson_id !== id)
    );
  },

  // --- challenges ------------------------------------------------------

  listChallenges(): ChallengeRecord[] {
    return readAll<ChallengeRecord>(CHALLENGES_KEY).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },
  listChallengesByLesson(lessonId: string): ChallengeRecord[] {
    return storage.listChallenges().filter((c) => c.lesson_id === lessonId);
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
  listProjectsByLesson(lessonId: string): ProjectRecord[] {
    return storage.listProjects().filter((p) => p.lesson_id === lessonId);
  },
  listProjectsByModule(moduleId: string): ProjectRecord[] {
    // Module-level capstones only — projects attached to a specific lesson
    // within the module are shown on that lesson instead.
    return storage.listProjects().filter((p) => p.module_id === moduleId && !p.lesson_id);
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
      modules: readAll<ModuleRecord>(MODULES_KEY),
      lessons: readAll<LessonRecord>(LESSONS_KEY),
      challenges: readAll<ChallengeRecord>(CHALLENGES_KEY),
      projects: readAll<ProjectRecord>(PROJECTS_KEY),
    };
    return JSON.stringify(data, null, 2);
  },

  importAll(json: string, mode: "replace" | "merge" = "merge"): void {
    const parsed = JSON.parse(json);
    const incoming = {
      modules: (parsed.modules ?? []) as ModuleRecord[],
      lessons: (parsed.lessons ?? []) as LessonRecord[],
      challenges: (parsed.challenges ?? []) as ChallengeRecord[],
      projects: (parsed.projects ?? []) as ProjectRecord[],
    };

    if (mode === "replace") {
      writeAll(MODULES_KEY, incoming.modules);
      writeAll(LESSONS_KEY, incoming.lessons);
      writeAll(CHALLENGES_KEY, incoming.challenges);
      writeAll(PROJECTS_KEY, incoming.projects);
      return;
    }

    function mergeInto<T extends { id: string }>(key: string, incomingItems: T[]) {
      const existing = readAll<T>(key);
      const merged = [...existing];
      incomingItems.forEach((item) => {
        const idx = merged.findIndex((x) => x.id === item.id);
        if (idx === -1) merged.push(item);
        else merged[idx] = item;
      });
      writeAll(key, merged);
    }

    mergeInto(MODULES_KEY, incoming.modules);
    mergeInto(LESSONS_KEY, incoming.lessons);
    mergeInto(CHALLENGES_KEY, incoming.challenges);
    mergeInto(PROJECTS_KEY, incoming.projects);
  },

  clearAll(): void {
    localStorage.removeItem(MODULES_KEY);
    localStorage.removeItem(LESSONS_KEY);
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
