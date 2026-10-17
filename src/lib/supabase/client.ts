import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hvkwepswkgqnbneqagno.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseAnonKey &&
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY_HERE' &&
  supabaseAnonKey.length > 20
);

// Khởi tạo Supabase client với Realtime bật sẵn
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'dummy-anon-key-for-initialization',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
