// Dependency security gate, carried over from the core's release checks:
// no high or critical npm advisories (including dev dependencies), and no use
// of the React Router APIs that the core's advisory review excluded.
import { execFileSync, spawnSync } from 'node:child_process';

const router = JSON.parse(
  execFileSync('node', ['scripts/check-react-router-usage.mjs', 'src'], { encoding: 'utf8' })
);
if (!Array.isArray(router.findings)) throw new Error('malformed React Router checker output');
if (router.findings.length > 0) {
  console.error(`Restricted React Router usage:\n${router.findings.join('\n')}`);
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
const blocking = Object.entries(vulnerabilities).filter(([, record]) =>
  ['high', 'critical'].includes(record.severity)
);
if (blocking.length > 0) {
  console.error(blocking.map(([name, record]) => `${record.severity}: ${name}`).join('\n'));
  process.exit(1);
}
console.log('no restricted React Router usage; npm audit has no high or critical vulnerabilities');
