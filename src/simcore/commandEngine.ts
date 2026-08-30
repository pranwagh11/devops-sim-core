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

// --- tokenizing ---------------------------------------------------------
// Tracks whether each token was quoted, since quoted tokens are exempt
// from wildcard expansion (same as real shells: echo "*.txt" prints
// literally, echo *.txt expands).

interface Token {
  text: string;
  quoted: boolean;
}

function rawTokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) tokens.push({ text: match[1], quoted: true });
    else if (match[2] !== undefined) tokens.push({ text: match[2], quoted: true });
    else tokens.push({ text: match[3], quoted: false });
  }
  return tokens;
}

function tokenizeText(line: string): string[] {
  return rawTokenize(line).map((t) => t.text);
}

// --- wildcard expansion ---------------------------------------------------

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

// Expands a single `*`-containing token against the current filesystem.
// Supports patterns in the current directory or an explicit path prefix
// (e.g. "*.txt" or "/var/log/*.log"). Falls back to the literal token if
// nothing matches, matching bash's default (non-nullglob) behavior.
function expandGlob(token: string, state: HostState): string[] {
  if (!token.includes("*")) return [token];
  const isAbsolute = token.startsWith("/");
  const resolved = isAbsolute ? token : `${state.cwd}/${token}`;
  const lastSlash = resolved.lastIndexOf("/");
  const dir = lastSlash <= 0 ? "/" : resolved.slice(0, lastSlash);
  const pattern = resolved.slice(lastSlash + 1);
  const regex = globToRegex(pattern);
  const prefix = dir === "/" ? "/" : dir + "/";
  const matches = Object.keys(state.fs)
    .filter((k) => k !== dir && k.startsWith(prefix))
    .filter((k) => !k.slice(prefix.length).includes("/"))
    .filter((k) => regex.test(baseName(k)))
    .sort();
  if (matches.length === 0) return [token];
  return matches.map((m) => (isAbsolute ? m : baseName(m)));
}

// --- display helpers -----------------------------------------------------

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
  cat: "cat [file] [> path | >> path] — print a file's contents, or write piped/heredoc input to a file",
  echo: 'echo "text" [> path | >> path] — print text, or write/append it to a file',
  chmod: "chmod <mode> <path> — change a file or directory's permission mode, e.g. chmod 755 /app",
  useradd: "useradd <name> — create a new user",
  systemctl: "systemctl <start|stop|restart|status|enable|disable> <service> — control a simulated service",
  grep: "grep <pattern> [file] — print matching lines from a file, or from piped input if no file is given",
  find: "find <path> -name <pattern> — search for files/directories by name under path",
  head: "head [-n N] [file] — print the first N lines (default 10) of a file or piped input",
  tail: "tail [-n N] [file] — print the last N lines (default 10) of a file or piped input",
  wc: "wc [file] — print line, word and character counts for a file or piped input",
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
  pipes:
    "Shell features supported: `cmd1 | cmd2` pipes output between commands (grep/head/tail/wc/cat can " +
    "read piped input); `cmd1 && cmd2` runs the second only if the first succeeds; `cmd1 ; cmd2` runs " +
    "both regardless; `*` expands to matching filenames (e.g. rm *.txt); `cmd << EOF ... EOF` reads " +
    "multi-line input until a line matching EOF.",
};

export interface CommandResult {
  output: string;
  newState: HostState;
  ok: boolean;
}

// Runs a single command (no |, &&, ; — those are split out before this is
// called). `stdin` is the output of the previous stage in a pipeline, or
// the body of a heredoc; null means "no piped/heredoc input available".
function runSingleCommand(state: HostState, line: string, hostnameLabel: string, stdin: string | null): CommandResult {
  const trimmed = line.trim();
  if (!trimmed) return { output: "", newState: state, ok: true };

  const next = cloneHostState(state);
  const rawTokens = rawTokenize(trimmed);
  const cmd = rawTokens[0]?.text;
  const argTokens = rawTokens.slice(1);

  const args: string[] = [];
  for (const t of argTokens) {
    if (!t.quoted && t.text.includes("*")) args.push(...expandGlob(t.text, next));
    else args.push(t.text);
  }
  const flags = args.filter((a) => a.startsWith("-"));
  const positional = args.filter((a) => !a.startsWith("-"));

  try {
    switch (cmd) {
      case "pwd":
        return { output: next.cwd, newState: next, ok: true };

      case "ls": {
        const long = flags.includes("-l") || flags.includes("-la") || flags.includes("-al");
        const all = flags.includes("-a") || flags.includes("-la") || flags.includes("-al");
        const recursive = flags.includes("-R");
        void all;
        const targetArg = positional[0];
        const target = targetArg ? resolvePath(next.cwd, targetArg) : next.cwd;
        const entry = next.fs[target];
        if (!entry || entry.type !== "dir") {
          return { output: `ls: cannot access '${targetArg ?? "."}': No such directory`, newState: next, ok: false };
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
          return { output: lines.filter(Boolean).join("\n\n"), newState: next, ok: true };
        }

        const children = listDir(target).sort();
        if (children.length === 0) return { output: "", newState: next, ok: true };
        return { output: long ? formatLong(children) : children.map(baseName).join("  "), newState: next, ok: true };
      }

      case "cd": {
        const targetArg = positional[0] ?? "/";
        const target = resolvePath(next.cwd, targetArg);
        const entry = next.fs[target];
        if (!entry || entry.type !== "dir") {
          return { output: `cd: no such directory: ${targetArg}`, newState: next, ok: false };
        }
        next.cwd = target;
        return { output: "", newState: next, ok: true };
      }

      case "mkdir": {
        const recursive = flags.includes("-p");
        const targetArg = positional[0];
        if (!targetArg) return { output: "mkdir: missing operand", newState: next, ok: false };
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
            return { output: `mkdir: cannot create directory '${targetArg}': parent does not exist (use -p)`, newState: next, ok: false };
          }
          if (next.fs[target]) {
            return { output: `mkdir: cannot create directory '${targetArg}': already exists`, newState: next, ok: false };
          }
          next.fs[target] = { type: "dir", mode: "755" };
        }
        return { output: "", newState: next, ok: true };
      }

      case "touch": {
        const targetArg = positional[0];
        if (!targetArg) return { output: "touch: missing operand", newState: next, ok: false };
        const target = resolvePath(next.cwd, targetArg);
        const parent = parentOf(target);
        if (!next.fs[parent] || next.fs[parent].type !== "dir") {
          return { output: `touch: cannot touch '${targetArg}': parent directory does not exist`, newState: next, ok: false };
        }
        if (!next.fs[target]) next.fs[target] = { type: "file", content: "", mode: "644" };
        return { output: "", newState: next, ok: true };
      }

      case "rm": {
        const recursive = flags.includes("-r") || flags.includes("-rf") || flags.includes("-fr");
        if (positional.length === 0) return { output: "rm: missing operand", newState: next, ok: false };
        const errors: string[] = [];
        for (const targetArg of positional) {
          const target = resolvePath(next.cwd, targetArg);
          const entry = next.fs[target];
          if (!entry) {
            errors.push(`rm: cannot remove '${targetArg}': No such file or directory`);
            continue;
          }
          if (entry.type === "dir") {
            const prefix = target === "/" ? "/" : target + "/";
            const hasChildren = Object.keys(next.fs).some((k) => k.startsWith(prefix));
            if (hasChildren && !recursive) {
              errors.push(`rm: cannot remove '${targetArg}': directory not empty (use -r)`);
              continue;
            }
            Object.keys(next.fs).filter((k) => k === target || k.startsWith(prefix)).forEach((k) => delete next.fs[k]);
          } else {
            delete next.fs[target];
          }
        }
        return { output: errors.join("\n"), newState: next, ok: errors.length === 0 };
      }

      case "cat": {
        const gtIndex = trimmed.indexOf(">");
        if (gtIndex !== -1) {
          const append = trimmed[gtIndex + 1] === ">";
          const before = trimmed.slice(0, gtIndex).trim();
          const after = trimmed.slice(gtIndex + (append ? 2 : 1)).trim();
          const beforeTokens = tokenizeText(before);
          const sourceFileArg = beforeTokens[1];
          let content: string;
          if (stdin !== null) {
            content = stdin;
          } else if (sourceFileArg) {
            const srcPath = resolvePath(next.cwd, sourceFileArg);
            const srcEntry = next.fs[srcPath];
            if (!srcEntry || srcEntry.type !== "file") {
              return { output: `cat: ${sourceFileArg}: No such file`, newState: next, ok: false };
            }
            content = srcEntry.content ?? "";
          } else {
            return { output: "cat: missing input (no file given and no piped/heredoc input)", newState: next, ok: false };
          }
          const target = resolvePath(next.cwd, after);
          const parent = parentOf(target);
          if (!next.fs[parent] || next.fs[parent].type !== "dir") {
            return { output: `cat: cannot write to '${after}': parent directory does not exist`, newState: next, ok: false };
          }
          const existing = next.fs[target];
          const newContent = append && existing?.type === "file" ? (existing.content ?? "") + content : content;
          next.fs[target] = { type: "file", content: newContent, mode: existing?.mode ?? "644" };
          return { output: "", newState: next, ok: true };
        }

        if (stdin !== null && positional.length === 0) {
          return { output: stdin, newState: next, ok: true };
        }
        const targetArg = positional[0];
        if (!targetArg) return { output: "cat: missing operand", newState: next, ok: false };
        const target = resolvePath(next.cwd, targetArg);
        const entry = next.fs[target];
        if (!entry) return { output: `cat: ${targetArg}: No such file`, newState: next, ok: false };
        if (entry.type !== "file") return { output: `cat: ${targetArg}: Is a directory`, newState: next, ok: false };
        return { output: entry.content ?? "", newState: next, ok: true };
      }

      case "echo": {
        const gtIndex = trimmed.indexOf(">");
        if (gtIndex === -1) {
          return { output: args.join(" "), newState: next, ok: true };
        }
        const append = trimmed[gtIndex + 1] === ">";
        const before = trimmed.slice(0, gtIndex).trim();
        const after = trimmed.slice(gtIndex + (append ? 2 : 1)).trim();
        const beforeTokens = tokenizeText(before);
        const text = beforeTokens.slice(1).join(" ");
        const target = resolvePath(next.cwd, after);
        const parent = parentOf(target);
        if (!next.fs[parent] || next.fs[parent].type !== "dir") {
          return { output: `echo: cannot write to '${after}': parent directory does not exist`, newState: next, ok: false };
        }
        const existing = next.fs[target];
        const newContent = append && existing?.type === "file" ? (existing.content ?? "") + text : text;
        next.fs[target] = { type: "file", content: newContent, mode: existing?.mode ?? "644" };
        return { output: "", newState: next, ok: true };
      }

      case "chmod": {
        const mode = positional[0];
        const targetArg = positional[1];
        if (!mode || !targetArg) return { output: "chmod: missing operand", newState: next, ok: false };
        const target = resolvePath(next.cwd, targetArg);
        if (!next.fs[target]) return { output: `chmod: cannot access '${targetArg}': No such file or directory`, newState: next, ok: false };
        next.fs[target] = { ...next.fs[target], mode };
        return { output: "", newState: next, ok: true };
      }

      case "useradd": {
        const name = positional[0];
        if (!name) return { output: "useradd: missing operand", newState: next, ok: false };
        if (!next.users.includes(name)) next.users.push(name);
        return { output: "", newState: next, ok: true };
      }

      case "su": {
        const name = positional[0];
        if (!name) return { output: "su: missing operand", newState: next, ok: false };
        if (!next.users.includes(name)) return { output: `su: user ${name} does not exist`, newState: next, ok: false };
        next.currentUser = name;
        return { output: "", newState: next, ok: true };
      }

      case "systemctl": {
        const action = positional[0];
        const service = positional[1];
        if (!action || !service) {
          return { output: "systemctl: usage: systemctl <start|stop|status|restart|enable|disable> <service>", newState: next, ok: false };
        }
        if (!next.services[service]) next.services[service] = { running: false };
        const entry = next.services[service];

        if (action === "start" || action === "restart") {
          if (!entry.running || action === "restart") {
            entry.pid = 1000 + Math.floor(Math.random() * 8999);
            entry.startedAt = new Date().toISOString();
          }
          entry.running = true;
          return { output: "", newState: next, ok: true };
        }
        if (action === "stop") {
          entry.running = false;
          return { output: "", newState: next, ok: true };
        }
        if (action === "enable" || action === "disable") {
          return {
            output: `Synchronizing state of ${service}.service...\n${action === "enable" ? "Created symlink" : "Removed symlink"} for ${service}.service.`,
            newState: next,
            ok: true,
          };
        }
        if (action === "status") {
          const desc = serviceDescription(service);
          const lines: string[] = [];
          if (entry.running) {
            if (!entry.pid) entry.pid = 1000 + Math.floor(Math.random() * 8999);
            if (!entry.startedAt) entry.startedAt = new Date().toISOString();
            lines.push(`● ${service}.service - ${desc}`);
            lines.push(`     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)`);
            const since = `${formatTimestamp(entry.startedAt)}; ${elapsedSince(entry.startedAt)}`;
            lines.push(`     Active: active (running) since ${since}`);
            if (entry.port) lines.push(`    Listen: 0.0.0.0:${entry.port} (Stream)`);
            lines.push(`   Main PID: ${entry.pid} (${service})`);
            lines.push(`      Tasks: 1 (limit: 4915)`);
            lines.push(`     Memory: ${(2 + Math.random() * 8).toFixed(1)}M`);
            lines.push(`     CGroup: /system.slice/${service}.service`);
            lines.push(`             └─${entry.pid} ${service}`);
          } else {
            lines.push(`○ ${service}.service - ${desc}`);
            lines.push(`     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)`);
            lines.push(`     Active: inactive (dead)`);
          }
          // `systemctl status` on a stopped service is a normal, successful
          // check (exit 3 in real systemd, but here we treat "checked
          // successfully and it's stopped" as ok so `&&` chains after a
          // status check still proceed).
          return { output: lines.join("\n"), newState: next, ok: true };
        }
        return { output: `systemctl: unknown action '${action}'`, newState: next, ok: false };
      }

      case "grep": {
        let pattern: string;
        let content: string | null;
        if (positional.length >= 2) {
          pattern = positional[0];
          const target = resolvePath(next.cwd, positional[1]);
          const entry = next.fs[target];
          if (!entry || entry.type !== "file") return { output: `grep: ${positional[1]}: No such file`, newState: next, ok: false };
          content = entry.content ?? "";
        } else if (positional.length === 1 && stdin !== null) {
          pattern = positional[0];
          content = stdin;
        } else if (positional.length === 1) {
          return { output: "grep: no file given and no piped input available", newState: next, ok: false };
        } else {
          return { output: "grep: usage: grep <pattern> [file]", newState: next, ok: false };
        }
        const matches = content.split("\n").filter((l) => l.includes(pattern));
        return { output: matches.join("\n"), newState: next, ok: matches.length > 0 };
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
        return { output: filtered.sort().join("\n"), newState: next, ok: true };
      }

      case "head":
      case "tail": {
        let n = 10;
        const filteredPositional: string[] = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "-n") {
            n = Number(args[i + 1]);
            i++;
            continue;
          }
          if (!args[i].startsWith("-")) filteredPositional.push(args[i]);
        }
        const fileArg = filteredPositional[0];
        let content: string;
        if (fileArg) {
          const target = resolvePath(next.cwd, fileArg);
          const entry = next.fs[target];
          if (!entry || entry.type !== "file") return { output: `${cmd}: ${fileArg}: No such file`, newState: next, ok: false };
          content = entry.content ?? "";
        } else if (stdin !== null) {
          content = stdin;
        } else {
          return { output: `${cmd}: no file given and no piped input available`, newState: next, ok: false };
        }
        const lines = content.split("\n");
        const slice = cmd === "head" ? lines.slice(0, n) : lines.slice(-n);
        return { output: slice.join("\n"), newState: next, ok: true };
      }

      case "wc": {
        const fileArg = positional[0];
        let content: string;
        let label = "";
        if (fileArg) {
          const target = resolvePath(next.cwd, fileArg);
          const entry = next.fs[target];
          if (!entry || entry.type !== "file") return { output: `wc: ${fileArg}: No such file`, newState: next, ok: false };
          content = entry.content ?? "";
          label = ` ${fileArg}`;
        } else if (stdin !== null) {
          content = stdin;
        } else {
          return { output: "wc: no file given and no piped input available", newState: next, ok: false };
        }
        const lines = content ? content.split("\n").length : 0;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        return { output: `${lines} ${words} ${content.length}${label}`, newState: next, ok: true };
      }

      case "cp": {
        const recursive = flags.includes("-r");
        const src = positional[0];
        const dst = positional[1];
        if (!src || !dst) return { output: "cp: missing operand", newState: next, ok: false };
        const srcPath = resolvePath(next.cwd, src);
        const dstPath = resolvePath(next.cwd, dst);
        const entry = next.fs[srcPath];
        if (!entry) return { output: `cp: cannot stat '${src}': No such file or directory`, newState: next, ok: false };
        if (entry.type === "dir") {
          if (!recursive) return { output: `cp: -r not specified; omitting directory '${src}'`, newState: next, ok: false };
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
        return { output: "", newState: next, ok: true };
      }

      case "mv": {
        const src = positional[0];
        const dst = positional[1];
        if (!src || !dst) return { output: "mv: missing operand", newState: next, ok: false };
        const srcPath = resolvePath(next.cwd, src);
        const dstPath = resolvePath(next.cwd, dst);
        const entry = next.fs[srcPath];
        if (!entry) return { output: `mv: cannot stat '${src}': No such file or directory`, newState: next, ok: false };
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
        return { output: "", newState: next, ok: true };
      }

      case "ln": {
        if (!flags.includes("-s")) return { output: "ln: only symbolic links (-s) are supported in this simulator", newState: next, ok: false };
        const target = positional[0];
        const linkname = positional[1];
        if (!target || !linkname) return { output: "ln: usage: ln -s <target> <linkname>", newState: next, ok: false };
        const linkPath = resolvePath(next.cwd, linkname);
        next.fs[linkPath] = { type: "file", content: `-> ${target}`, mode: "777" };
        return { output: "", newState: next, ok: true };
      }

      case "whoami":
        return { output: next.currentUser, newState: next, ok: true };

      case "id":
        return { output: `uid=1000(${next.currentUser}) gid=1000(${next.currentUser}) groups=1000(${next.currentUser})`, newState: next, ok: true };

      case "date":
        return { output: new Date().toString(), newState: next, ok: true };

      case "which": {
        const target = positional[0];
        if (!target) return { output: "which: missing operand", newState: next, ok: false };
        const known = target in HELP;
        return { output: known ? `/usr/bin/${target}` : `which: no ${target} in simulated PATH`, newState: next, ok: known };
      }

      case "uname": {
        if (flags.includes("-a")) {
          return { output: `Linux ${hostnameLabel} 5.15.0-simulated #1 SMP x86_64 GNU/Linux`, newState: next, ok: true };
        }
        return { output: "Linux", newState: next, ok: true };
      }

      case "hostname":
        return { output: hostnameLabel, newState: next, ok: true };

      case "du": {
        const targetArg = positional[0];
        const target = targetArg ? resolvePath(next.cwd, targetArg) : next.cwd;
        const prefix = target === "/" ? "/" : target + "/";
        const total = Object.entries(next.fs)
          .filter(([k]) => k === target || k.startsWith(prefix))
          .reduce((sum, [, e]) => sum + fileSize(e), 0);
        return { output: `${Math.ceil(total / 1024)}K\t${target}`, newState: next, ok: true };
      }

      case "df":
        return {
          output: "Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/sim0       10485760  524288   9961472   6% /",
          newState: next,
          ok: true,
        };

      case "ps": {
        const lines = ["  PID TTY          TIME CMD", "    1 ?        00:00:01 init", "   42 pts/0    00:00:00 bash"];
        Object.entries(next.services)
          .filter(([, s]) => s.running)
          .forEach(([name, s]) => lines.push(`${String(s.pid ?? 999).padStart(5)}  ?        00:00:00 ${name}`));
        return { output: lines.join("\n"), newState: next, ok: true };
      }

      case "man":
      case "help": {
        const target = positional[0];
        if (!target) {
          return { output: `Available commands:\n${Object.keys(HELP).sort().join("  ")}`, newState: next, ok: true };
        }
        return { output: HELP[target] ?? `No manual entry for ${target}`, newState: next, ok: !!HELP[target] };
      }

      default:
        return { output: `${cmd}: command not found (try 'help' to see available commands)`, newState: next, ok: false };
    }
  } catch (e) {
    return { output: `error: ${(e as Error).message}`, newState: next, ok: false };
  }
}

// --- pipeline (|) ---------------------------------------------------------

function splitPipeline(segment: string): string[] {
  const stages: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  for (const ch of segment) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "|" && !inSingle && !inDouble) {
      stages.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) stages.push(current.trim());
  return stages;
}

function runPipeline(state: HostState, stages: string[], hostnameLabel: string): CommandResult {
  let currentState = state;
  let stdin: string | null = null;
  let lastOutput = "";
  let ok = true;
  for (const stage of stages) {
    const result = runSingleCommand(currentState, stage, hostnameLabel, stdin);
    currentState = result.newState;
    lastOutput = result.output;
    stdin = result.output;
    ok = result.ok;
  }
  return { output: lastOutput, newState: currentState, ok };
}

// --- chaining (&&, ;) ------------------------------------------------------

interface ChainSegment {
  command: string;
  precedingOp: "&&" | ";" | null;
}

function splitChain(line: string): ChainSegment[] {
  const result: ChainSegment[] = [];
  let current = "";
  let precedingOp: "&&" | ";" | null = null;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;

    if (!inSingle && !inDouble) {
      if (ch === "&" && line[i + 1] === "&") {
        result.push({ command: current.trim(), precedingOp });
        current = "";
        precedingOp = "&&";
        i++;
        continue;
      }
      if (ch === ";") {
        result.push({ command: current.trim(), precedingOp });
        current = "";
        precedingOp = ";";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) result.push({ command: current.trim(), precedingOp });
  return result.filter((s) => s.command.length > 0);
}

function runChain(state: HostState, line: string, hostnameLabel: string): CommandResult {
  const segments = splitChain(line);
  if (segments.length === 0) return { output: "", newState: state, ok: true };

  let currentState = state;
  const outputs: string[] = [];
  let lastOk = true;
  for (const { command, precedingOp } of segments) {
    if (precedingOp === "&&" && !lastOk) continue; // short-circuit: previous failed
    const stages = splitPipeline(command);
    const result = runPipeline(currentState, stages, hostnameLabel);
    currentState = result.newState;
    lastOk = result.ok;
    if (result.output) outputs.push(result.output);
  }
  return { output: outputs.join("\n"), newState: currentState, ok: lastOk };
}

// --- public entry point ----------------------------------------------------

// `hostname` is passed in by the caller since a HostState on its own
// doesn't know its own name in multi-host setups.
//
// `line` is normally a single line. If it contains a newline, it's treated
// as a heredoc: the first line is the command header (which must contain
// a `<< DELIM` marker — the terminal strips the trailing delimiter line
// before calling this), and everything after is the heredoc body, passed
// through as stdin to the header command (e.g. `cat << EOF > file`).
export function runCommand(state: HostState, line: string, hostnameLabel = "sandbox"): CommandResult {
  if (!line.includes("\n")) {
    return runChain(state, line, hostnameLabel);
  }
  const newlineIdx = line.indexOf("\n");
  const header = line.slice(0, newlineIdx);
  const body = line.slice(newlineIdx + 1);
  const cleanedHeader = header.replace(/<<-?\s*['"]?(\w+)['"]?/, " ").replace(/\s+/g, " ").trim();
  return runSingleCommand(state, cleanedHeader, hostnameLabel, body);
}
