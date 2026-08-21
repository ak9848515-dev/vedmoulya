// Create the missing domain databases in the Docker Postgres (superuser = vedmoulya).
// Uses the `postgres` driver already installed in the workspace. Non-loopback LAN IP.
import postgres from 'postgres';

const adminUrl = 'postgres://vedmoulya:vedmoulya-dev@10.121.86.158:5432/postgres';
const sql = postgres(adminUrl, { ssl: false, max: 1, connect_timeout: 10 });

await sql`SELECT 1`; // verify connectivity
const existing = await sql`SELECT datname FROM pg_database WHERE datistemplate = false`;
console.log('Existing DBs:', existing.map((r) => r.datname).join(', '));

const needed = [
  'vedmoulya_knowledge',
  'vedmoulya_decision',
  'vedmoulya_execution',
  'vedmoulya_memory',
  'vedmoulya_content_agency',
];
for (const db of needed) {
  try {
    await sql.unsafe(`CREATE DATABASE ${db}`);
    console.log(`CREATED: ${db}`);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg.includes('42P04') || msg.includes('already exists')) {
      console.log(`EXISTS (skip): ${db}`);
    } else {
      console.log(`ERROR ${db}: ${msg.slice(0, 200)}`);
    }
  }
}
await sql.end();
console.log('Done.');
