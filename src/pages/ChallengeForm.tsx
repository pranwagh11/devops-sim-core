import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { storage } from "../storage";
import { useAuth } from "../auth";
import HostBuilder, { emptyHostBuilder, HostBuilderValue } from "../components/HostBuilder";
import ObjectiveBuilder from "../components/ObjectiveBuilder";
import HintsBuilder from "../components/HintsBuilder";
import ChallengePlayer from "../components/ChallengePlayer";
import {
  buildFs,
  extractFromFs,
  buildServices,
  extractServices,
  parseUsers,
  formatUsers,
  buildObjectives,
  extractObjectiveRows,
  ObjectiveRow,
} from "../builderUtils";
import { HostState, ObjectiveResult, ModuleRecord, LessonRecord } from "../simcore/types";

export default function ChallengeForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState(searchParams.get("lessonId") ?? "");
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [xp, setXp] = useState(10);
  const [host, setHost] = useState<HostBuilderValue>(emptyHostBuilder());
  const [objectiveRows, setObjectiveRows] = useState<ObjectiveRow[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);

  const [testStarted, setTestStarted] = useState(false);
  const [testResetToken, setTestResetToken] = useState(0);
  const [testPassed, setTestPassed] = useState(false);
  const [referenceSnapshot, setReferenceSnapshot] = useState<HostState | null>(null);
  const [lastResults, setLastResults] = useState<ObjectiveResult[]>([]);
  const [testInitialState, setTestInitialState] = useState<HostState | null>(null);
  const [testObjectives, setTestObjectives] = useState<ReturnType<typeof buildObjectives>>([]);

  useEffect(() => {
    setModules(storage.listModules());
    setLessons(storage.listLessons());
  }, []);

  useEffect(() => {
    if (isEdit) return;
    if (lessonId) {
      const l = storage.getLesson(lessonId);
      if (l) setModuleId(l.module_id);
    }
  }, [lessonId, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    const c = storage.getChallenge(id!);
    if (!c) {
      setError("Challenge not found.");
      setLoading(false);
      return;
    }
    setLessonId(c.lesson_id);
    const l = storage.getLesson(c.lesson_id);
    if (l) setModuleId(l.module_id);
    setTitle(c.title);
    setDescription(c.description ?? "");
    setDifficulty(c.difficulty ?? "beginner");
    setXp(c.xp ?? 10);
    const { dirs, files } = extractFromFs(c.initial_state.fs ?? {});
    setHost({
      dirs,
      files,
      usersText: formatUsers(c.initial_state.users ?? []),
      services: extractServices(c.initial_state.services ?? {}),
    });
    setObjectiveRows(extractObjectiveRows(c.objectives ?? []));
    setHints(c.hints ?? []);
    setReferenceSnapshot(c.reference_snapshot ?? null);
    setTestPassed(c.status === "published");
    setLoading(false);
  }, [id, isEdit]);

  if (role !== "admin") {
    return (
      <div className="page">
        <div className="error-banner">Admin access required to create or edit challenges.</div>
      </div>
    );
  }

  const lessonsInModule = lessons.filter((l) => l.module_id === moduleId);

  const buildInitialState = (): HostState => {
    const users = parseUsers(host.usersText);
    return {
      fs: buildFs(host.dirs, host.files),
      users,
      currentUser: users[0] ?? "student",
      services: buildServices(host.services),
      cwd: "/",
    };
  };

  const handleLoadTest = () => {
    setError("");
    const objectives = buildObjectives(objectiveRows);
    if (objectives.length === 0) {
      setError("Add at least one complete objective before testing.");
      return;
    }
    setTestInitialState(buildInitialState());
    setTestObjectives(objectives);
    setTestStarted(true);
    setTestResetToken((t) => t + 1);
  };

  const handleEvaluate = (results: ObjectiveResult[], allPassed: boolean, finalState: HostState) => {
    setLastResults(results);
    if (allPassed) {
      setTestPassed(true);
      setReferenceSnapshot(finalState);
    }
  };

  const persist = (status: "draft" | "published") => {
    setError("");
    if (!lessonId) {
      setError("Select a lesson for this challenge.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const objectives = buildObjectives(objectiveRows);
    if (objectives.length === 0) {
      setError("Add at least one complete objective.");
      return;
    }
    if (status === "published" && !testPassed) {
      setError("You must successfully complete your own test run before publishing.");
      return;
    }

    const payload = {
      lesson_id: lessonId,
      title,
      description,
      difficulty,
      xp,
      initial_state: buildInitialState(),
      objectives,
      hints: hints.filter(Boolean),
      status,
      reference_snapshot: referenceSnapshot,
    };

    try {
      storage.saveChallenge(isEdit ? { ...payload, id } : payload);
      navigate(`/lessons/${lessonId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="page">
      <h2>{isEdit ? "Edit Challenge" : "New Challenge"}</h2>
      <p className="help-text">
        A challenge is a single-host task, usually built around one command or concept. Fill in the
        starting environment and objectives below, test it yourself in a real terminal, then publish
        once your own solution passes. Grading always runs against the objectives you define — a
        learner using a different valid command sequence than yours will still pass.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="builder-form">
        <h3>1. Define</h3>
        <div className="row">
          <div className="field-group">
            <label>Module</label>
            <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }}>
              <option value="">Select module…</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Lesson</label>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!moduleId}>
              <option value="">Select lesson…</option>
              {lessonsInModule.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
        </div>

        <div className="field-group">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Create Your First Directory" />
        </div>
        <div className="field-group">
          <label>Description (shown to the learner)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="row">
          <div className="field-group">
            <label>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="field-group">
            <label>XP awarded</label>
            <input type="number" value={xp} onChange={(e) => setXp(Number(e.target.value))} />
          </div>
        </div>

        <h4>Starting Environment</h4>
        <HostBuilder value={host} onChange={setHost} />

        <h4>Objectives</h4>
        <ObjectiveBuilder rows={objectiveRows} onChange={setObjectiveRows} />

        <h4>Hints</h4>
        <HintsBuilder hints={hints} onChange={setHints} />

        <h3>2. Test</h3>
        <p className="help-text">
          Load your own starting environment and objectives into a live terminal, then solve it
          exactly as a learner would. Publish unlocks once every objective shows passed.
        </p>
        <button type="button" className="btn-secondary" onClick={handleLoadTest}>
          {testStarted ? "Reload Test Environment" : "Load Test Environment"}
        </button>

        {testStarted && testInitialState && (
          <div className="test-box">
            <ChallengePlayer
              initialState={testInitialState}
              objectives={testObjectives}
              hints={hints.filter(Boolean)}
              resetToken={testResetToken}
              onEvaluate={handleEvaluate}
            />
            <p className={testPassed ? "test-status test-status-pass" : "test-status"}>
              {testPassed
                ? "✅ Tested successfully — this challenge is ready to publish."
                : `Not tested yet — ${lastResults.filter((r) => r.passed).length}/${lastResults.length} objectives passing.`}
            </p>
          </div>
        )}

        <h3>3. Save</h3>
        {referenceSnapshot && (
          <details className="snapshot-box">
            <summary>View reference snapshot (final state from your passing test — for your own reference only, not used for grading)</summary>
            <pre>{JSON.stringify(referenceSnapshot, null, 2)}</pre>
          </details>
        )}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => persist("draft")}>Save as Draft</button>
          <button type="button" className="btn-primary" disabled={!testPassed} onClick={() => persist("published")}>Publish</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(lessonId ? `/lessons/${lessonId}` : "/modules")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
