import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { storage } from "../storage";

export default function ModuleForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    const m = storage.getModule(id!);
    if (!m) {
      setError("Module not found.");
      setLoading(false);
      return;
    }
    setTitle(m.title);
    setDescription(m.description ?? "");
    setOrder(m.order ?? 1);
    setLoading(false);
  }, [id, isEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    try {
      storage.saveModule({ id, title, description, order });
      navigate("/modules");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="page">
      <h2>{isEdit ? "Edit Module" : "New Module"}</h2>
      <p className="help-text">A Module represents one technology track, e.g. Linux, Git, Docker, Kubernetes.</p>
      {error && <div className="error-banner">{error}</div>}
      <form className="builder-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Linux" />
        </div>
        <div className="field-group">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="field-group">
          <label>Order (lower shows first)</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">{isEdit ? "Save Changes" : "Create Module"}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/modules")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
