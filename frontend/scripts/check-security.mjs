// Dependency security gate, carried over from the core's release checks:
// no high or critical npm advisories (including dev dependencies), and no use
// of the React Router APIs that the core's advisory review excluded.
//
// An advisory with no patched release reachable from this dependency tree may
// be excepted in security/npm-advisory-exceptions.json. Each exception names
// one advisory for one package, carries a reason, and expires on a date; an
// expired or unused exception fails the gate so the list cannot go stale.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const router = JSON.parse(
  execFileSync('node', ['scripts/check-react-router-usage.mjs', 'src'], { encoding: 'utf8' })
);
if (!Array.isArray(router.findings)) throw new Error('malformed React Router checker output');
if (router.findings.length > 0) {
  console.error(`Restricted React Router usage:\n${router.findings.join('\n')}`);
  process.exit(1);
}

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);
const ADVISORY_ID =
  /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function loadExceptions(today) {
  const document = JSON.parse(readFileSync('security/npm-advisory-exceptions.json', 'utf8'));
  if (document.schema_version !== 1 || !Array.isArray(document.exceptions))
    throw new Error('malformed security/npm-advisory-exceptions.json');
  const exceptions = new Map();
  const expired = [];
  for (const entry of document.exceptions) {
    const { advisory, package: name, expires_on: expiresOn, reason } = entry;
    if (!ADVISORY_ID.test(advisory ?? '') || typeof name !== 'string' || !name)
      throw new Error(
        `advisory exception needs a GHSA id and a package name: ${JSON.stringify(entry)}`
      );
    if (!DATE.test(expiresOn ?? '') || Number.isNaN(Date.parse(`${expiresOn}T00:00:00Z`)))
      throw new Error(`advisory exception ${advisory} needs an expires_on date (YYYY-MM-DD)`);
    if (typeof reason !== 'string' || reason.trim().length < 40)
      throw new Error(`advisory exception ${advisory} needs a written reason`);
    const key = `${name} ${advisory}`;
    if (exceptions.has(key)) throw new Error(`duplicate advisory exception ${key}`);
    if (expiresOn <= today) expired.push(`${key} expired on ${expiresOn}`);
    exceptions.set(key, { ...entry, used: false });
  }
  return { exceptions, expired };
}

const today = new Date().toISOString().slice(0, 10);
const { exceptions, expired } = loadExceptions(today);
if (expired.length > 0) {
  console.error(
    `Expired npm advisory exceptions; upgrade the dependency or renew the entry deliberately:\n${expired.join('\n')}`
  );
  process.exit(1);
}

const audit = spawnSync(
  'npm',
  ['audit', '--package-lock-only', '--include=dev', '--audit-level=high', '--json'],
  { encoding: 'utf8', env: { ...process.env, NPM_CONFIG_OMIT: '', NPM_CONFIG_PRODUCTION: 'false' } }
);
if (audit.status !== 0 && audit.status !== 1) {
  console.error(`npm audit failed (${audit.status}): ${audit.stderr}`);
  process.exit(1);
}
const { vulnerabilities } = JSON.parse(audit.stdout);
if (!vulnerabilities || typeof vulnerabilities !== 'object')
  throw new Error('malformed npm audit output');

// A package blocks when it carries a high or critical advisory that is not
// excepted, or when it depends on a package that blocks. npm reports the
// dependency links as plain package names inside `via`.
function advisoryId(url) {
  const match = /GHSA-[^/]+$/.exec(url ?? '');
  return match ? match[0] : null;
}

const direct = new Map();
for (const [name, record] of Object.entries(vulnerabilities)) {
  const advisories = (record.via ?? []).filter((item) => typeof item === 'object');
  const blocking = [];
  for (const advisory of advisories) {
    if (!BLOCKING_SEVERITIES.has(advisory.severity)) continue;
    const id = advisoryId(advisory.url);
    const exception = id ? exceptions.get(`${name} ${id}`) : undefined;
    if (exception) {
      exception.used = true;
      continue;
    }
    blocking.push(`${advisory.severity} ${id ?? advisory.title}`);
  }
  direct.set(name, blocking);
}

const blockingPackages = new Map(
  [...direct]
    .filter(([, advisories]) => advisories.length > 0)
    .map(([name, a]) => [name, a.join(', ')])
);
let changed = true;
while (changed) {
  changed = false;
  for (const [name, record] of Object.entries(vulnerabilities)) {
    if (blockingPackages.has(name)) continue;
    const parents = (record.via ?? []).filter((item) => typeof item === 'string');
    const blockingParent = parents.find((parent) => blockingPackages.has(parent));
    if (blockingParent) {
      blockingPackages.set(name, `depends on ${blockingParent}`);
      changed = true;
    }
  }
}

if (blockingPackages.size > 0) {
  console.error(
    [...blockingPackages]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, why]) => `blocking: ${name} (${why})`)
      .join('\n')
  );
  process.exit(1);
}

const unused = [...exceptions.values()].filter((exception) => !exception.used);
if (unused.length > 0) {
  console.error(
    `Unused npm advisory exceptions; remove them:\n${unused
      .map((exception) => `${exception.package} ${exception.advisory}`)
      .join('\n')}`
  );
  process.exit(1);
}

const excepted = [...exceptions.values()].map(
  (exception) =>
    `${exception.package} ${exception.advisory} (excepted until ${exception.expires_on})`
);
console.log(
  [
    'no restricted React Router usage; npm audit has no blocking high or critical vulnerabilities',
    ...excepted,
  ].join('\n')
);
