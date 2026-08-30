# DevOps Learning Simulator — Static Prototype (No Backend, No Database)

A fully frontend prototype: React + TypeScript + xterm.js, no server, no database. Data lives in
the browser's `localStorage` and can be exported/imported as JSON. Hosted for free on GitHub Pages.

## What's in this version

- **Content hierarchy**: Module → Lesson → Challenges + an optional Project. No Course layer yet —
  each Module (e.g. "Linux") is currently top-level.
- **Two roles**: Admin and Learner. See [Roles & access](#roles--access) below.
- **A much fuller shell**: pipes, chaining, wildcards, heredocs, cursor editing, Ctrl+C — see
  [Shell coverage](#shell-coverage).
- **Define → Test → Publish** authoring flow, unchanged in principle from the previous version.

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Deploying to GitHub Pages

**Recommended: use the included GitHub Actions workflow, not a manual "Deploy from branch" upload.**
Push to GitHub, set Pages source to **GitHub Actions** in repo settings, push to `main`.
`.github/workflows/deploy.yml` runs `npm install && npm run build` and deploys the real `dist`
output automatically — no manual build/upload step, and no way to get the folder structure wrong.

### If you're using "Deploy from branch" instead

This works, but it has one hard constraint that's easy to trip on: GitHub Pages' "Deploy from
branch" mode can **only** serve from the branch root (`/`) or a `/docs` folder — there is no
option to point it at `/dist`. If you build locally and push the `dist` folder as a subfolder
(e.g. `repo/dist/index.html`) while Pages is set to serve from root, it will serve whatever's
actually at the root (not `dist/`), and every relative asset/fetch — including `seed-data.json` —
will look in the wrong place or 404.

To do it manually and correctly:
1. Run `npm run build` locally.
2. Copy the **contents** of `dist/` (not the `dist` folder itself) to either the repo root or a
   `docs/` folder — `index.html` must end up directly inside whichever one you pick.
3. Set Pages → "Deploy from branch" → that branch → `/ (root)` or `/docs` to match.
4. Confirm by opening `https://<user>.github.io/<repo>/seed-data.json` directly in a browser —
   if that 404s, the file isn't where the server is looking, regardless of what the app does.

If seed data still doesn't load after that, open the browser console — `ensureSeeded()` logs a
warning with the exact URL it tried to fetch if the request fails, which pinpoints the mismatch
immediately.

## Content hierarchy

```
Module (e.g. "Linux")
  └─ Lesson (e.g. "Filesystem", "Process Management")
       ├─ Challenge (usually one per command/concept)
       └─ Project (optional, caps the lesson)

Module
  └─ Project (optional, capstone — attached to the module, not a specific lesson)

Project (optional — fully standalone, not attached to anything, for ad hoc assignment)
```

Admin manages this from `/modules`: create a Module, add Lessons to it, then add Challenges and
a Project from each Lesson page. A Project can instead be attached at the Module level (a
capstone) or left standalone (created from `/projects` with no lesson/module selected), matching
the "project can be instructor-assigned independent of lesson order" idea from the original design.

Deleting a Module or Lesson cascades: deleting a Module removes its Lessons and everything under
them; deleting a Lesson removes its Challenges and its Project. There are no foreign keys (per the
project's data-model decision), so the app itself is responsible for not leaving orphaned records —
this cascade is that responsibility being honored in code.

## Roles & access

**This is a local access gate, not real authentication.** Everything — the encrypted admin
credential, the code that checks it, and the app itself — ships as plain JavaScript to the
browser. Anyone with dev tools open can inspect it. What it *does* provide, compared to a plain
`if (password === "admin123")` check: the stored credential is genuinely encrypted with AES-GCM
(via the browser's real Web Crypto API), so the correct key isn't sitting in the source as
readable text, and a wrong key fails decryption outright rather than just failing a visible
equality check. That raises the bar above a plaintext comparison, but it does not stop someone
willing to brute-force the passphrase against the shipped blob offline. Real access control needs
a server-side secret — that's a "when we add a backend" item, not something a static site can do.

**Credential generation is separated from the app entirely.** This app never creates, stores, or
changes a key — it only ever attempts to decrypt a credential that already exists. Generating that
credential is a one-time, offline step using a separate tool:

1. Open `tools/admin-credential-generator.html` directly in a browser (double-click it — no server,
   no build, it's fully self-contained). This file is **not** part of the deployed app; keep it
   private on your own machine.
2. Choose a username and a key you'll remember. Click Generate.
3. The tool derives an AES-256 key from your key (PBKDF2, 100,000 iterations, random salt),
   encrypts the username with it, and shows/downloads `admin-seed.json` containing only the salt,
   IV, and ciphertext. **Your key itself is never written anywhere** — it exists in that browser
   tab's memory only for the moment the encryption runs.
4. Place the downloaded `admin-seed.json` in this app's `public/` folder (overwriting the default
   placeholder one — see below), then build and deploy as usual.
5. To log in: enter the same username and key in the app's "Admin Login" panel. The app fetches
   `admin-seed.json`, re-derives the key from your typed key and the stored salt, and attempts to
   decrypt the stored ciphertext. AES-GCM is authenticated, so a wrong key makes decryption throw
   an error outright — it doesn't silently produce wrong output that then fails a comparison, it
   fails cleanly at the crypto layer. On success, only a session flag (`role: admin`) is kept, in
   `sessionStorage` — cleared when the tab closes, or immediately via "Log out".
6. **Lost the key?** It cannot be recovered or reset from inside the app, by design — that's what
   "the key is never stored" means. Generate a new `admin-seed.json` with the tool and redeploy.

**A default `admin-seed.json` is bundled so the app works out of the box** — username `admin`,
key `changeme1234`. **Replace it before any real use** by generating your own with the tool above;
the bundled one is only there so cloning the repo and running it immediately doesn't leave Admin
completely inaccessible.

Because the credential now ships as a build artifact rather than being created per-browser in
`localStorage`, the same username/key works on every deployment of this build — solving the
earlier per-browser limitation, at the cost of needing to regenerate and redeploy to rotate it.

**What each role can do:**
- **Learner** (default, no login needed): browse Modules → Lessons, play published Challenges and
  Projects. Cannot see draft content, cannot create/edit/delete anything, cannot see the "All
  Challenges"/"All Projects" management views.
- **Admin**: everything a Learner can do, plus create/edit/delete Modules, Lessons, Challenges,
  and Projects, see draft content, and use Export/Import JSON.

## Shell coverage

**Filesystem:** `pwd`, `ls` (`-l`, `-a`, `-R`), `cd`, `mkdir` (`-p`), `touch`, `rm` (`-r`, multiple
targets), `cat` (reads a file, prints piped/heredoc input, or writes piped/heredoc input to a file
with `>`/`>>`), `echo "text" > file` / `>> file`, `chmod`, `cp` (`-r`), `mv`, `ln -s`,
`find <path> -name <pattern>`, `grep <pattern> [file]`, `head`/`tail` (`-n N`), `wc`, `du`, `df`.

**Users/system:** `useradd`, `su`, `whoami`, `id`, `date`, `uname` (`-a`), `hostname`, `ps`, `which`.

**Services:** `systemctl start|stop|restart|status|enable|disable <service>` — `status` prints a
realistic multi-line block (Loaded/Active/since/Main PID/Tasks/Memory/CGroup).

**Cross-host (projects only):** `ssh <host>` (always switches context — treated as navigation, not
gated by network rules), `curl http://<host>:<port>` (gated by the project's network rules).

**Shell features (new this round):**
- **Pipes** — `ls | grep foo`, `cat file | wc`, etc. `grep`, `head`, `tail`, `wc`, and `cat` all
  read from piped input when no file argument is given.
- **Chaining** — `mkdir /app && cd /app` runs the second command only if the first succeeded;
  `cmd1 ; cmd2` runs both regardless of success.
- **Wildcards** — `rm *.txt`, `ls /var/log/*.log` expand against matching filenames in the target
  directory. Unquoted only — `echo "*.txt"` stays literal, same as a real shell.
- **Heredocs** — `cat << EOF > /path/file`, then type lines, then a line with just `EOF` to finish
  and write the collected content to the file (or just `cat << EOF` alone to print it back).
- **Cursor editing** — left/right arrows move the cursor mid-line; typing or backspacing inserts/
  deletes at the cursor position, not just at the end.
- **Ctrl+C** — cancels the current line (or an in-progress heredoc) and returns to a fresh prompt.
- **Command history** — up/down arrows recall previous commands; `history` lists them; `clear`
  clears the screen.

**Deliberately not implemented:** Tab-completion, and command substitution (`` $(...) ``).

## Data model (what's in `localStorage` / the exported JSON)

```jsonc
{
  "modules": [ { "id": "…", "title": "Linux", "description": "…", "order": 1 } ],
  "lessons": [ { "id": "…", "module_id": "…", "title": "Filesystem", "order": 1 } ],
  "challenges": [
    {
      "id": "…", "lesson_id": "…", "title": "…", "status": "draft" | "published",
      "initial_state": { "fs": {...}, "users": [...], "currentUser": "...", "services": {...}, "cwd": "/" },
      "objectives": [ { "type": "file_exists", "path": "..." } ],
      "reference_snapshot": { /* same shape as initial_state, or null until tested */ }
    }
  ],
  "projects": [
    {
      "id": "…", "lesson_id": "… | null", "module_id": "… | null",
      "hosts": { "web01": { /* same shape as a challenge's initial_state */ } },
      "network_rules": [ { "from": "web01", "to": "app01", "port": 8080, "allowed": true } ],
      "objectives": [ { "type": "network_reachable", "from": "web01", "to": "app01", "port": 8080 } ]
    }
  ]
}
```

The admin credential lives entirely outside this data model — it's the separate `public/admin-seed.json`
build artifact described above, generated offline and never touched by Export/Import, so sharing
your content JSON with someone else never exposes it.

## Project structure

```
tools/
  admin-credential-generator.html   # offline-only tool, NEVER deploy this — produces admin-seed.json
public/
  seed-data.json               # bundled starter content (modules/lessons/challenges/projects)
  admin-seed.json              # encrypted admin credential (default: admin / changeme1234 — replace it)
src/
  storage.ts                  # localStorage CRUD for modules/lessons/challenges/projects + export/import
  auth.tsx                    # AES-GCM decrypt-only admin login + React auth context
  simcore/
    types.ts                    # HostState / Objective / Module / Lesson / Challenge / Project records
    commandEngine.ts             # Linux command interpreter: pipes, chaining, wildcards, heredocs
    networkCommands.ts           # ssh / curl cross-host interception
    validator.ts                  # objective evaluation (outcome-based grading)
  components/
    Terminal.tsx                  # xterm.js wrapper — cursor editing, Ctrl+C, heredoc collection, history
    ChallengePlayer.tsx / ProjectPlayer.tsx   # reusable terminal+objectives runners
    HostBuilder.tsx / ObjectiveBuilder.tsx / HintsBuilder.tsx
    AuthControls.tsx              # nav-bar login/logout panel (login only — no setup UI)
  pages/
    ModuleList.tsx / ModuleForm.tsx / ModuleDetail.tsx
    LessonForm.tsx / LessonDetail.tsx
    ChallengeForm.tsx / ProjectForm.tsx        # Define → Test → Publish, role-gated
    ChallengeList.tsx / ProjectList.tsx        # admin-only "all content" management views
    PlayChallenge.tsx / PlayProject.tsx        # draft-gated for learners
.github/workflows/deploy.yml   # builds + deploys to GitHub Pages on push to main
```

## What's still simplified vs. the full production architecture

- No Course layer above Module yet, and no Batch/Instructor/Exam-Evaluator roles — just Admin and
  Learner, matching what was asked for this round.
- No attempt limits, resets, exams, or leaderboard.
- No config versioning — editing and republishing overwrites in place.
- No Web Worker isolation for SimCore (runs on the main thread) — the expanded shell (pipes,
  wildcards) makes a runaway command slightly more plausible than before; worth revisiting before
  this goes in front of real learners.
- Tab-completion and command substitution (`` $(...) ``) are the two shell features explicitly
  deferred from this round.
- `ssh`/`curl` are not chain/pipe-aware (e.g. `ssh app01 && ls` won't work as a single line) — a
  known, documented limitation rather than an oversight.
- **No data migration across schema changes — only version-triggered wipe-and-reseed.** A
  `devops-sim:schema-version` stamp in `localStorage` is checked on every load; if it's behind the
  app's current version (e.g. after this project added `lesson_id` to challenges), all local
  content is cleared and the bundled seed data repopulates fresh. This is what fixes the "seed
  file loads over the network but nothing shows up" symptom — it was caused by leftover
  pre-Module-hierarchy data blocking the normal "seed only if empty" check. It also means: **a
  schema change discards local authored content rather than upgrading it.** Fine for a prototype
  with no real learner data at stake; a real migration path (rewriting old records into the new
  shape instead of deleting them) is needed before this holds content anyone would be upset to
  lose. Admins can also trigger this manually via "Reset Local Data" in the nav bar.

## Suggested next step once this is verified end-to-end

Confirm: an Admin creates a Module → Lesson → Challenge, tests it, publishes it; a Learner (no
login) can browse to it through Modules and solve it via a *different* valid command sequence than
the one used to author it, and it still passes. Also worth trying: a multi-command pipeline
(`ls -l | grep .txt`), a chained sequence (`mkdir /app && cd /app && touch file.txt`), and a
heredoc (`cat << EOF > /tmp/notes.txt`) to confirm the new shell features hold up in a real
challenge, not just in isolation. Once that's solid, next up is Git and Docker as new SimCore
engines alongside Linux.
