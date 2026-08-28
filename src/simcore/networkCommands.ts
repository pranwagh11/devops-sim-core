import { HostState, NetworkRule } from "./types";

export interface NetworkCommandResult {
  handled: boolean;
  output: string;
  switchToHost?: string;
}

// Intercepts cross-host commands (ssh, curl) before they reach the normal
// single-host command engine. These never touch anything real — they just
// look up the network_rules table and the target host's simulated state.
export function tryRunNetworkCommand(
  currentHost: string,
  line: string,
  hosts: Record<string, HostState>,
  rules: NetworkRule[]
): NetworkCommandResult {
  const trimmed = line.trim();
  const [cmd, ...args] = trimmed.split(/\s+/);

  if (cmd === "ssh") {
    // ssh is treated as administrative navigation between hosts you're
    // simulating, not application traffic — it always succeeds if the host
    // exists. network_rules govern service-to-service reachability (tested
    // via curl below), not the learner's ability to switch terminals.
    const target = args[0];
    if (!target) return { handled: true, output: "ssh: missing host" };
    if (!hosts[target]) return { handled: true, output: `ssh: could not resolve hostname ${target}` };
    return { handled: true, output: `Connected to ${target}.`, switchToHost: target };
  }

  if (cmd === "curl") {
    const url = args.find((a) => !a.startsWith("-")) ?? "";
    const match = url.match(/^https?:\/\/([a-zA-Z0-9_.-]+)(?::(\d+))?/) ?? url.match(/^([a-zA-Z0-9_.-]+):(\d+)/);
    if (!match) return { handled: true, output: "curl: could not parse URL/host" };
    const targetHost = match[1];
    const port = Number(match[2] ?? 80);

    if (!hosts[targetHost]) {
      return { handled: true, output: `curl: (6) Could not resolve host: ${targetHost}` };
    }
    const rule = rules.find((r) => r.from === currentHost && r.to === targetHost && r.port === port);
    if (!rule || !rule.allowed) {
      return { handled: true, output: `curl: (7) Failed to connect to ${targetHost} port ${port}: Connection refused (blocked by network rules)` };
    }
    const service = Object.entries(hosts[targetHost].services).find(([, s]) => s.port === port);
    if (!service || !service[1].running) {
      return { handled: true, output: `curl: (7) Failed to connect to ${targetHost} port ${port}: Connection refused (no service listening)` };
    }
    return { handled: true, output: `HTTP/1.1 200 OK\nService '${service[0]}' on ${targetHost}:${port} responded successfully.` };
  }

  return { handled: false, output: "" };
}
