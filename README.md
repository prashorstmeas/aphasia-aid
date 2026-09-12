# Aphasia Aid

A local-first web app (installable PWA) for people with aphasia or speech impairment, and the therapists/carers who support them. Includes an AI conversation companion (Claude) and on-device camera understanding of gestures and expression.

## What it does

**Patient mode** (default, no login)
- **Talk** – picture boards grouped by category (Basics, People, Needs, Feelings, Pain, Food, Places, Actions). Tapping a picture speaks it and adds it to a sentence strip; **Speak** reads the whole sentence aloud.
- **Practice** – *Name the picture* (with spoken hints) and *Repeat the word*. Speech recognition suggests a score; the patient or helper always confirms with big ✓ / ✗ buttons, so it still works when recognition is unreliable or unavailable.

- **Chat** – an AI companion for conversation practice. Free conversation on therapist-chosen topics, or role-play scenarios (order a coffee, call the doctor…). Replies are one or two short sentences, spoken aloud, with tappable word suggestions and a gently offered word when the patient is stuck. Input can be speech, quick tiles, gestures, or a camera snapshot.
- **Camera (optional, on-device)** – MediaPipe runs in the browser: 👍/👎/✋ gestures and head nods/shakes answer Yes/No/Stop; facial expression shows a mood chip and prompts if pain is detected; repeated mouth movement means "trying to speak" and starts listening. Video never leaves the device. Pressing **Look at what I show** sends a single photo to Claude to work out what the patient is pointing at or holding and offers phrases as tiles.

**Therapist mode** (⚙️, PIN – default `1234`)
- **Progress** – 7-day stats, daily accuracy chart, per-word accuracy (hardest first), recent attempts.
- **Boards** – add/rename/reorder boards; add/edit/reorder tiles (emoji, label, optional longer spoken phrase).
- **Practice words** – manage the word list, difficulty, and the hint that is read aloud.
- **Companion** – server status, feature toggles (camera, gesture answers, expression), patient profile and interests, topics, role-play scenarios, and a log of conversations with transcripts.
- **Settings** – voice, speaking speed, tile size, speak-on-tap, auto-scoring, PIN, JSON backup/restore, reset.

All data lives in the browser (IndexedDB) on this device only. Export a backup before clearing browser data.

## Run it

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY (needed for the companion only)
npm run dev               # web app on http://localhost:5173 + API server on :8787
```

Production: `npm run build` then `npm start` – the Node server serves the built app and the `/api` routes from one origin (default port 8787).

The API key lives only on the server. The browser talks to `/api/chat` and `/api/vision`; everything else (boards, practice, TTS, gesture detection) works with no server at all.

### AI details

- Model: Claude Opus 5 (`claude-opus-5`), low effort for fast turn-taking, structured JSON replies, and Anthropic's server-side refusal fallbacks enabled so a safety decline is retried on a suitable model instead of stalling the conversation.
- The system prompt encodes supported-conversation techniques for aphasia: one idea per sentence, one question at a time, yes/no or either/or when struggling, never correcting, repeating back correct words, no medical advice, stopping on distress.
- Camera processing uses `@mediapipe/tasks-vision` (gesture recognizer + face landmarker with blendshapes), served from `public/models` and `public/wasm` so it works offline after first load.

Speech uses the browser's built-in Web Speech API. Text-to-speech works everywhere and offline; speech recognition works in Chrome, Edge and Safari and needs an internet connection in most browsers.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS 4 · Dexie (IndexedDB) · vite-plugin-pwa · MediaPipe Tasks Vision · Express + `@anthropic-ai/sdk` (server)

## Roadmap ideas

- Accounts and sync so a therapist can follow several patients remotely (the server is the natural place)
- Per-patient gesture mapping and calibration; tune expression thresholds with real users
- Real pictogram sets (e.g. ARASAAC) and photo tiles instead of emoji
- More exercise types: sentence completion, yes/no comprehension, reading aloud
- Dwell/scan selection for users who cannot tap accurately
