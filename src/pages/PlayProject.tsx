import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { storage } from "../storage";
import ProjectPlayer from "../components/ProjectPlayer";
import { ProjectRecord } from "../simcore/types";
import { useAuth } from "../auth";

export default function PlayProject() {
  const { id } = useParams();
  const { role } = useAuth();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = storage.getProject(id!);
    if (!p) setError("Project not found.");
    else setProject(p);
  }, [id]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <p>Loading…</p>;

  if (project.status === "draft" && role !== "admin") {
    return (
      <div className="page">
        <div className="error-banner">This project hasn't been published yet.</div>
      </div>
    );
  }

  const lesson = project.lesson_id ? storage.getLesson(project.lesson_id) : null;
  const mod = project.module_id ? storage.getModule(project.module_id) : lesson ? storage.getModule(lesson.module_id) : null;

  return (
    <div className="page">
      {lesson ? (
        <Link to={`/lessons/${lesson.id}`} className="back-link">&larr; Back to {lesson.title}</Link>
      ) : mod ? (
        <Link to={`/modules/${mod.id}`} className="back-link">&larr; Back to {mod.title}</Link>
      ) : (
        <Link to="/projects" className="back-link">&larr; Back to Projects</Link>
      )}
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
