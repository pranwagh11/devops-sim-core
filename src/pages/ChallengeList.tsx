import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { storage } from "../storage";
import { ChallengeRecord } from "../simcore/types";

export default function ChallengeList() {
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);

  const load = () => setChallenges(storage.listChallenges());
  useEffect(load, []);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this challenge? This cannot be undone.")) return;
    storage.deleteChallenge(id);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Challenges</h2>
        <Link to="/challenges/new" className="btn-primary">+ New Challenge</Link>
      </div>
      {challenges.length === 0 && <p>No challenges yet — create your first one.</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
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
              <td>
                <span className={`badge badge-${c.status}`}>{c.status}</span>
              </td>
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
