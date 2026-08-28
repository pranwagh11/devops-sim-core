import { HostState, cloneHostState, FileEntry } from "./types";

// --- path helpers -----------------------------------------------------

export function resolvePath(cwd: string, input: string): string {
  const raw = input.startsWith("/") ? input : `${cwd}/${input}`;
  const parts = raw.split("/").filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    else if (part === "..") stack.pop();
    else stack.push(part);
  }
  return "/" + stack.join("/");
}

function parentOf(path: string): string {
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function baseName(path: string): string {
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

// Tokenizer that respects "double quoted strings" and 'single quotes'.
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function permString(mode: string, isDir: boolean): string {
  const map: Record<string, string> = {
    "7": "rwx", "6": "rw-", "5": "r-x", "4": "r--",
    "3": "-wx", "2": "-w-", "1": "--x", "0": "---",
  };
  const chars = mode.split("").map((d) => map[d] ?? "---").join("");
  return (isDir ? "d" : "-") + chars;
}

function fileSize(entry: FileEntry): number {
  return entry.type === "dir" ? 4096 : (entry.content ?? "").length;
}

// A handful of recognizable descriptions so `systemctl status` reads like
// the real thing for the services people actually simulate; anything else
// gets a generic fallback rather than an empty line.
const SERVICE_DESCRIPTIONS: Record<string, string> = {
  nginx: "A high performance web server and reverse proxy server",
  apache2: "The Apache HTTP Server",
  postgres: "PostgreSQL RDBMS server",
  postgresql: "PostgreSQL RDBMS server",
  mysql: "MySQL Community Server",
  redis: "Advanced key-value store",
  docker: "Docker Application Container Engine",
  backend: "Simulated backend application service",
  sshd: "OpenSSH server daemon",
};

function serviceDescription(name: string): string {
  return SERVICE_DESCRIPTIONS[name] ?? `Simulated ${name} service`;
}

function elapsedSince(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}min ${diffSec % 60}s ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}min ago`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() + " " + d.toTimeString().slice(0, 8);
}

const HELP: Record<string, string> = {
  pwd: "pwd — print the current working directory",
  ls: "ls [-l] [-a] [-R] [path] — list directory contents. -l: long format, -a: show all, -R: recursive",
  cd: "cd <path> — change the current directory",
  mkdir: "mkdir [-p] <path> — create a directory. -p: create parent directories as needed",
  touch: "touch <path> — create an empty file if it doesn't exist",
  rm: "rm [-r] <path> — remove a file or directory. -r: recursive (required for non-empty directories)",
  cat: "cat <path> — print a file's contents",
  echo: 'echo "text" [> path | >> path] — print text, or write/append it to a file',
  chmod: "chmod <mode> <path> — change a file or directory's permission mode, e.g. chmod 755 /app",
  useradd: "useradd <name> — create a new user",
  systemctl: "systemctl <start|stop|restart|status|enable|disable> <service> — control a simulated service",
  grep: "grep <pattern> <file> — print lines in a file matching pattern",
  find: "find <path> -name <pattern> — search for files/directories by name under path",
  head: "head [-n N] <file> — print the first N lines of a file (default 10)",
  tail: "tail [-n N] <file> — print the last N lines of a file (default 10)",
  wc: "wc <file> — print line, word and character counts for a file",
  cp: "cp [-r] <src> <dst> — copy a file or directory. -r: required for directories",
  mv: "mv <src> <dst> — move/rename a file or directory",
  ln: "ln -s <target> <linkname> — create a simulated symbolic link",
  whoami: "whoami — print the current user",
  id: "id — print user identity information",
  su: "su <username> — switch the current user",
  date: "date — print the current date and time",
  which: "which <command> — show whether a command is a known builtin",
  uname: "uname [-a] — print system information",
  hostname: "hostname — print this machine's simulated hostname",
  du: "du [path] — estimate simulated disk usage under path",
  df: "df — show simulated filesystem space usage",
  ps: "ps — list simulated running processes/services",
  history: "history — show commands entered this session",
  clear: "clear — clear the terminal screen",
  man: "man <command> — show help for a command (alias: help)",
  help: "help [command] — list all commands, or show help for one command",
};

export interface CommandResult {
  output: string;
  newState: HostState;
}

// `hostname` is passed in by the caller (single value per HostState instance)
// since a HostState on its own doesn't know its own name in multi-host setups.
export function runCommand(state: HostState, line: string, hostnameLabel = "sandbox"): CommandResult {
  const trimmed = line.trim();
  if (!trimmed) return { output: "", newState: state };

  const next = cloneHostState(state);
  const tokens = tokenize(trimmed);
  const cmd = tokens[0];
  const args = tokens.slice(1);
  const flags = args.filter((a) => a.startsWith("-"));
  const positional = args.filter((a) => !a.startsWith("-"));

  try {
    switch (cmd) {
      case "pwd":
        return { output: next.cwd, newState: next };

      case "ls": {
        const long = flags.includes("-l") || flags.includes("-la") || flags.includes("-al");
        const all = flags.includes("-a") || flags.includes("-la") || flags.includes("-al");
        const recursive = flags.includes("-R");
        void all; // no hidden-file concept yet; flag accepted for compatibility
        const targetArg = positional[0];
        const target = targetArg ? resolvePath(next.cwd, targetArg) : next.cwd;
        const entry = next.fs[target];
        if (!entry || entry.type !== "dir") {
          return { output: `ls: cannot access '${targetArg ?? "."}': No such directory`, newState: next };
        }

        const listDir = (dirPath: string): string[] => {
          const prefix = dirPath === "/" ? "/" : dirPath + "/";
          return Object.keys(next.fs)
            .filter((k) => k !== dirPath && k.startsWith(prefix))
            .filter((k) => !k.slice(prefix.length).includes("/"));
        };

        const formatLong = (paths: string[]) =>
          paths
            .map((p) => {
              const e = next.fs[p];
              const perm = permString(e.mode, e.type === "dir");
              return `${perm} student student ${String(fileSize(e)).padStart(6)} ${baseName(p)}`;
            })
            .join("\n");

        if (recursive) {
          const lines: string[] = [];
          const walk = (dirPath: string) => {
            const children = listDir(dirPath).sort();
            lines.push(`${dirPath}:`);
            lines.push(long ? formatLong(children) : children.map(baseName).join("  "));
            children.filter((c) => next.fs[c].type === "dir").forEach(walk);
          };
          walk(target);
          return { output: lines.filter(Boolean).join("\n\n"), newState: next };
        }

        const children = listDir(target).sort();
        if (children.length === 0) return { output: "", newState: next };
        return { output: long ? formatLong(children) : children.map(baseName).join("  "), newState: next };
      }

      case "cd": {
        const targetArg = positional[0] ?? "/";
        const target = resolvePath(next.cwd, targetArg);
        const entry = next.fs[target];
        if (!entry || entry.type !== "dir") {
          return { output: `cd: no such directory: ${targetArg}`, newState: next };
        }
        next.cwd = target;
        return { output: "", newState: next };
      }

      case "mkdir": {
        const recursive = flags.includes("-p");
        const targetArg = positional[0];
        if (!targetArg) return { output: "mkdir: missing operand", newState: next };
        const target = resolvePath(next.cwd, targetArg);
        if (recursive) {
          const parts = target.split("/").filter(Boolean);
          let acc = "";
          for (const part of parts) {
            acc += "/" + part;
            if (!next.fs[acc]) next.fs[acc] = { type: "dir", mode: "755" };
          }
        } else {
          const parent = parentOf(target);
          if (!next.fs[parent] || next.fs[parent].type !== "dir") {
            return { output: `mkdir: cannot create directory '${targetArg}': parent does not exist (use -p)`, newState: next };
          }
          if (next.fs[target]) {
            return { output: `mkdir: cannot create directory '${targetArg}': already exists`, newState: next };
          }
          next.fs[target] = { type: "dir", mode: "755" };
        }
        return { output: "", newState: next };
      }

      case "touch": {
        const targetArg = positional[0];
        if (!targetArg) return { output: "touch: missing operand", newState: next };
        const target = resolvePath(next.cwd, targetArg);
        const parent = parentOf(target);
        if (!next.fs[parent] || next.fs[parent].type !== "dir") {
          return { output: `touch: cannot touch '${targetArg}': parent directory does not exist`, newState: next };
        }
        if (!next.fs[target]) next.fs[target] = { type: "file", content: "", mode: "644" };
        return { output: "", newState: next };
      }

      case "rm": {
        const recursive = flags.includes("-r") || flags.includes("-rf") || flags.includes("-fr");
        const targetArg = positional[0];
        if (!targetArg) return { output: "rm: missing operand", newState: next };
        const target = resolvePath(next.cwd, targetArg);
        const entry = next.fs[target];
        if (!entry) return { output: `rm: cannot remove '${targetArg}': No such file or directory`, newState: next };
        if (entry.type === "dir") {
          const prefix = target === "/" ? "/" : target + "/";
          const hasChildren = Object.keys(next.fs).some((k) => k.startsWith(prefix));
          if (hasChildren && !recursive) {
            return { output: `rm: cannot remove '${targetArg}': directory not empty (use -r)`, newState: next };
          }
          Object.keys(next.fs).filter((k) => k === target || k.startsWith(prefix)).forEach((k) => delete next.fs[k]);
        } else {
          delete next.fs[target];
        }
        return { output: "", newState: next };
      }

      case "cat": {
        const targetArg = positional[0];
        if (!targetArg) return { output: "cat: missing operand", newState: next };
        const target = resolvePath(next.cwd, targetArg);
        const entry = next.fs[target];
        if (!entry) return { output: `cat: ${targetArg}: No such file`, newState: next };
        if (entry.type !== "file") return { output: `cat: ${targetArg}: Is a directory`, newState: next };
        return { output: entry.content ?? "", newState: next };
      }

      case "echo": {
        const gtIndex = trimmed.indexOf(">");
        if (gtIndex === -1) {
          return { output: tokens.slice(1).join(" "), newState: next };
        }
        const append = trimmed[gtIndex + 1] === ">";
        const before = trimmed.slice(0, gtIndex).trim();
        const after = trimmed.slice(gtIndex + (append ? 2 : 1)).trim();
        const beforeTokens = tokenize(before);
        const text = beforeTokens.slice(1).join(" ");
        const target = resolvePath(next.cwd, after);
        const parent = parentOf(target);
        if (!next.fs[parent] || next.fs[parent].type !== "dir") {
          return { output: `echo: cannot write to '${after}': parent directory does not exist`, newState: next };
        }
        const existing = next.fs[target];
        const newContent = append && existing?.type === "file" ? (existing.content ?? "") + text : text;
        next.fs[target] = { type: "file", content: newContent, mode: existing?.mode ?? "644" };
        return { output: "", newState: next };
      }

      case "chmod": {
        const mode = positional[0];
        const targetArg = positional[1];
        if (!mode || !targetArg) return { output: "chmod: missing operand", newState: next };
        const target = resolvePath(next.cwd, targetArg);
        if (!next.fs[target]) return { output: `chmod: cannot access '${targetArg}': No such file or directory`, newState: next };
        next.fs[target] = { ...next.fs[target], mode };
        return { output: "", newState: next };
      }

      case "useradd": {
        const name = positional[0];
        if (!name) return { output: "useradd: missing operand", newState: next };
        if (!next.users.includes(name)) next.users.push(name);
        return { output: "", newState: next };
      }

      case "su": {
        const name = positional[0];
        if (!name) return { output: "su: missing operand", newState: next };
        if (!next.users.includes(name)) return { output: `su: user ${name} does not exist`, newState: next };
        next.currentUser = name;
        return { output: "", newState: next };
      }

      case "systemctl": {
        const action = positional[0];
        const service = positional[1];
        if (!action || !service) return { output: "systemctl: usage: systemctl <start|stop|status|restart|enable|disable> <service>", newState: next };
        if (!next.services[service]) next.services[service] = { running: false };
        const entry = next.services[service];

        if (action === "start" || action === "restart") {
          if (!entry.running || action === "restart") {
            entry.pid = 1000 + Math.floor(Math.random() * 8999);
            entry.startedAt = new Date().toISOString();
          }
          entry.running = true;
          return { output: "", newState: next };
        }
        if (action === "stop") {
          entry.running = false;
          return { output: "", newState: next };
        }
        if (action === "enable" || action === "disable") {
          // Accepted for realism/muscle-memory; simulator always treats
          // services as enabled, so this is a no-op beyond acknowledging it.
          return { output: `Synchronizing state of ${service}.service...\n${action === "enable" ? "Created symlink" : "Removed symlink"} for ${service}.service.`, newState: next };
        }
        if (action === "status") {
          const desc = serviceDescription(service);
          const lines: string[] = [];
          if (entry.running) {
            // Self-heal: a service can start "running" as part of the
            // authored initial state (never went through `start`), so it
            // may not have a pid/startedAt yet — assign one now rather
            // than showing an incomplete status block.
            if (!entry.pid) entry.pid = 1000 + Math.floor(Math.random() * 8999);
            if (!entry.startedAt) entry.startedAt = new Date().toISOString();
            lines.push(`● ${service}.service - ${desc}`);
            lines.push(`     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)`);
            const since = entry.startedAt ? `${formatTimestamp(entry.startedAt)}; ${elapsedSince(entry.startedAt)}` : "unknown";
            lines.push(`     Active: active (running) since ${since}`);
            if (entry.port) lines.push(`    Listen: 0.0.0.0:${entry.port} (Stream)`);
            if (entry.pid) {
              lines.push(`   Main PID: ${entry.pid} (${service})`);
              lines.push(`      Tasks: 1 (limit: 4915)`);
              lines.push(`     Memory: ${(2 + Math.random() * 8).toFixed(1)}M`);
              lines.push(`     CGroup: /system.slice/${service}.service`);
              lines.push(`             └─${entry.pid} ${service}`);
            }
          } else {
            lines.push(`○ ${service}.service - ${desc}`);
            lines.push(`     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)`);
            lines.push(`     Active: inactive (dead)`);
          }
          return { output: lines.join("\n"), newState: next };
        }
        return { output: `systemctl: unknown action '${action}'`, newState: next };
      }

      case "grep": {
        const pattern = positional[0];
        const fileArg = positional[1];
        if (!pattern || !fileArg) return { output: "grep: usage: grep <pattern> <file>", newState: next };
        const target = resolvePath(next.cwd, fileArg);
        const entry = next.fs[target];
        if (!entry || entry.type !== "file") return { output: `grep: ${fileArg}: No such file`, newState: next };
        const matches = (entry.content ?? "").split("\n").filter((l) => l.includes(pattern));
        return { output: matches.join("\n"), newState: next };
      }

      case "find": {
        const searchRoot = positional[0] ? resolvePath(next.cwd, positional[0]) : next.cwd;
        const nameIdx = args.indexOf("-name");
        const namePattern = nameIdx !== -1 ? args[nameIdx + 1] : undefined;
        const prefix = searchRoot === "/" ? "/" : searchRoot + "/";
        const candidates = Object.keys(next.fs).filter((k) => k === searchRoot || k.startsWith(prefix));
        const filtered = namePattern
          ? candidates.filter((k) => baseName(k) === namePattern || baseName(k).includes(namePattern.replace(/\*/g, "")))
          : candidates;
        return { output: filtered.sort().join("\n"), newState: next };
      }

      case "head":
      case "tail": {
        let n = 10;
        const nIdx = args.indexOf("-n");
        if (nIdx !== -1 && args[nIdx + 1]) n = Number(args[nIdx + 1]);
        const fileArg = positional[0];
        if (!fileArg) return { output: `${cmd}: missing operand`, newState: next };
        const target = resolvePath(next.cwd, fileArg);
        const entry = next.fs[target];
        if (!entry || entry.type !== "file") return { output: `${cmd}: ${fileArg}: No such file`, newState: next };
        const lines = (entry.content ?? "").split("\n");
        const slice = cmd === "head" ? lines.slice(0, n) : lines.slice(-n);
        return { output: slice.join("\n"), newState: next };
      }

      case "wc": {
        const fileArg = positional[0];
        if (!fileArg) return { output: "wc: missing operand", newState: next };
        const target = resolvePath(next.cwd, fileArg);
        const entry = next.fs[target];
        if (!entry || entry.type !== "file") return { output: `wc: ${fileArg}: No such file`, newState: next };
        const content = entry.content ?? "";
        const lines = content ? content.split("\n").length : 0;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        return { output: `${lines} ${words} ${content.length} ${fileArg}`, newState: next };
      }

      case "cp": {
        const recursive = flags.includes("-r");
        const src = positional[0];
        const dst = positional[1];
        if (!src || !dst) return { output: "cp: missing operand", newState: next };
        const srcPath = resolvePath(next.cwd, src);
        const dstPath = resolvePath(next.cwd, dst);
        const entry = next.fs[srcPath];
        if (!entry) return { output: `cp: cannot stat '${src}': No such file or directory`, newState: next };
        if (entry.type === "dir") {
          if (!recursive) return { output: `cp: -r not specified; omitting directory '${src}'`, newState: next };
          const prefix = srcPath === "/" ? "/" : srcPath + "/";
          Object.keys(next.fs)
            .filter((k) => k === srcPath || k.startsWith(prefix))
            .forEach((k) => {
              const rel = k.slice(srcPath.length);
              next.fs[dstPath + rel] = { ...next.fs[k] };
            });
        } else {
          next.fs[dstPath] = { ...entry };
        }
        return { output: "", newState: next };
      }

      case "mv": {
        const src = positional[0];
        const dst = positional[1];
        if (!src || !dst) return { output: "mv: missing operand", newState: next };
        const srcPath = resolvePath(next.cwd, src);
        const dstPath = resolvePath(next.cwd, dst);
        const entry = next.fs[srcPath];
        if (!entry) return { output: `mv: cannot stat '${src}': No such file or directory`, newState: next };
        if (entry.type === "dir") {
          const prefix = srcPath === "/" ? "/" : srcPath + "/";
          const keys = Object.keys(next.fs).filter((k) => k === srcPath || k.startsWith(prefix));
          keys.forEach((k) => {
            const rel = k.slice(srcPath.length);
            next.fs[dstPath + rel] = { ...next.fs[k] };
            delete next.fs[k];
          });
        } else {
          next.fs[dstPath] = { ...entry };
          delete next.fs[srcPath];
        }
        return { output: "", newState: next };
      }

      case "ln": {
        // Simplified: only supports `ln -s target linkname`
        if (!flags.includes("-s")) return { output: "ln: only symbolic links (-s) are supported in this simulator", newState: next };
        const target = positional[0];
        const linkname = positional[1];
        if (!target || !linkname) return { output: "ln: usage: ln -s <target> <linkname>", newState: next };
        const linkPath = resolvePath(next.cwd, linkname);
        next.fs[linkPath] = { type: "file", content: `-> ${target}`, mode: "777" };
        return { output: "", newState: next };
      }

      case "whoami":
        return { output: next.currentUser, newState: next };

      case "id":
        return { output: `uid=1000(${next.currentUser}) gid=1000(${next.currentUser}) groups=1000(${next.currentUser})`, newState: next };

      case "date":
        return { output: new Date().toString(), newState: next };

      case "which": {
        const target = positional[0];
        if (!target) return { output: "which: missing operand", newState: next };
        return { output: target in HELP ? `/usr/bin/${target}` : `which: no ${target} in simulated PATH`, newState: next };
      }

      case "uname": {
        if (flags.includes("-a")) {
          return { output: `Linux ${hostnameLabel} 5.15.0-simulated #1 SMP x86_64 GNU/Linux`, newState: next };
        }
        return { output: "Linux", newState: next };
      }

      case "hostname":
        return { output: hostnameLabel, newState: next };

      case "du": {
        const targetArg = positional[0];
        const target = targetArg ? resolvePath(next.cwd, targetArg) : next.cwd;
        const prefix = target === "/" ? "/" : target + "/";
        const total = Object.entries(next.fs)
          .filter(([k]) => k === target || k.startsWith(prefix))
          .reduce((sum, [, e]) => sum + fileSize(e), 0);
        return { output: `${Math.ceil(total / 1024)}K\t${target}`, newState: next };
      }

      case "df":
        return {
          output: "Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/sim0       10485760  524288   9961472   6% /",
          newState: next,
        };

      case "ps": {
        const lines = ["  PID TTY          TIME CMD", "    1 ?        00:00:01 init", "   42 pts/0    00:00:00 bash"];
        Object.entries(next.services)
          .filter(([, s]) => s.running)
          .forEach(([name, s]) => lines.push(`${String(s.pid ?? 999).padStart(5)}  ?        00:00:00 ${name}`));
        return { output: lines.join("\n"), newState: next };
      }

      case "man":
      case "help": {
        const target = positional[0];
        if (!target) {
          return { output: `Available commands:\n${Object.keys(HELP).sort().join("  ")}`, newState: next };
        }
        return { output: HELP[target] ?? `No manual entry for ${target}`, newState: next };
      }

      default:
        return { output: `${cmd}: command not found (try 'help' to see available commands)`, newState: next };
    }
  } catch (e) {
    return { output: `error: ${(e as Error).message}`, newState: next };
  }
}
