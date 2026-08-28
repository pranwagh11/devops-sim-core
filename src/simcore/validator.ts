import { HostState, NetworkRule, Objective, ObjectiveResult } from "./types";

function describe(obj: Objective): string {
  switch (obj.type) {
    case "file_exists":
      return `File/directory exists: ${obj.path}${obj.host ? ` (on ${obj.host})` : ""}`;
    case "permission":
      return `Permission on ${obj.path} is ${obj.mode}${obj.host ? ` (on ${obj.host})` : ""}`;
    case "service_running":
      return `Service '${obj.service}' is running${obj.host ? ` (on ${obj.host})` : ""}`;
    case "file_contains":
      return `${obj.path} contains "${obj.text}"${obj.host ? ` (on ${obj.host})` : ""}`;
    case "network_reachable":
      return `${obj.from} can reach ${obj.to} on port ${obj.port}`;
    default:
      return "Unknown objective";
  }
}

// Evaluate objectives for a single-host challenge.
export function evaluateChallenge(state: HostState, objectives: Objective[]): ObjectiveResult[] {
  return objectives.map((obj) => {
    let passed = false;
    switch (obj.type) {
      case "file_exists":
        passed = !!state.fs[obj.path];
        break;
      case "permission":
        passed = state.fs[obj.path]?.mode === obj.mode;
        break;
      case "service_running":
        passed = !!state.services[obj.service]?.running;
        break;
      case "file_contains":
        passed = (state.fs[obj.path]?.content ?? "").includes(obj.text);
        break;
      case "network_reachable":
        passed = false; // not meaningful for a single-host challenge
        break;
    }
    return { objective: obj, passed, label: describe(obj) };
  });
}

// Evaluate objectives for a multi-host project.
export function evaluateProject(
  hosts: Record<string, HostState>,
  networkRules: NetworkRule[],
  objectives: Objective[]
): ObjectiveResult[] {
  return objectives.map((obj) => {
    let passed = false;
    const hostState = "host" in obj && obj.host ? hosts[obj.host] : undefined;

    switch (obj.type) {
      case "file_exists":
        passed = !!hostState?.fs[obj.path];
        break;
      case "permission":
        passed = hostState?.fs[obj.path]?.mode === obj.mode;
        break;
      case "service_running":
        passed = !!hostState?.services[obj.service]?.running;
        break;
      case "file_contains":
        passed = (hostState?.fs[obj.path]?.content ?? "").includes(obj.text);
        break;
      case "network_reachable": {
        const rule = networkRules.find(
          (r) => r.from === obj.from && r.to === obj.to && r.port === obj.port
        );
        passed = !!rule?.allowed;
        break;
      }
    }
    return { objective: obj, passed, label: describe(obj) };
  });
}
