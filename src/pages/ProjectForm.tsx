import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { storage } from "../storage";
import { useAuth } from "../auth";
import HostBuilder, { emptyHostBuilder, HostBuilderValue } from "../components/HostBuilder";
import ObjectiveBuilder from "../components/ObjectiveBuilder";
import HintsBuilder from "../components/HintsBuilder";
import ProjectPlayer from "../components/ProjectPlayer";
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
import { HostState, NetworkRule, ObjectiveResult, ModuleRecord, LessonRecord } from "../simcore/types";

interface NamedHost {
  name: string;
  builder: HostBuilderValue;
}
interface NetworkRuleRow {
  from: string;
  to: string;
  port: number | undefined;
  allowed: boolean;
}
type Attachment = "lesson" | "module" | "standalone";

export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const [attachment, setAttachment] = useState<Attachment>(
    searchParams.get("lessonId") ? "lesson" : searchParams.get("moduleId") ? "module" : "standalone"
  );
  const [moduleId, setModuleId] = useState(searchParams.get("moduleId") ?? "");
  const [lessonId, setLessonId] = useState(searchParams.get("lessonId") ?? "");
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [xp, setXp] = useState(50);
  const [hosts, setHosts] = useState<NamedHost[]>([{ name: "web01", builder: emptyHostBuilder() }]);
  const [rules, setRules] = useState<NetworkRuleRow[]>([]);
  const [objectiveRows, setObjectiveRows] = useState<ObjectiveRow[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);

  const [testStarted, setTestStarted] = useState(false);
  const [testResetToken, setTestResetToken] = useState(0);
  const [testPassed, setTestPassed] = useState(false);
  const [referenceSnapshot, setReferenceSnapshot] = useState<Record<string, HostState> | null>(null);
  const [lastResults, setLastResults] = useState<ObjectiveResult[]>([]);
  const [testHosts, setTestHosts] = useState<Record<string, HostState> | null>(null);
  const [testRules, setTestRules] = useState<NetworkRule[]>([]);
  const [testObjectives, setTestObjectives] = useState<ReturnType<typeof buildObjectives>>([]);

  const hostNames = hosts.map((h) => h.name).filter(Boolean);

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
    const p = storage.getProject(id!);
    if (!p) {
      setError("Project not found.");
      setLoading(false);
      return;
    }
    if (p.lesson_id) {
      setAttachment("lesson");
      setLessonId(p.lesson_id);
      const l = storage.getLesson(p.lesson_id);
      if (l) setModuleId(l.module_id);
    } else if (p.module_id) {
      setAttachment("module");
      setModuleId(p.module_id);
    } else {
      setAttachment("standalone");
    }
    setTitle(p.title);
    setDescription(p.description ?? "");
    setDifficulty(p.difficulty ?? "intermediate");
    setXp(p.xp ?? 50);
    const namedHosts: NamedHost[] = Object.entries(p.hosts).map(([name, hs]) => {
      const { dirs, files } = extractFromFs(hs.fs ?? {});
      return { name, builder: { dirs, files, usersText: formatUsers(hs.users ?? []), services: extractServices(hs.services ?? {}) } };
    });
    setHosts(namedHosts.length ? namedHosts : [{ name: "web01", builder: emptyHostBuilder() }]);
    setRules((p.network_rules ?? []).map((r) => ({ from: r.from, to: r.to, port: r.port, allowed: r.allowed })));
    setObjectiveRows(extractObjectiveRows(p.objectives ?? []));
    setHints(p.hints ?? []);
    setReferenceSnapshot(p.reference_snapshot ?? null);
    setTestPassed(p.status === "published");
    setLoading(false);
  }, [id, isEdit]);

  if (role !== "admin") {
    return (
      <div className="page">
        <div className="error-banner">Admin access required to create or edit projects.</div>
      </div>
    );
  }

  const lessonsInModule = lessons.filter((l) => l.module_id === moduleId);

  const updateHostName = (i: number, name: string) => {
    const next = [...hosts];
    next[i] = { ...next[i], name };
    setHosts(next);
  };
  const updateHostBuilder = (i: number, builder: HostBuilderValue) => {
    const next = [...hosts];
    next[i] = { ...next[i], builder };
    setHosts(next);
  };
  const removeHost = (i: number) => setHosts(hosts.filter((_, idx) => idx !== i));

  const buildHostsPayload = (): Record<string, HostState> => {
    const payload: Record<string, HostState> = {};
    hosts.forEach((h) => {
      if (!h.name.trim()) return;
      const users = parseUsers(h.builder.usersText);
      payload[h.name.trim()] = {
        fs: buildFs(h.builder.dirs, h.builder.files),
        users,
        currentUser: users[0] ?? "student",
        services: buildServices(h.builder.services),
        cwd: "/",
      };
    });
    return payload;
  };

  const buildRulesPayload = (): NetworkRule[] =>
    rules.filter((r) => r.from && r.to && r.port).map((r) => ({ from: r.from, to: r.to, port: r.port as number, allowed: r.allowed }));

  const handleLoadTest = () => {
    setError("");
    if (hostNames.length === 0) return setError("Add at least one host before testing.");
    const objectives = buildObjectives(objectiveRows);
    if (objectives.length === 0) return setError("Add at least one complete objective before testing.");
    setTestHosts(buildHostsPayload());
    setTestRules(buildRulesPayload());
    setTestObjectives(objectives);
    setTestStarted(true);
    setTestResetToken((t) => t + 1);
  };

  const handleEvaluate = (results: ObjectiveResult[], allPassed: boolean, finalHosts: Record<string, HostState>) => {
    setLastResults(results);
    if (allPassed) {
      setTestPassed(true);
      setReferenceSnapshot(finalHosts);
    }
  };

  const persist = (status: "draft" | "published") => {
    setError("");
    if (attachment === "lesson" && !lessonId) return setError("Select a lesson, or change the attachment type.");
    if (attachment === "module" && !moduleId) return setError("Select a module, or change the attachment type.");
    if (!title.trim()) return setError("Title is required.");
    if (hostNames.length === 0) return setError("Add at least one host.");
    const objectives = buildObjectives(objectiveRows);
    if (objectives.length === 0) return setError("Add at least one complete objective.");
    if (status === "published" && !testPassed) return setError("You must successfully complete your own test run before publishing.");

    const payload = {
      lesson_id: attachment === "lesson" ? lessonId : null,
      module_id: attachment === "lesson" ? null : attachment === "module" ? moduleId : null,
      title,
      description,
      difficulty,
      xp,
      hosts: buildHostsPayload(),
      network_rules: buildRulesPayload(),
      objectives,
      hints: hints.filter(Boolean),
      status,
      reference_snapshot: referenceSnapshot,
    };

    try {
      storage.saveProject(isEdit ? { ...payload, id } : payload);
      if (attachment === "lesson") navigate(`/lessons/${lessonId}`);
      else if (attachment === "module") navigate(`/modules/${moduleId}`);
      else navigate("/projects");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="page">
      <h2>{isEdit ? "Edit Project" : "New Project"}</h2>
      <p className="help-text">
        A project can span multiple simulated hosts. Add a host for each machine, set up its
        starting environment, define network rules for which hosts can reach which, then test the
        whole thing yourself before publishing.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="builder-form">
        <h3>1. Define</h3>

        <div className="field-group">
          <label>Attach this project to</label>
          <select value={attachment} onChange={(e) => setAttachment(e.target.value as Attachment)}>
            <option value="lesson">A specific lesson (shown at the end of that lesson)</option>
            <option value="module">A whole module (capstone project)</option>
            <option value="standalone">Standalone (assign manually later, not shown on any module/lesson page)</option>
          </select>
        </div>

        {(attachment === "lesson" || attachment === "module") && (
          <div className="row">
            <div className="field-group">
              <label>Module</label>
              <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }}>
                <option value="">Select module…</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            {attachment === "lesson" && (
              <div className="field-group">
                <label>Lesson</label>
                <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!moduleId}>
                  <option value="">Select lesson…</option>
                  {lessonsInModule.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="field-group">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Three-Tier Web Deployment" />
        </div>
        <div className="field-group">
          <label>Description</label>
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

        <h4>Hosts</h4>
        {hosts.map((h, i) => (
          <div className="host-card" key={i}>
            <div className="row">
              <input className="host-name-input" placeholder="host name e.g. web01" value={h.name} onChange={(e) => updateHostName(i, e.target.value)} />
              <button type="button" className="btn-remove" onClick={() => removeHost(i)}>Remove host</button>
            </div>
            <HostBuilder value={h.builder} onChange={(b) => updateHostBuilder(i, b)} />
          </div>
        ))}
        <button type="button" className="btn-add" onClick={() => setHosts([...hosts, { name: `host${hosts.length + 1}`, builder: emptyHostBuilder() }])}>
          + Add host
        </button>

        <h4>Network Rules</h4>
        {rules.map((r, i) => (
          <div className="row row-network" key={i}>
            <select value={r.from} onChange={(e) => setRules(rules.map((x, idx) => (idx === i ? { ...x, from: e.target.value } : x)))}>
              <option value="">From host…</option>
              {hostNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={r.to} onChange={(e) => setRules(rules.map((x, idx) => (idx === i ? { ...x, to: e.target.value } : x)))}>
              <option value="">To host…</option>
              {hostNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input
              type="number"
              placeholder="port"
              value={r.port ?? ""}
              onChange={(e) => setRules(rules.map((x, idx) => (idx === i ? { ...x, port: e.target.value ? Number(e.target.value) : undefined } : x)))}
            />
            <label className="checkbox-label">
              <input type="checkbox" checked={r.allowed} onChange={(e) => setRules(rules.map((x, idx) => (idx === i ? { ...x, allowed: e.target.checked } : x)))} />
              Allowed
            </label>
            <button type="button" className="btn-remove" onClick={() => setRules(rules.filter((_, idx) => idx !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn-add" onClick={() => setRules([...rules, { from: "", to: "", port: undefined, allowed: true }])}>
          + Add network rule
        </button>

        <h4>Objectives</h4>
        <ObjectiveBuilder rows={objectiveRows} onChange={setObjectiveRows} hostNames={hostNames} />

        <h4>Hints</h4>
        <HintsBuilder hints={hints} onChange={setHints} />

        <h3>2. Test</h3>
        <p className="help-text">
          Load the whole multi-host environment into live terminals — one per host — and solve it
          yourself, including any cross-host steps (ssh, curl).
        </p>
        <button type="button" className="btn-secondary" onClick={handleLoadTest}>
          {testStarted ? "Reload Test Environment" : "Load Test Environment"}
        </button>

        {testStarted && testHosts && (
          <div className="test-box">
            <ProjectPlayer
              hosts={testHosts}
              networkRules={testRules}
              objectives={testObjectives}
              hints={hints.filter(Boolean)}
              resetToken={testResetToken}
              onEvaluate={handleEvaluate}
            />
            <p className={testPassed ? "test-status test-status-pass" : "test-status"}>
              {testPassed
                ? "✅ Tested successfully — this project is ready to publish."
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
          <button type="button" className="btn-secondary" onClick={() => navigate("/projects")}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
