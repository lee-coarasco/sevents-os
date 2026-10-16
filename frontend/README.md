# SEVENTS frontend

Vite + React 18 + TypeScript + Tailwind. Talks to the `backend/` API over
REST, and to Supabase Auth directly from the browser (anon key, RLS enforces
real access control server-side).

## Local development

```
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

The backend must be running separately (`cd ../backend && npm run dev`) with
`FRONTEND_ORIGIN=http://localhost:5173` so CORS allows the dev server through
(this is already the backend's default).

## Scripts

- `npm run dev` — local dev server
- `npm run build` — type-check + production build
- `npm test` — vitest
- `npm run lint` — type-check only
