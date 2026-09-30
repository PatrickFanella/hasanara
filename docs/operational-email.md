# Operational email

`scripts/operational-alerts.py` checks `/api/health` and the database-backed
`/api/archive/summary`. It sends operator notifications through Brevo when the
failed checks change, and sends one recovery message when they recover. A healthy
first run sends nothing. The default recipient is `patrick@subcult.tv`; the sender
is `HasanAra Operations <noreply@hasanara.tv>`.

Run without credentials to inspect availability without sending:

```sh
python3 scripts/operational-alerts.py
```

For scheduled operation, supply `BREVO_API_KEY` through an owner-readable
environment file and run with `--send`. Optional variables are
`HASANARA_ALERT_BASE_URL`, `HASANARA_ALERT_FROM`, and `HASANARA_ALERT_TO`. A five-minute
timer is sufficient. Use one persistent `--state` file for the deployed instance;
the lock prevents overlapping sends. The state records failed check paths and, while
acceptance is uncertain, a notification UUID and timestamp.
Dry runs do not change notification state. Provider failures return code 2 without
printing provider content or credentials. No scheduler is enabled by this change.

Exit codes: 0 means checks passed, 1 means a monitored check failed, and 2 means
the monitor could not complete. A successful Brevo response establishes provider
acceptance; inbox delivery still requires a separate check.

Tests: `python3 scripts/operational-alerts.test.py`.

## Schedule on an independent host

Run the monitor outside the HasanAra application host so it can report a host
outage. The supplied user service uses an owner-readable environment file and
needs Python 3 and systemd; it adds no paid service.

After reviewing the script, install it on the chosen monitoring host:

```sh
install -d -m 700 ~/.config/subcult/email ~/.local/lib/hasanara ~/.config/systemd/user
install -m 700 scripts/operational-alerts.py ~/.local/lib/hasanara/operational-alerts.py
install -m 600 deploy/systemd/hasanara-operational-alerts.* ~/.config/systemd/user/
```

Privately populate `~/.config/subcult/email/hasanara.env` with `BREVO_API_KEY`,
`HASANARA_ALERT_TO=patrick@subcult.tv`, and
`HASANARA_ALERT_FROM=noreply@hasanara.tv`; set mode 600. Run the script without
`--send` first. Once sending and the recipient have been approved:

```sh
systemctl --user daemon-reload
systemctl --user enable --now hasanara-operational-alerts.timer
systemctl --user list-timers hasanara-operational-alerts.timer
journalctl --user -u hasanara-operational-alerts.service
```

The user manager must remain running for scheduled checks; verify lingering or
use an established always-running monitor account. Stop the timer with
`systemctl --user disable --now hasanara-operational-alerts.timer`.

Notification retries reuse a persisted UUID within 29 minutes, inside Brevo's
[30-minute idempotency window](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).
If acceptance remains uncertain beyond that window, the monitor stops sending
and exits 2. Check Brevo's transactional logs before resolving the pending state;
removing it without checking can duplicate a previously accepted message.
Provider acceptance does not prove inbox delivery. This monitors public API and
database availability; ingestion freshness, queue depth, GPU workers, disk usage,
and failure of the monitoring host itself require separate checks.
