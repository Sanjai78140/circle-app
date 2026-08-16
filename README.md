# The Circle

A round-based matchmaking app: 10 people join, take a quiz, watch the lobby fill,
reveal locks in matches, matched pairs get a 2-minute chat, and the circle
automatically loops for the next 10 people.

## Why this version, not the Claude.ai one

The earlier prototype used a storage API that only works inside Claude.ai's
artifact preview — it can't run on your own domain. This version is a real
Node/Express server with its own JSON-file storage, so it works anywhere you
can run Node: your own VPS, Render, Railway, Fly.io, a Raspberry Pi, etc.

## Run it locally

```bash
cd circle-app
npm install
npm start
```

Then open **http://localhost:3000** in a few different browser tabs (or on a
few phones on the same network, pointing at your machine's local IP) — each
tab acts like a different person joining the circle.

## Deploy it

Any host that runs a persistent Node process works — this is *not* a static
site, since it needs the server for the shared lobby/matches/chat.

- **Render / Railway / Fly.io**: point them at this folder, build command
  `npm install`, start command `npm start`.
- **A VPS**: `npm install`, then run with `pm2 start server.js` (or similar)
  to keep it alive, and put nginx in front of it for HTTPS.
- Do **not** deploy this to a static host (GitHub Pages, Netlify static,
  Vercel static export) — there's no server there to hold shared state.

## How data is stored

Everything lives in `data.json` in the project root, written by the server —
member profiles, quiz answers, locked matches, and chat messages. Delete
that file (or just call the reveal → wait 2 minutes flow) to reset to round 1.
This is intentionally simple; for real production traffic you'd swap
`data.json` for a real database (Postgres, SQLite, etc.) — the API shape in
`server.js` would stay the same.

## The rules, as implemented

- Landing checks the shared round. If it's locked, everyone lands on results
  automatically — no code needed to see the board, though you need your code
  to see *your* personal match.
- Onboarding blocks at 10 members or once the round is locked.
- Quiz: 6 scored personality dimensions, adaptive smoking/drinking
  follow-ups (only shown if you answered "Socially"), diet, relationship
  goal, and a free-text ideal-partner line.
- Reveal is available to **any** complete member, regardless of gender, once
  the circle has at least one woman and one man. No admin/host role exists —
  it's fully self-serve.
- Matching: 45% behavior similarity + 25% shared habits/goals + 30% sun-sign
  elemental compatibility, sorted best-first, greedily locked so nobody is
  double-matched.
- Results: matched pairs get a flip-to-reveal compatibility card and a
  generated "why this match" note; unmatched people get a low-key message;
  everyone can see the full transparent list of pairs and scores.
- Every matched pair gets the same 2-minute shared chat window, timed from
  the moment reveal happened.
- The instant that window closes, the **server** wipes the round and opens
  10 fresh slots — this is centralized in `server.js` (`checkAutoLoop`), not
  left to any one client, so it can't race or get stuck.
- "Leave & start over" removes your own profile (only before lock). There's
  no separate "reset everyone" control — the auto-loop replaces it entirely.
