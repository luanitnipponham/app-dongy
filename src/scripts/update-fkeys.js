const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.hvkwepswkgqnbneqagno',
  password: '!@#Dongy@123',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Updating foreign key constraints for cascade delete...');

  // 1. wallet_transactions -> bookings ON DELETE CASCADE
  await client.query(`
    ALTER TABLE public.wallet_transactions 
    DROP CONSTRAINT IF EXISTS wallet_transactions_booking_id_fkey,
    ADD CONSTRAINT wallet_transactions_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
  `);

  // 2. bookings -> profiles (patient_id) ON DELETE CASCADE
  await client.query(`
    ALTER TABLE public.bookings 
    DROP CONSTRAINT IF EXISTS bookings_patient_id_fkey,
    ADD CONSTRAINT bookings_patient_id_fkey 
      FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  `);

  // 3. bookings -> profiles (practitioner_id) ON DELETE CASCADE
  await client.query(`
    ALTER TABLE public.bookings 
    DROP CONSTRAINT IF EXISTS bookings_practitioner_id_fkey,
    ADD CONSTRAINT bookings_practitioner_id_fkey 
      FOREIGN KEY (practitioner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  `);

  console.log('✓ Constraints updated successfully!');
  await client.end();
}

main().catch(console.error);
