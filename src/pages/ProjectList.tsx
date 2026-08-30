import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../storage";
import { ProjectRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function ProjectList() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  const load = () => setProjects(storage.listProjects());
  useEffect(load, []);

  if (role !== "admin") {
    return (
      <div className="page">
        <div className="error-banner">Admin access required.</div>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    storage.deleteProject(id);
    load();
  };

  const attachmentLabel = (p: ProjectRecord) => {
    if (p.lesson_id) {
      const l = storage.getLesson(p.lesson_id);
      if (!l) return "(lesson deleted)";
      const m = storage.getModule(l.module_id);
      return `${m?.title ?? "?"} → ${l.title}`;
    }
    if (p.module_id) {
      const m = storage.getModule(p.module_id);
      return `${m?.title ?? "(module deleted)"} (capstone)`;
    }
    return "Standalone";
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>All Projects</h2>
      </div>
      <p className="help-text">Every project across every module/lesson, for management convenience. New projects are created from a Module or Lesson page.</p>
      {projects.length === 0 && <p>No projects yet.</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Attached to</th>
            <th>Hosts</th>
            <th>Status</th>
            <th>Difficulty</th>
            <th>XP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.title}</strong>
                <div className="muted">{p.description}</div>
              </td>
              <td className="muted">{attachmentLabel(p)}</td>
              <td>{Object.keys(p.hosts || {}).join(", ")}</td>
              <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
              <td><span className={`badge badge-${p.difficulty}`}>{p.difficulty}</span></td>
              <td>{p.xp}</td>
              <td className="actions">
                <Link to={`/projects/${p.id}/play`} className="btn-small btn-primary">Play</Link>
                <Link to={`/projects/${p.id}/edit`} className="btn-small">Edit</Link>
                <button className="btn-small btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
