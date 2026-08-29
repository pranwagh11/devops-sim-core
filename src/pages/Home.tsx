import { Link } from "react-router-dom";
import { useAuth } from "../auth";

export default function Home() {
  const { role } = useAuth();

  return (
    <div className="page">
      <h2>DevOps Learning Simulator — Prototype</h2>
      <p>
        Content is organized as Modules (one per technology) containing Lessons, each with
        Challenges and an optional capping Project. Everything is graded by checking the final
        simulated system state against the objectives you define.
      </p>
      <div className="home-cards">
        <Link to="/modules" className="home-card">
          <h3>Browse Modules</h3>
          <p>Start here — pick a module, then a lesson, then a challenge or project.</p>
        </Link>
      </div>
      {role !== "admin" && (
        <p className="help-text" style={{ marginTop: 16 }}>
          You're browsing as a Learner. Use "Set Up Admin Access" (or "Admin Login") in the top
          right to create or edit content.
        </p>
      )}
    </div>
  );
}
