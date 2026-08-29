import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../storage";
import { ModuleRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function ModuleList() {
  const { role } = useAuth();
  const [modules, setModules] = useState<ModuleRecord[]>([]);

  const load = () => setModules(storage.listModules());
  useEffect(load, []);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this module? This also deletes every lesson, challenge, and project inside it. This cannot be undone.")) return;
    storage.deleteModule(id);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Modules</h2>
        {role === "admin" && <Link to="/modules/new" className="btn-primary">+ New Module</Link>}
      </div>
      <p className="help-text">
        A course is made up of Modules (one per technology). Each Module contains Lessons, and each
        Lesson contains Challenges plus an optional capping Project.
      </p>
      {modules.length === 0 && <p>No modules yet.</p>}
      <div className="module-grid">
        {modules.map((m) => {
          const lessonCount = storage.listLessonsByModule(m.id).length;
          return (
            <div className="module-card" key={m.id}>
              <Link to={`/modules/${m.id}`} className="module-card-title">{m.title}</Link>
              <p className="muted">{m.description}</p>
              <p className="muted">{lessonCount} lesson{lessonCount === 1 ? "" : "s"}</p>
              {role === "admin" && (
                <div className="actions">
                  <Link to={`/modules/${m.id}/edit`} className="btn-small">Edit</Link>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(m.id)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
