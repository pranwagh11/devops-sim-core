import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { storage } from "../storage";
import { LessonRecord, ChallengeRecord, ProjectRecord, ModuleRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function LessonDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [mod, setMod] = useState<ModuleRecord | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [error, setError] = useState("");

  const load = () => {
    const l = storage.getLesson(id!);
    if (!l) {
      setError("Lesson not found.");
      return;
    }
    setLesson(l);
    setMod(storage.getModule(l.module_id) ?? null);
    setChallenges(storage.listChallengesByLesson(id!));
    setProjects(storage.listProjectsByLesson(id!));
  };
  useEffect(load, [id]);

  const handleDeleteChallenge = (challengeId: string) => {
    if (!confirm("Delete this challenge? This cannot be undone.")) return;
    storage.deleteChallenge(challengeId);
    load();
  };
  const handleDeleteProject = (projectId: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    storage.deleteProject(projectId);
    load();
  };

  if (error) return <div className="error-banner">{error}</div>;
  if (!lesson) return <p>Loading…</p>;

  const visibleChallenges = role === "admin" ? challenges : challenges.filter((c) => c.status === "published");
  const visibleProjects = role === "admin" ? projects : projects.filter((p) => p.status === "published");

  return (
    <div className="page">
      {mod && <Link to={`/modules/${mod.id}`} className="back-link">&larr; Back to {mod.title}</Link>}
      <div className="page-header">
        <h2>{lesson.title}</h2>
        {role === "admin" && <Link to={`/lessons/${lesson.id}/edit`} className="btn-small">Edit Lesson</Link>}
      </div>
      <p>{lesson.description}</p>

      <div className="page-header">
        <h3>Challenges</h3>
        {role === "admin" && <Link to={`/challenges/new?lessonId=${lesson.id}`} className="btn-primary">+ New Challenge</Link>}
      </div>
      {visibleChallenges.length === 0 && <p>No challenges yet.</p>}
      <table className="data-table">
        <tbody>
          {visibleChallenges.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.title}</strong>
                <div className="muted">{c.description}</div>
              </td>
              <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
              <td><span className={`badge badge-${c.difficulty}`}>{c.difficulty}</span></td>
              <td>{c.xp} XP</td>
              <td className="actions">
                <Link to={`/challenges/${c.id}/play`} className="btn-small btn-primary">Play</Link>
                {role === "admin" && (
                  <>
                    <Link to={`/challenges/${c.id}/edit`} className="btn-small">Edit</Link>
                    <button className="btn-small btn-danger" onClick={() => handleDeleteChallenge(c.id)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="page-header">
        <h3>Lesson Project</h3>
        {role === "admin" && <Link to={`/projects/new?lessonId=${lesson.id}`} className="btn-secondary">+ New Project</Link>}
      </div>
      {visibleProjects.length === 0 && <p>No project attached to this lesson yet.</p>}
      <table className="data-table">
        <tbody>
          {visibleProjects.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.title}</strong>
                <div className="muted">{p.description}</div>
              </td>
              <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
              <td className="actions">
                <Link to={`/projects/${p.id}/play`} className="btn-small btn-primary">Play</Link>
                {role === "admin" && (
                  <>
                    <Link to={`/projects/${p.id}/edit`} className="btn-small">Edit</Link>
                    <button className="btn-small btn-danger" onClick={() => handleDeleteProject(p.id)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
