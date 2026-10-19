import { ensureProductionPublication } from '../server/ensure-publication.mjs';
try {
  const result = await ensureProductionPublication(process.env);
  console.log(result === 'created' ? 'First public content snapshot created and verified.' : result === 'existing' ? 'Public content verified. Saved drafts were not published.' : 'Automatic publication skipped outside Vercel Production.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
