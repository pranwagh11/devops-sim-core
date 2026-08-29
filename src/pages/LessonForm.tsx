import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { storage } from "../storage";
import { ModuleRecord } from "../simcore/types";

export default function LessonForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [moduleId, setModuleId] = useState(searchParams.get("moduleId") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    setModules(storage.listModules());
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const l = storage.getLesson(id!);
    if (!l) {
      setError("Lesson not found.");
      setLoading(false);
      return;
    }
    setModuleId(l.module_id);
    setTitle(l.title);
    setDescription(l.description ?? "");
    setOrder(l.order ?? 1);
    setLoading(false);
  }, [id, isEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) return setError("Select a module for this lesson.");
    if (!title.trim()) return setError("Title is required.");
    try {
      const saved = storage.saveLesson({ id, module_id: moduleId, title, description, order });
      navigate(`/modules/${saved.module_id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="page">
      <h2>{isEdit ? "Edit Lesson" : "New Lesson"}</h2>
      <p className="help-text">A Lesson groups the commands/concepts being taught, e.g. "Filesystem" or "Process Management".</p>
      {error && <div className="error-banner">{error}</div>}
      <form className="builder-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label>Module</label>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">Select module…</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Filesystem" />
        </div>
        <div className="field-group">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="field-group">
          <label>Order (lower shows first within the module)</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">{isEdit ? "Save Changes" : "Create Lesson"}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate(moduleId ? `/modules/${moduleId}` : "/modules")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
