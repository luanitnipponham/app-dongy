const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = '!@#Dongy@123';
const ref = 'hvkwepswkgqnbneqagno';

// Common regions for Supabase poolers
const poolerHosts = [
  'db.hvkwepswkgqnbneqagno.supabase.co', // Direct (Port 5432)
  'aws-0-ap-southeast-1.pooler.supabase.com', // Singapore (common in Vietnam)
  'aws-0-ap-southeast-2.pooler.supabase.com', // Sydney
  'aws-0-ap-northeast-1.pooler.supabase.com', // Tokyo
  'aws-0-ap-northeast-2.pooler.supabase.com', // Seoul
  'aws-0-ap-south-1.pooler.supabase.com', // Mumbai
  'aws-0-us-east-1.pooler.supabase.com', // US East
  'aws-0-us-west-1.pooler.supabase.com', // US West
  'aws-0-eu-central-1.pooler.supabase.com', // Frankfurt
];

async function tryConnect(host, port, user) {
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log(`✓ Connected successfully via host: ${host} (port: ${port})`);
    return client;
  } catch (err) {
    // console.log(`Failed host ${host}:`, err.message);
    try { await client.end(); } catch (e) {}
    return null;
  }
}

async function run() {
  console.log('Finding connection to Supabase database for project ' + ref + '...');

  let client = null;

  // 1. Try direct connection first
  console.log('Trying direct connection to db.' + ref + '.supabase.co:5432...');
  client = await tryConnect(`db.${ref}.supabase.co`, 5432, 'postgres');

  // 2. Try poolers if direct fails
  if (!client) {
    console.log('Direct connection not reachable, trying Supabase connection poolers...');
    for (const host of poolerHosts.slice(1)) {
      process.stdout.write(`Trying ${host}:6543 (Session/Transaction pooler)... `);
      client = await tryConnect(host, 6543, `postgres.${ref}`);
      if (client) break;
      else console.log('not reached.');

      process.stdout.write(`Trying ${host}:5432... `);
      client = await tryConnect(host, 5432, `postgres.${ref}`);
      if (client) break;
      else console.log('not reached.');
    }
  }

  if (!client) {
    console.error('\n❌ Could not connect to Supabase PostgreSQL with the provided password.');
    console.error('Please check if the project is active or if the password "!@#Dongy@123" is exact.');
    process.exit(1);
  }

  console.log('\nReading schema file: supabase/schema.sql ...');
  const sqlPath = path.join(__dirname, '../../supabase/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing SQL migration script on Supabase...');
  try {
    await client.query(sql);
    console.log('\n======================================================');
    console.log('🎉 THÀNH CÔNG! ĐÃ TẠO TOÀN BỘ CƠ SỞ DỮ LIỆU TRÊN SUPABASE:');
    console.log('- Đã tạo 3 Kiểu ENUM (user_role, booking_status, tx_type)');
    console.log('- Đã tạo 5 Bảng (profiles, practitioner_profiles, wallets, bookings, wallet_transactions)');
    console.log('- Đã tạo 3 Hàm RPC (accept_booking_with_escrow, complete_booking_and_deduct_commission, cancel_booking_and_refund_lock)');
    console.log('- Đã kích hoạt Realtime cho các bảng');
    console.log('- Đã chèn dữ liệu mẫu (Seed Data 5 tài khoản và đơn KB-261017-01)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
