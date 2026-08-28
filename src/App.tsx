import { useRef, useState } from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import ChallengeList from "./pages/ChallengeList";
import ChallengeForm from "./pages/ChallengeForm";
import PlayChallenge from "./pages/PlayChallenge";
import ProjectList from "./pages/ProjectList";
import ProjectForm from "./pages/ProjectForm";
import PlayProject from "./pages/PlayProject";
import { storage, downloadJson } from "./storage";

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const handleExport = () => {
    const json = storage.exportAll();
    downloadJson(`devops-sim-data-${new Date().toISOString().slice(0, 10)}.json`, json);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      storage.importAll(text, "merge");
      setMessage("Import complete — challenges and projects merged into your local data.");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setMessage("Import failed — the file doesn't look like a valid export.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <HashRouter>
      <div className="app-shell">
        <nav className="nav-bar">
          <Link to="/" className="nav-brand">DevOps Sim Prototype</Link>
          <Link to="/challenges">Challenges</Link>
          <Link to="/projects">Projects</Link>
          <span className="nav-spacer" />
          <button className="nav-action" onClick={handleExport}>Export JSON</button>
          <button className="nav-action" onClick={handleImportClick}>Import JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleFileSelected} />
        </nav>
        {message && <div className="import-message">{message}</div>}
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/challenges" element={<ChallengeList />} />
            <Route path="/challenges/new" element={<ChallengeForm />} />
            <Route path="/challenges/:id/edit" element={<ChallengeForm />} />
            <Route path="/challenges/:id/play" element={<PlayChallenge />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            <Route path="/projects/:id/play" element={<PlayProject />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
