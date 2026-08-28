import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { storage } from "../storage";
import ProjectPlayer from "../components/ProjectPlayer";
import { ProjectRecord } from "../simcore/types";

export default function PlayProject() {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = storage.getProject(id!);
    if (!p) setError("Project not found.");
    else setProject(p);
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <p>Loading…</p>;

  return (
    <div className="page">
      <Link to="/projects" className="back-link">&larr; Back to Projects</Link>
      <h2>{project.title}</h2>
      {project.status === "draft" && <span className="badge badge-draft">Draft — not yet published</span>}
      <p>{project.description}</p>
      <ProjectPlayer
        hosts={project.hosts}
        networkRules={project.network_rules}
        objectives={project.objectives}
        hints={project.hints}
      />
    </div>
  );
}
