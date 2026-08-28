import { ObjectiveResult } from "../simcore/types";

interface Props {
  results: ObjectiveResult[];
  title?: string;
}

export default function ObjectivesPanel({ results, title }: Props) {
  const passedCount = results.filter((r) => r.passed).length;
  const allPassed = results.length > 0 && passedCount === results.length;

  return (
    <div className="panel objectives-panel">
      <h3>{title ?? "Objectives"} ({passedCount}/{results.length})</h3>
      <ul className="objective-list">
        {results.map((r, i) => (
          <li key={i} className={r.passed ? "objective-pass" : "objective-pending"}>
            <span className="objective-icon">{r.passed ? "✅" : "⬜"}</span>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
      {allPassed && (
        <div className="success-banner">🎉 All objectives complete!</div>
      )}
    </div>
  );
}
