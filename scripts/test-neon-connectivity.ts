import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }
  console.log('Connecting to Neon...');
  const sql = postgres(url, { connect_timeout: 10 });
  try {
    const r = await sql`SELECT 1 as ok, now() as ts`;
    console.log('CONNECTED:', JSON.stringify(r));
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('CONNECTION FAILED:', err instanceof Error ? err.message : String(err));
    await sql.end().catch(() => undefined);
    process.exit(1);
  }
}

void main();
