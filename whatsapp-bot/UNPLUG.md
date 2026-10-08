# Unplugging the WhatsApp channel

The WhatsApp channel is built as a plug-in. Everything it owns lives in four folders.
Outside those it touches the rest of IndSure at exactly **seven marked spots in three files**, and every
one is tagged `WHATSAPP-PLUGIN`:

```bash
grep -rn "WHATSAPP-PLUGIN" backend/server frontend/client/src
```

## Level 1: switch it off (no code change, fully reversible)

1. On EC2: `pm2 stop indsure-wa-bot && pm2 delete indsure-wa-bot && pm2 save`
2. In the backend `.env`: remove `WA_BOT_KEY`, then restart the backend.

With no key, the backend registers no WhatsApp route, the auth hook steps aside for every
request, and the rate-limit exemption never applies. The Settings card sees a 404 and renders
nothing. The backend behaves as if the plug-in were not there
(test: "plug-in OFF" in `backend/server/tests/whatsapp.test.ts`).

Data stays in its tables, so switching back on is putting the key back and starting pm2.

## Level 2: remove the code

Delete these (all WhatsApp-only):

| Path | What |
|---|---|
| `whatsapp-bot/` | the bot process |
| `backend/server/whatsapp/` | bot auth, portal link routes, internal routes, number guard |
| `backend/server/tests/whatsapp.test.ts` | its tests |
| `frontend/client/src/features/whatsapp/` | Settings card + its own EN/HI strings |
| `docs/plans/2026-09-25-whatsapp-bot-beta.md` | optional: keep as history |

Then undo the seven marked spots:

| File | Marked lines | Change |
|---|---|---|
| `backend/server/routes.ts` | import near the top | delete the line |
| `backend/server/routes.ts` | block at the top of `verifyJwt`, between `WHATSAPP-PLUGIN` and `/WHATSAPP-PLUGIN` | delete the block |
| `backend/server/routes.ts` | `mountWhatsapp(app, verifyJwt)` near the end | delete the line and its comment |
| `backend/server/index.ts` | import + global limiter `skip` | delete the import; set `skip: (req) => req.path === "/api/health",` |
| `frontend/client/src/pages/agent/SettingsNew.tsx` | import + `<WhatsAppConnectCard />` | delete both |

Check: `grep -rn "WHATSAPP-PLUGIN\|whatsapp/" backend/server frontend/client/src` finds
nothing, then `npm run check`, `npm test`, `npm run guard`.

Shared locale files, `package.json` and the other migrations were never touched.

## Level 3: remove the data

Run `migrations/024_whatsapp_bot_down.sql` (drops the five `wa_*` / `whatsapp_link` tables).
This is irreversible for the message log and link history; export first if you want the
metrics. Policies checked over WhatsApp are ordinary `clients` rows and stay in advisors'
books.

Finally, remove the bot's session folder (`WA_AUTH_DIR`) from EC2 and from the R2 backup, and
log the bot SIM out of WhatsApp (phone > Linked devices).
