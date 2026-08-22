# Base44 development notes

- The editable frontend runs from the bind-mounted repository through Vite; use `docker compose -f docker-compose.base44.yml up -d`.
- No private credential is required to boot. The Supabase browser client has a committed public project URL/anon-key fallback and can fall back to browser-local storage when no usable remote configuration exists.
- Verify from both local and proxy-style hosts: `curl -fsS http://localhost:3000/` and `curl -fsS -H 'Host: external-preview.example.com' http://localhost:3000/`.
- Useful checks: `npm run build`, `npm run lint`, and `docker compose -f docker-compose.base44.yml logs web`.
