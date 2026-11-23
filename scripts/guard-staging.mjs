import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const project = 'teo-co-may-lich-su';
const branch = 'staging';
const wrangler = process.env.WRANGLER_BIN ?? join(process.cwd(), 'node_modules/.bin/wrangler');

function abort(reason) {
  console.error(`guard:staging aborted, nothing was deployed: ${reason}`);
  process.exit(1);
}

function wranglerJson(args) {
  const run = spawnSync(wrangler, [...args, '--json'], { encoding: 'utf8' });
  if (run.error || run.status !== 0) abort(`wrangler ${args.join(' ')} failed: ${run.error?.message ?? run.stderr.trim()}`);
  let data = null;
  try {
    data = JSON.parse(run.stdout);
  } catch {
    data = null;
  }
  if (!Array.isArray(data)) abort(`wrangler ${args.join(' ')} did not return a JSON list`);
  return data;
}

const projects = wranglerJson(['pages', 'project', 'list']);
if (!projects.some((row) => row['Project Name'] === project)) abort(`Pages project ${project} does not exist; create it with a non-${branch} production branch first`);

const deployments = wranglerJson(['pages', 'deployment', 'list', '--project-name', project]);
const onBranch = deployments.filter((row) => row.Branch === branch);
const live = onBranch.filter((row) => row.Environment !== 'Preview');
if (live.length > 0) abort(`a deployment from branch ${branch} is in the ${live[0].Environment} environment, so ${branch} is the live branch of ${project}`);
const elsewhere = deployments.some((row) => row.Environment === 'Production' && row.Branch !== branch);
if (onBranch.length === 0 && !elsewhere) abort(`no deployment proves that ${branch} is a preview branch of ${project}`);
console.log(`guard:staging ok: branch ${branch} deploys to the Preview environment of ${project}`);
