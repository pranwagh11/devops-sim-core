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

// Thin wrapper: xterm.js only renders text and captures keystrokes.
// All Linux/command logic happens in SimCore (commandEngine.ts) — this
// component just wires keystrokes to that engine, plus a couple of
// terminal-native conveniences (clear, history, arrow-key recall) that
// don't belong in SystemState since they're not part of the graded world.
export default function TerminalView({ prompt, onCommand, active = true }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineBufferRef = useRef<string>("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const promptRef = useRef(prompt);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  // fit() reads layout box dimensions off the container. If the container
  // is display:none (0x0) or hasn't been painted yet, xterm's internal
  // renderer dimensions object isn't initialized and fit() throws
  // "Cannot read properties of undefined (reading 'dimensions')". Always
  // check for real size and always wrap in try/catch as a last resort.
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

    // Defer the first fit until after the browser has painted this
    // container, so the width/height it reads are real (not the 0x0 a
    // hidden or not-yet-laid-out container would report synchronously).
    requestAnimationFrame(safeFit);

    term.writeln("Simulated terminal — type a command and press Enter. Try 'help' to see all commands.");
    term.write(`\r\n${prompt} `);

    const redrawLine = (text: string) => {
      term.write("\r\x1b[K" + `${promptRef.current} ` + text);
      lineBufferRef.current = text;
    };

    term.onData((data) => {
      if (data === "\u001b[A") {
        // Up arrow — recall previous command
        if (historyRef.current.length === 0) return;
        if (historyIndexRef.current === -1) historyIndexRef.current = historyRef.current.length - 1;
        else if (historyIndexRef.current > 0) historyIndexRef.current -= 1;
        redrawLine(historyRef.current[historyIndexRef.current]);
        return;
      }
      if (data === "\u001b[B") {
        // Down arrow — recall next command / clear line at the end
        if (historyIndexRef.current === -1) return;
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          redrawLine(historyRef.current[historyIndexRef.current]);
        } else {
          historyIndexRef.current = -1;
          redrawLine("");
        }
        return;
      }
      if (data === "\u001b[C" || data === "\u001b[D") {
        // left/right arrow — not supported (no mid-line cursor editing yet)
        return;
      }

      const code = data.charCodeAt(0);
      if (data === "\r") {
        const line = lineBufferRef.current;
        lineBufferRef.current = "";
        historyIndexRef.current = -1;
        term.write("\r\n");
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          historyRef.current.push(trimmed);
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
        term.write(`${promptRef.current} `);
      } else if (code === 127) {
        // Backspace
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (code < 32) {
        // ignore other control chars
      } else {
        lineBufferRef.current += data;
        term.write(data);
      }
    });

    const handleResize = () => safeFit();
    window.addEventListener("resize", handleResize);

    // Also watch the container itself — covers the case where its size
    // changes for a reason other than a window resize (e.g. a CSS layout
    // shift when a sibling element appears/disappears).
    const resizeObserver = new ResizeObserver(() => safeFit());
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit whenever this terminal transitions from hidden to visible
  // (e.g. switching project host tabs). Deferred a frame for the same
  // reason as the initial fit above.
  useEffect(() => {
    if (active) requestAnimationFrame(safeFit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return <div ref={containerRef} style={{ height: "320px", width: "100%" }} />;
}
