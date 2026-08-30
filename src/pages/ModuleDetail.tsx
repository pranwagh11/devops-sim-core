import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { storage } from "../storage";
import { ModuleRecord, LessonRecord, ProjectRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function ModuleDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const [mod, setMod] = useState<ModuleRecord | null>(null);
  const [lessons, setLessons] = useState<LessonRecord[]>([]);
  const [capstones, setCapstones] = useState<ProjectRecord[]>([]);
  const [error, setError] = useState("");

  const load = () => {
    const m = storage.getModule(id!);
    if (!m) {
      setError("Module not found.");
      return;
    }
    setMod(m);
    setLessons(storage.listLessonsByModule(id!));
    setCapstones(storage.listProjectsByModule(id!));
  };
  useEffect(load, [id]);

  const handleDeleteLesson = (lessonId: string) => {
    if (!confirm("Delete this lesson? This also deletes every challenge and project inside it. This cannot be undone.")) return;
    storage.deleteLesson(lessonId);
    load();
  };

  if (error) return <div className="error-banner">{error}</div>;
  if (!mod) return <p>Loading…</p>;

  const visibleCapstones = role === "admin" ? capstones : capstones.filter((p) => p.status === "published");

  return (
    <div className="page">
      <Link to="/modules" className="back-link">&larr; Back to Modules</Link>
      <div className="page-header">
        <h2>{mod.title}</h2>
        {role === "admin" && <Link to={`/lessons/new?moduleId=${mod.id}`} className="btn-primary">+ New Lesson</Link>}
      </div>
      <p>{mod.description}</p>

      {lessons.length === 0 && <p>No lessons yet in this module.</p>}
      <div className="lesson-list">
        {lessons.map((l) => {
          const challengeCount = storage.listChallengesByLesson(l.id).filter((c) => role === "admin" || c.status === "published").length;
          return (
            <div className="lesson-row" key={l.id}>
              <div>
                <Link to={`/lessons/${l.id}`} className="lesson-title">{l.title}</Link>
                <p className="muted">{l.description}</p>
                <p className="muted">{challengeCount} challenge{challengeCount === 1 ? "" : "s"}</p>
              </div>
              {role === "admin" && (
                <div className="actions">
                  <Link to={`/lessons/${l.id}/edit`} className="btn-small">Edit</Link>
                  <button className="btn-small btn-danger" onClick={() => handleDeleteLesson(l.id)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3>Module Capstone Projects</h3>
      <p className="help-text">Projects assigned to the whole module rather than a single lesson.</p>
      {role === "admin" && (
        <Link to={`/projects/new?moduleId=${mod.id}`} className="btn-secondary" style={{ marginBottom: 12, display: "inline-block" }}>
          + New Capstone Project
        </Link>
      )}
      {visibleCapstones.length === 0 && <p>None yet.</p>}
      <table className="data-table">
        <tbody>
          {visibleCapstones.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.title}</strong>
                <div className="muted">{p.description}</div>
              </td>
              <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
              <td className="actions">
                <Link to={`/projects/${p.id}/play`} className="btn-small btn-primary">Play</Link>
                {role === "admin" && <Link to={`/projects/${p.id}/edit`} className="btn-small">Edit</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
