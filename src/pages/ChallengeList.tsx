import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../storage";
import { ChallengeRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function ChallengeList() {
  const { role } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);

  const load = () => setChallenges(storage.listChallenges());
  useEffect(load, []);

  if (role !== "admin") {
    return (
      <div className="page">
        <div className="error-banner">Admin access required.</div>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (!confirm("Delete this challenge? This cannot be undone.")) return;
    storage.deleteChallenge(id);
    load();
  };

  const lessonLabel = (lessonId: string) => {
    const l = storage.getLesson(lessonId);
    if (!l) return "(lesson deleted)";
    const m = storage.getModule(l.module_id);
    return `${m?.title ?? "?"} → ${l.title}`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>All Challenges</h2>
      </div>
      <p className="help-text">Every challenge across every module/lesson, for management convenience. New challenges are created from a Lesson page.</p>
      {challenges.length === 0 && <p>No challenges yet.</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Lesson</th>
            <th>Status</th>
            <th>Difficulty</th>
            <th>XP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.title}</strong>
                <div className="muted">{c.description}</div>
              </td>
              <td className="muted">{lessonLabel(c.lesson_id)}</td>
              <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
              <td><span className={`badge badge-${c.difficulty}`}>{c.difficulty}</span></td>
              <td>{c.xp}</td>
              <td className="actions">
                <Link to={`/challenges/${c.id}/play`} className="btn-small btn-primary">Play</Link>
                <Link to={`/challenges/${c.id}/edit`} className="btn-small">Edit</Link>
                <button className="btn-small btn-danger" onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
