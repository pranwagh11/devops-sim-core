# DevOps Learning Simulator — Static Prototype (No Backend, No Database)

A fully frontend prototype: React + TypeScript + xterm.js, with **no server and no
database**. All data (Challenges and Projects) lives in the browser's `localStorage`
and can be exported/imported as a JSON file. Built to be hosted for free on **GitHub
Pages**.

  #Live version : https://pranwagh11.github.io/devops-sim-core/

## What's different from the earlier full-stack prototype

- No Express, no PostgreSQL, no Docker Compose. Just a static site.
- Data persistence is `localStorage`, seeded on first load from a bundled
  `public/seed-data.json`. "Saving as a JSON file" happens via the **Export JSON**
  button in the nav bar (downloads a real `.json` file you can keep, version in git,
  or share) and **Import JSON** (loads a previously exported file back in, merging
  with what's already there).
- Routing uses `HashRouter` (URLs look like `#/challenges`) instead of `BrowserRouter`,
  because GitHub Pages can't do server-side rewrites for client-side routes.
- Authoring now follows a real **Define → Test → Publish** flow (see below) instead
  of a plain save button.
- The Linux command set is much broader — see the full list below, including
  `ls -l`, `grep`, `find`, `cp`, `mv`, `ps`, `man`, command history with the up/down
  arrows, and `clear`.

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings → **Pages**, set the source to **GitHub Actions**.
3. Push to `main` — `.github/workflows/deploy.yml` builds the app and deploys it
   automatically. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

No build secrets, no environment variables, no server to provision — it's a static
site end to end.

## The authoring flow: Define → Test → Publish

This is the core workflow the app is built around, and it's the same for both
Challenges and Projects:

1. **Define** — fill in the starting environment (directories, files, users,
   services — or multiple named hosts for a project) and the objectives that define
   "done," all through dropdowns and text fields. No JSON writing required.
2. **Test** — click "Load Test Environment" to get a real terminal running your own
   config. Solve it yourself. The objectives panel updates live. This is the exact
   same terminal and grading engine a learner will use later.
3. **Publish** — the Publish button stays disabled until your own test run has
   passed every objective at least once. Once it has, publishing captures a
   **reference snapshot** of that passing final state and stores it alongside the
   challenge — shown to you for transparency (so you can sanity-check what "correct"
   looks like), but **grading is always run against the `objectives` list, never a
   diff against this snapshot**. A learner solving it a different valid way than you
   did will still pass.

You can also **Save as Draft** at any point without testing, to come back to later.
Drafts are visible in the list with a "draft" badge and are fully playable by you,
but wouldn't be surfaced to real learners in a production build.

## SimCore command coverage (Linux, simplified)

**Filesystem:** `pwd`, `ls` (`-l`, `-a`, `-R`), `cd`, `mkdir` (`-p`), `touch`, `rm`
(`-r`), `cat`, `echo "text" > file` / `>> file`, `chmod`, `cp` (`-r`), `mv`,
`ln -s`, `find <path> -name <pattern>`, `grep <pattern> <file>`, `head`/`tail`
(`-n N`), `wc`, `du`, `df`.

**Users/system:** `useradd`, `su`, `whoami`, `id`, `date`, `uname` (`-a`), `hostname`,
`ps`, `which`.

**Services:** `systemctl start|stop|restart|status|enable|disable <service>`. `status`
prints a realistic multi-line block (Loaded/Active/since/Main PID/Tasks/Memory/CGroup,
plus a Listen line if the service has a port) rather than a one-line summary.

**Cross-host (projects only):** `ssh <host>` (always switches context — treated as
navigation, not gated by network rules), `curl http://<host>:<port>` (gated by the
project's network rules — this is what objectives actually check).

**Terminal conveniences (not part of graded state):** `clear`, `history`, and
up/down arrow key recall of previous commands.

**Discoverability:** `help` lists every command; `man <command>` or `help <command>`
shows usage for one.

Deliberately not implemented yet: pipes (`|`), command chaining (`&&`, `;`), and
wildcard globbing (`*`). These need a small parser rewrite (building a pipeline AST
instead of parsing one command at a time) and are a natural next round once the
single-command set has been fully exercised.

## Data model (what's actually in `localStorage` / the exported JSON)

```jsonc
{
  "challenges": [
    {
      "id": "…",
      "title": "…",
      "status": "draft" | "published",
      "initial_state": { "fs": {...}, "users": [...], "currentUser": "...", "services": {...}, "cwd": "/" },
      "objectives": [ { "type": "file_exists", "path": "..." }, ... ],
      "hints": ["..."],
      "reference_snapshot": { /* same shape as initial_state, or null until tested */ }
    }
  ],
  "projects": [
    {
      "id": "…",
      "hosts": { "web01": { /* same shape as a challenge's initial_state */ }, "app01": {...} },
      "network_rules": [ { "from": "web01", "to": "app01", "port": 8080, "allowed": true } ],
      "objectives": [ { "type": "network_reachable", "from": "web01", "to": "app01", "port": 8080 }, ... ]
    }
  ]
}
```

## Project structure

```
public/
  seed-data.json          # bundled starter content, loaded into localStorage on first run
src/
  storage.ts               # localStorage CRUD + export/import (replaces the old REST API layer)
  simcore/
    types.ts                # HostState / Objective / ChallengeRecord / ProjectRecord
    commandEngine.ts         # the expanded Linux command interpreter
    networkCommands.ts       # ssh / curl cross-host interception
    validator.ts              # objective evaluation (outcome-based grading)
  components/
    Terminal.tsx              # xterm.js wrapper — history, clear, arrow-key recall
    ChallengePlayer.tsx       # reusable terminal+objectives runner (single host)
    ProjectPlayer.tsx         # reusable terminal+objectives runner (multi-host)
    HostBuilder.tsx           # form section: starting dirs/files/users/services
    ObjectiveBuilder.tsx      # form section: dynamic objective rows
    HintsBuilder.tsx
  pages/
    ChallengeForm.tsx         # Define → Test → Publish, single host
    ProjectForm.tsx           # Define → Test → Publish, multi host
    ChallengeList.tsx / ProjectList.tsx
    PlayChallenge.tsx / PlayProject.tsx   # thin wrappers around the Player components
.github/workflows/deploy.yml # builds + deploys to GitHub Pages on push to main
```

## What's still simplified vs. the full production architecture

- Single-user, no auth/roles — this is a personal authoring/learning sandbox, not a
  multi-tenant platform.
- No Lesson/Module/Course hierarchy yet — flat Challenges and Projects only.
- No attempt limits, resets, exams, or leaderboard.
- No config versioning — editing and republishing overwrites in place.
- No Web Worker isolation for SimCore (runs on the main thread) — fine at this scale,
  but the production plan moves it off the main thread so a runaway command can't
  freeze the UI.
- No pipes/chaining/wildcards in the shell parser yet (see command coverage above).

## Suggested next step once this is verified end-to-end

Confirm: author creates a challenge, tests it, publishes it — then solves it again
via a *different* valid command sequence than the one used to author it, and it
still passes. That's the real proof the objective-based grading holds up before
moving on to adding Git and Docker as new SimCore engines alongside Linux.
