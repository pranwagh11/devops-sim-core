import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="page">
      <h2>DevOps Learning Simulator — Prototype</h2>
      <p>
        This is a scoped-down prototype covering only the Linux technology: create and
        run Challenges (single host) and Projects (multiple simulated hosts), all
        graded by checking the final simulated system state against objectives you define.
      </p>
      <div className="home-cards">
        <Link to="/challenges" className="home-card">
          <h3>Challenges</h3>
          <p>Single-host tasks, usually one command or concept per challenge.</p>
        </Link>
        <Link to="/projects" className="home-card">
          <h3>Projects</h3>
          <p>Larger, optionally multi-host scenarios with several objectives.</p>
        </Link>
      </div>
    </div>
  );
}
