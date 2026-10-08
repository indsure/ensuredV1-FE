# IndSure WhatsApp bot (beta)

Advisors send a health policy PDF to the IndSure WhatsApp number and get the report back in
the same chat. They can also ask about a report, get a share message for a customer, and
see renewals.

Plan and decision log: [`docs/plans/2026-09-25-whatsapp-bot-beta.md`](../docs/plans/2026-09-25-whatsapp-bot-beta.md).

## How it fits

```
advisor's WhatsApp  <->  whatsapp-bot (this folder, pm2 on EC2)
                            |  HTTP to 127.0.0.1, header x-wa-bot-key
                            v
                         backend (routes.ts)
                            POST /api/agent/analyze            same path as a portal upload
                            GET  /api/agent/analyze/status/:id
                            /api/internal/wa/*                 backend/server/whatsapp/
```

- The bot has no database credentials and no model key. Everything goes through the backend.
- The bot only ever replies to the advisor who wrote to it. It never messages a customer:
  SHARE and REMIND hand the advisor a wa.me link and the advisor presses send.
- Scores, rupee amounts and dates are the engine's stored values. The model (off by default)
  only phrases answers from stored fields, and any reply with a number not in those fields is
  thrown away (`backend/server/whatsapp/answerGuard.ts`).

## It is a plug-in

Everything lives in `whatsapp-bot/`, `backend/server/whatsapp/`,
`frontend/client/src/features/whatsapp/` and one migration pair. It touches the rest of
IndSure at seven marked spots in three files (`routes.ts`, `index.ts`, `SettingsNew.tsx`), all tagged `WHATSAPP-PLUGIN`. To switch it off, unset `WA_BOT_KEY`.
To remove it, see [UNPLUG.md](UNPLUG.md).

## Tests

```bash
npm test
```

33 bot tests with a fake WhatsApp and a fake engine, covering linking, dedupe, unknown
numbers, non-PDFs, oversized, locked, Hindi, motor, unknown type, duplicates, out of checks,
a 3-file queue, slow checks, failures, questions, SHARE, RENEWALS/REMIND, cancel, timeouts
and the copy rules. Backend side: `npx tsx --test backend/server/tests/whatsapp.test.ts`.

If `src/shared/draftMessage.ts` fails its test, the portal template changed: run `npm run sync`.

## Going live (Phase 0): steps that need Deep

Everything above this line is built and tested. These steps change prod or need the phone,
so each one waits for Deep's go-ahead.

1. **Run the migration** `migrations/024_whatsapp_bot.sql` in the Supabase SQL editor.
   Beta and prod share one database, so this is a prod change. It only adds 5 new tables and
   puts `deepshah399@gmail.com` on the beta list. Check:
   `SELECT * FROM wa_allowlist;` should show one row.
2. **Backend env on EC2** (add to the backend's `.env`, then restart it):
   ```
   WA_BOT_KEY=<openssl rand -hex 32>
   WA_BOT_DISPLAY_NUMBER=91XXXXXXXXXX   # the bot SIM's number, shown in the portal card
   WA_LLM_ENABLED=false                 # true only after Deep approves model spend
   ```
3. **Deploy the backend.** Copy the new folder `backend/server/whatsapp/`, then splice the
   lines marked `WHATSAPP-PLUGIN` (never scp a whole routes.ts): three places in `routes.ts`,
   two in `index.ts`. `grep -rn WHATSAPP-PLUGIN backend/server` lists them.
4. **nginx:** block the internal surface from the internet, even though it also checks the key:
   ```
   location /api/internal/ { return 404; }
   ```
5. **Install the bot on EC2:**
   ```bash
   cd ~/indsure/whatsapp-bot   # copy this folder, without node_modules
   npm ci
   cp .env.example .env        # fill in WA_BOT_KEY (same value as the backend)
   pm2 start ecosystem.config.cjs && pm2 save
   pm2 logs indsure-wa-bot     # a QR code appears
   ```
6. **Pair the SIM.** On the bot phone: WhatsApp > Linked devices > Link a device, and scan the QR
   from the logs. Never use anyone's personal number.
7. **Back up the session folder** (`WA_AUTH_DIR`) with the nightly encrypted R2 backup, so
   re-pairing after a server problem is quick. It is the bot's WhatsApp login: never in git.
8. **Ship the portal card** (Settings > WhatsApp (beta)) with the next beta deploy. It only
   shows for accounts on `wa_allowlist`.
9. **Link Deep's number:** portal Settings > WhatsApp > enter number > Get my code > send
   `LINK 123456` to the bot.
10. **Phase 0 run:** 30+ real policies, comparing every WhatsApp result with the portal result
    for the same PDF. Metrics queries are in `metrics.sql`.

## Switches

| Env | Where | Effect |
|---|---|---|
| `WA_BOT_ENABLED=true` | bot | Off by default: the process exits at start. |
| `WA_BOT_KEY` | both | Unset or under 32 chars: the whole bot surface on the backend is off. |
| `WA_LLM_ENABLED=true` | backend | Off by default: no model calls, rule answers and templates only. |

## Adding an advisor to the beta

```sql
INSERT INTO wa_allowlist (agent_id, note)
SELECT a.id, 'beta' FROM agents a JOIN auth.users u ON u.id = a.id
WHERE lower(u.email) = lower('advisor@example.com');
```

## If the number is banned

Pair the spare SIM (step 6 with an empty `WA_AUTH_DIR`), update `WA_BOT_DISPLAY_NUMBER`,
restart the backend, and tell beta advisors the new number by email. Their links stay valid:
links are tied to the advisor's own number, not the bot's.
