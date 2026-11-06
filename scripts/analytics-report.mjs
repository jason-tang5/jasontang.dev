// Usage: node scripts/analytics-report.mjs [7|30|90]
// Set CLOUDFLARE_ACCOUNT_ID and ANALYTICS_TOKEN in your environment.
import { queries, sql, summarize } from '../worker/analytics.mjs';
const days = Number(process.argv[2] ?? 30);
try {
  const q = queries(days);
  const { CLOUDFLARE_ACCOUNT_ID: accountId, ANALYTICS_TOKEN: token } = process.env;
  if (!accountId || !token) throw new Error('Set CLOUDFLARE_ACCOUNT_ID and ANALYTICS_TOKEN first.');
  const [events, daily, places] = await Promise.all([sql(q.events, { accountId, token }), sql(q.daily, { accountId, token }), sql(q.places, { accountId, token })]);
  console.log(JSON.stringify({ days, ...summarize(events, daily, places) }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
