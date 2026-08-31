# Supabase backups

The Supabase project is on the **Free plan, which has no automated backups at all**.
This directory is the replacement: a nightly encrypted logical dump pushed to
Cloudflare R2.

| | |
|---|---|
| Runs on | the existing EC2 box (`api.indsure.in`) |
| Schedule | nightly, 02:30 IST, via systemd timer |
| Contents | `public` + `auth` schemas (+ `storage` metadata if permitted) |
| Encryption | GPG AES256, client-side, so R2 never sees readable data |
| Retention | 90 days remote, last 3 locally |
| Cost | zero (R2 free tier is 10GB; dumps are far smaller) |

## Why these choices

- **`auth` is dumped, not just `public`.** This project uses Supabase Auth
  (`auth.users` is referenced by `migrations/002_individual_portfolio.sql`).
  A `public`-only backup restores the data but leaves every user locked out.
- **Port 5432, not 6543.** The app's `DATABASE_URL` uses the transaction pooler,
  which cannot serve `pg_dump`. The backup uses the session pooler.
- **Encrypted before upload.** The dump is the entire client PII set. Encrypting
  client-side means a compromised R2 account or bucket key leaks nothing.
- **Runs on EC2, not GitHub Actions.** Actions would require the production
  `DATABASE_URL` in repo secrets, letting anyone with write access exfiltrate
  the whole database via a workflow.

## What is NOT covered

- **Project-level config**: RLS policies outside `public`, edge functions, auth
  provider settings, secrets. Schema and RLS are reproducible from `migrations/`.

Supabase Storage file blobs **are** covered, by `supabase-storage-backup.sh`. That runs
as the second half of `nightly-backup.sh`, which is what the timer actually invokes.
It mirrors each object into R2 once, encrypted, rather than re-uploading the whole set
nightly: blobs are immutable, so a fresh copy every night would spend 6GB to hold 68MB.
A nightly manifest records what the set looked like on each day, and a file deleted at
source is kept for `REMOTE_KEEP_DAYS` before being purged, so a mistaken delete is
recoverable.

## One-time setup

Everything below is done by you, because it involves creating accounts and handling
credentials.

**1. Create the R2 bucket**

In the Cloudflare dashboard: R2 → Create bucket, name it `indsure-backups`,
location Asia-Pacific. Then R2 → Manage API Tokens → Create token, scoped to
**Object Read & Write on that bucket only**. Note the access key, secret, and
your account ID.

**2. Provision the EC2 box** (as root)

```
apt-get update && apt-get install -y postgresql-client-17 gnupg awscli curl
mkdir -p /opt/indsure/backup /etc/indsure /var/backups/supabase
chmod 700 /etc/indsure /var/backups/supabase
```

If `postgresql-client-17` is unavailable, add the PGDG repo. The client major
version must be >= the Supabase server version; the script checks and tells you.

**3. Generate the encryption passphrase**

```
openssl rand -base64 48 > /etc/indsure/backup.passphrase
chmod 600 /etc/indsure/backup.passphrase
```

**Copy this into a password manager now.** It is not recoverable, and without it
every backup is permanently unreadable.

**4. Configure**

Copy `backup.env.example` to `/etc/indsure/backup.env`, fill in the R2 keys and
the session-pooler URL (Supabase Dashboard → Connect → Session pooler), then
`chmod 600 /etc/indsure/backup.env`.

**5. Install and start**

```
cp supabase-backup.sh supabase-restore.sh /opt/indsure/backup/
chmod +x /opt/indsure/backup/*.sh
cp supabase-backup.service supabase-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now supabase-backup.timer
```

**6. Prove it works**

```
systemctl start supabase-backup.service && journalctl -u supabase-backup -n 50 --no-pager
```

Expect `BACKUP OK`. Then confirm the object landed:

```
aws s3 ls s3://indsure-backups/supabase/ --recursive --endpoint-url "$R2_ENDPOINT"
```

## Restoring

An untested backup is not a backup. Restore into a **scratch Supabase project**,
never over production:

```
./supabase-restore.sh s3://indsure-backups/supabase/2026/08/indsure-<stamp>.tar.gz.gpg \
  "postgresql://postgres.<scratch-ref>:<pw>@<host>:5432/postgres?sslmode=require"
```

The script refuses a target that looks like production unless `ALLOW_PROD=1`.
`auth` is restored before `public` because public tables carry FKs onto
`auth.users`.

**Do this once a quarter.** A restore drill is the only thing that distinguishes
a backup from a directory of files you hope are valid.

## Monitoring

Set `HEALTHCHECK_URL` to a free healthchecks.io check pinged on success and
`/fail` on error. Without it, a backup that silently stops running is
indistinguishable from one that works, which is the usual way people discover
they had no backups.
