import { useCallback, useEffect, useRef, useState } from "react";
import TerminalView from "./Terminal";
import ObjectivesPanel from "./ObjectivesPanel";
import { runCommand } from "../simcore/commandEngine";
import { evaluateProject } from "../simcore/validator";
import { tryRunNetworkCommand } from "../simcore/networkCommands";
import { HostState, NetworkRule, Objective, ObjectiveResult, cloneHostState } from "../simcore/types";

interface Props {
  hosts: Record<string, HostState>;
  networkRules: NetworkRule[];
  objectives: Objective[];
  hints?: string[];
  onEvaluate?: (results: ObjectiveResult[], allPassed: boolean, finalHosts: Record<string, HostState>) => void;
  resetToken?: number;
}

export default function ProjectPlayer({ hosts, networkRules, objectives, hints = [], onEvaluate, resetToken }: Props) {
  const [hostNames, setHostNames] = useState<string[]>([]);
  const [activeHost, setActiveHost] = useState("");
  const [results, setResults] = useState<ObjectiveResult[]>([]);
  const [shownHints, setShownHints] = useState(0);
  const [terminalKey, setTerminalKey] = useState(0);
  const hostsRef = useRef<Record<string, HostState>>({});

  useEffect(() => {
    const cloned: Record<string, HostState> = {};
    Object.entries(hosts).forEach(([name, hs]) => (cloned[name] = cloneHostState(hs)));
    hostsRef.current = cloned;
    const names = Object.keys(cloned);
    setHostNames(names);
    setActiveHost(names[0] ?? "");
    setResults(evaluateProject(cloned, networkRules, objectives));
    setShownHints(0);
    setTerminalKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const recompute = () => {
    const evaluated = evaluateProject(hostsRef.current, networkRules, objectives);
    setResults(evaluated);
    const allPassed = evaluated.length > 0 && evaluated.every((r) => r.passed);
    onEvaluate?.(evaluated, allPassed, hostsRef.current);
  };

  const handleCommandForHost = useCallback(
    (hostName: string, line: string): string => {
      const net = tryRunNetworkCommand(hostName, line, hostsRef.current, networkRules);
      if (net.handled) {
        if (net.switchToHost) setActiveHost(net.switchToHost);
        recompute();
        return net.output;
      }
      const state = hostsRef.current[hostName];
      const { output, newState } = runCommand(state, line, hostName);
      hostsRef.current[hostName] = newState;
      recompute();
      return output;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terminalKey]
  );

  if (hostNames.length === 0) return <p>No hosts defined yet.</p>;

  return (
    <div>
      <div className="host-tabs">
        {hostNames.map((h) => (
          <button key={h} className={`host-tab ${h === activeHost ? "host-tab-active" : ""}`} onClick={() => setActiveHost(h)}>
            {h}
          </button>
        ))}
      </div>
      <div className="play-layout">
        <div className="terminal-column">
          {hostNames.map((h) => (
            <div key={`${h}-${terminalKey}`} style={{ display: h === activeHost ? "block" : "none" }}>
              <div className="host-label">student@{h}</div>
              <TerminalView
                prompt={`student@${h}:~$`}
                onCommand={(line) => handleCommandForHost(h, line)}
                active={h === activeHost}
              />
            </div>
          ))}
          <p className="help-text">
            Tip: use <code>ssh &lt;hostname&gt;</code> to switch hosts, and <code>curl http://&lt;host&gt;:&lt;port&gt;</code>{" "}
            to test connectivity between hosts.
          </p>
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
          <ObjectivesPanel results={results} title="Project Objectives" />
        </div>
      </div>
    </div>
  );
}
