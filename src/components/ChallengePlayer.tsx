import { useCallback, useRef, useState, useEffect } from "react";
import TerminalView from "./Terminal";
import ObjectivesPanel from "./ObjectivesPanel";
import { runCommand } from "../simcore/commandEngine";
import { evaluateChallenge } from "../simcore/validator";
import { HostState, Objective, ObjectiveResult, cloneHostState } from "../simcore/types";

interface Props {
  initialState: HostState;
  objectives: Objective[];
  hints?: string[];
  hostnameLabel?: string;
  // Fired every time objectives are re-evaluated. allPassed is used by the
  // author's Test step to unlock Publish; the actual Play page ignores it.
  onEvaluate?: (results: ObjectiveResult[], allPassed: boolean, finalState: HostState) => void;
  // Bump this to force the player to reset to initialState (used when the
  // author edits the config mid-test and wants to restart).
  resetToken?: number;
}

export default function ChallengePlayer({ initialState, objectives, hints = [], hostnameLabel = "sandbox", onEvaluate, resetToken }: Props) {
  const [shownHints, setShownHints] = useState(0);
  const [results, setResults] = useState<ObjectiveResult[]>([]);
  const stateRef = useRef<HostState>(cloneHostState(initialState));
  const [terminalKey, setTerminalKey] = useState(0);

  useEffect(() => {
    stateRef.current = cloneHostState(initialState);
    const initial = evaluateChallenge(stateRef.current, objectives);
    setResults(initial);
    setShownHints(0);
    setTerminalKey((k) => k + 1); // remount terminal for a clean session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const handleCommand = useCallback(
    (line: string) => {
      const { output, newState } = runCommand(stateRef.current, line, hostnameLabel);
      stateRef.current = newState;
      const evaluated = evaluateChallenge(newState, objectives);
      setResults(evaluated);
      const allPassed = evaluated.length > 0 && evaluated.every((r) => r.passed);
      onEvaluate?.(evaluated, allPassed, newState);
      return output;
    },
    // objectives/hostnameLabel are effectively fixed for the lifetime of a
    // given resetToken, so this stays stable across the terminal's mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terminalKey]
  );

  return (
    <div className="play-layout">
      <div className="terminal-column">
        <div className="host-label">student@{hostnameLabel}</div>
        <TerminalView key={terminalKey} prompt={`student@${hostnameLabel}:~$`} onCommand={handleCommand} />
        {hints.length > 0 && (
          <div className="hints-box">
            {Array.from({ length: shownHints }).map((_, i) => (
              <p key={i} className="hint-text">💡 {hints[i]}</p>
            ))}
            {shownHints < hints.length && (
              <button className="btn-secondary" onClick={() => setShownHints(shownHints + 1)}>
                Show hint {shownHints + 1}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="objectives-column">
        <ObjectivesPanel results={results} />
      </div>
    </div>
  );
}
