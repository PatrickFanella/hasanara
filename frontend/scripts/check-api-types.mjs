// Fail when src/types/generated/api.ts differs from the types generated from
// the OpenAPI document of the pinned core (../core/docs/api/openapi.json).
// HasanAra does not run the API, so it checks against the committed spec of
// the core revision it deploys instead of regenerating the spec.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const spec = '../core/docs/api/openapi.json';
const committed = 'src/types/generated/api.ts';
// Generate inside frontend/ so Prettier applies the project configuration.
const scratch = mkdtempSync('.contract-check.');
try {
  const generated = join(scratch, 'api.ts');
  execFileSync('node_modules/.bin/openapi-typescript', [spec, '--output', generated], {
    stdio: 'pipe',
  });
  execFileSync('node_modules/.bin/prettier', ['--write', generated], { stdio: 'pipe' });
  if (!readFileSync(generated).equals(readFileSync(committed))) {
    console.error(`${committed} does not match ${spec}; run npm run api:generate.`);
    process.exitCode = 1;
  } else {
    console.log(`${committed} matches ${spec}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
