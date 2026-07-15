const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.ifbeuwuhnpglbdnybxyw:Hello_world!!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL successfully!');

  const sqlPath = path.join(__dirname, '../infra/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing schema.sql...');
  await client.query(sql);
  console.log('Schema executed successfully!');
  await client.end();
}

run().catch(err => {
  console.error('Error executing schema:', err);
  process.exit(1);
});
