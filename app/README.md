# HTET Preparation

React + Vite implementation of the HTET Preparation web app design (`../project/HTET Prep.dc.html`).

## Run

```
npm install
npm run dev
```

## Build

```
npm run build
```

All state (sessions, tasks, notes, quiz attempts, flashcard schedules, mastery marks) persists
to `localStorage` under the key `htet-prep-v1`, matching the original prototype. There is no
backend — this is a local-only client app, per the approved scope.
