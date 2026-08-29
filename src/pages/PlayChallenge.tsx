import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { storage } from "../storage";
import ChallengePlayer from "../components/ChallengePlayer";
import { ChallengeRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function PlayChallenge() {
  const { id } = useParams();
  const { role } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const c = storage.getChallenge(id!);
    if (!c) setError("Challenge not found.");
    else setChallenge(c);
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!challenge) return <p>Loading…</p>;

  if (challenge.status === "draft" && role !== "admin") {
    return (
      <div className="page">
        <div className="error-banner">This challenge hasn't been published yet.</div>
      </div>
    );
  }

  const lesson = storage.getLesson(challenge.lesson_id);

  return (
    <div className="page">
      {lesson && <Link to={`/lessons/${lesson.id}`} className="back-link">&larr; Back to {lesson.title}</Link>}
      <h2>{challenge.title}</h2>
      {challenge.status === "draft" && <span className="badge badge-draft">Draft — not yet published</span>}
      <p>{challenge.description}</p>
      <ChallengePlayer
        initialState={challenge.initial_state}
        objectives={challenge.objectives}
        hints={challenge.hints}
      />
    </div>
  );
}
