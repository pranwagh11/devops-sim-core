import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  prompt: string;
  onCommand: (line: string) => string; // returns output text to print
  // Whether this terminal's container is currently visible. Hosts other
  // than the active tab in a multi-host project stay mounted (so their
  // scrollback/history survives switching tabs) but are hidden via CSS —
  // fit() must not run against a zero-size hidden container, and must
  // re-run once the container becomes visible again. Defaults to true for
  // the common single-terminal case (challenges).
  active?: boolean;
}

const HEREDOC_START = /<<-?\s*['"]?(\w+)['"]?/;

// Thin wrapper: xterm.js only renders text and captures keystrokes.
// All Linux/command logic happens in SimCore (commandEngine.ts) — this
// component wires keystrokes to that engine, plus terminal-native
// conveniences (clear, history, arrow-key recall, cursor editing, Ctrl+C,
// and heredoc line-collection) that don't belong in SystemState since
// they're not part of the graded world.
export default function TerminalView({ prompt, onCommand, active = true }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineBufferRef = useRef<string>("");
  const cursorPosRef = useRef<number>(0);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const promptRef = useRef(prompt);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const heredocRef = useRef<{ delimiter: string; headerLine: string; bodyLines: string[] } | null>(null);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const safeFit = () => {
    const el = containerRef.current;
    const addon = fitAddonRef.current;
    if (!el || !addon) return;
    if (el.clientWidth === 0 || el.clientHeight === 0) return;
    try {
      addon.fit();
    } catch {
      // Swallow — a failed fit just means the terminal keeps its last
      // known size until the next successful fit (resize, tab switch).
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      theme: { background: "#12161f" },
      convertEol: true,
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    requestAnimationFrame(safeFit);

    term.writeln("Simulated terminal — type a command and press Enter. Try 'help' to see all commands.");
    term.write(`\r\n${promptRef.current} `);

    const currentPromptText = () => (heredocRef.current ? "> " : `${promptRef.current} `);

    // Full redraw of the line from the terminal's current cursor row,
    // then reposition the terminal cursor to match cursorPosRef. Needed
    // for any edit that isn't a simple end-of-line append (mid-line
    // insert/delete, or restoring a recalled history entry).
    const refreshLine = () => {
      const line = lineBufferRef.current;
      const pos = cursorPosRef.current;
      term.write("\r\x1b[K" + currentPromptText() + line);
      const moveLeft = line.length - pos;
      if (moveLeft > 0) term.write(`\x1b[${moveLeft}D`);
    };

    const resetLine = (text = "") => {
      lineBufferRef.current = text;
      cursorPosRef.current = text.length;
    };

    term.onData((data) => {
      // --- Ctrl+C: abort current line / heredoc collection ---
      if (data === "\u0003") {
        term.write("^C\r\n");
        heredocRef.current = null;
        historyIndexRef.current = -1;
        resetLine("");
        term.write(currentPromptText());
        return;
      }

      // --- arrow keys ---
      if (data === "\u001b[A") {
        if (heredocRef.current) return; // no history recall mid-heredoc
        if (historyRef.current.length === 0) return;
        if (historyIndexRef.current === -1) historyIndexRef.current = historyRef.current.length - 1;
        else if (historyIndexRef.current > 0) historyIndexRef.current -= 1;
        resetLine(historyRef.current[historyIndexRef.current]);
        refreshLine();
        return;
      }
      if (data === "\u001b[B") {
        if (heredocRef.current) return;
        if (historyIndexRef.current === -1) return;
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          resetLine(historyRef.current[historyIndexRef.current]);
        } else {
          historyIndexRef.current = -1;
          resetLine("");
        }
        refreshLine();
        return;
      }
      if (data === "\u001b[D") {
        if (cursorPosRef.current > 0) {
          cursorPosRef.current -= 1;
          term.write("\u001b[D");
        }
        return;
      }
      if (data === "\u001b[C") {
        if (cursorPosRef.current < lineBufferRef.current.length) {
          cursorPosRef.current += 1;
          term.write("\u001b[C");
        }
        return;
      }

      const code = data.charCodeAt(0);

      // --- Enter ---
      if (data === "\r") {
        const line = lineBufferRef.current;
        resetLine("");
        historyIndexRef.current = -1;
        term.write("\r\n");

        if (heredocRef.current) {
          if (line.trim() === heredocRef.current.delimiter) {
            const fullCommand = heredocRef.current.headerLine + "\n" + heredocRef.current.bodyLines.join("\n");
            heredocRef.current = null;
            const output = onCommand(fullCommand);
            if (output) term.writeln(output.replace(/\n/g, "\r\n"));
          } else {
            heredocRef.current.bodyLines.push(line);
          }
          term.write(currentPromptText());
          return;
        }

        const trimmed = line.trim();
        if (trimmed.length > 0) {
          historyRef.current.push(trimmed);

          const heredocMatch = trimmed.match(HEREDOC_START);
          if (heredocMatch) {
            heredocRef.current = { delimiter: heredocMatch[1], headerLine: line, bodyLines: [] };
            term.write(currentPromptText());
            return;
          }

          if (trimmed === "clear") {
            term.clear();
          } else if (trimmed === "history") {
            const lines = historyRef.current.map((h, i) => `${String(i + 1).padStart(3)}  ${h}`);
            term.writeln(lines.join("\r\n"));
          } else {
            const output = onCommand(line);
            if (output) term.writeln(output.replace(/\n/g, "\r\n"));
          }
        }
        term.write(currentPromptText());
        return;
      }

      // --- Backspace ---
      if (code === 127) {
        if (cursorPosRef.current > 0) {
          const line = lineBufferRef.current;
          const pos = cursorPosRef.current;
          lineBufferRef.current = line.slice(0, pos - 1) + line.slice(pos);
          cursorPosRef.current = pos - 1;
          refreshLine();
        }
        return;
      }

      // --- ignore other control characters ---
      if (code < 32) return;

      // --- printable input: insert at cursor position ---
      const line = lineBufferRef.current;
      const pos = cursorPosRef.current;
      lineBufferRef.current = line.slice(0, pos) + data + line.slice(pos);
      cursorPosRef.current = pos + data.length;
      if (pos === line.length) {
        // Fast path: appending at the end doesn't need a full redraw.
        term.write(data);
      } else {
        refreshLine();
      }
    });

    const handleResize = () => safeFit();
    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(() => safeFit());
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active) requestAnimationFrame(safeFit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return <div ref={containerRef} style={{ height: "320px", width: "100%" }} />;
}
