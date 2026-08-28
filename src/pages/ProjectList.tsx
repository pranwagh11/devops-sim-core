import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../storage";
import { ProjectRecord } from "../simcore/types";

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  const load = () => setProjects(storage.listProjects());
  useEffect(load, []);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    storage.deleteProject(id);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Projects</h2>
        <Link to="/projects/new" className="btn-primary">+ New Project</Link>
      </div>
      {projects.length === 0 && <p>No projects yet — create your first one.</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
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
