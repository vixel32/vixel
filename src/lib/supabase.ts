import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rekhlcvqpdybgqcreegr.supabase.co';
const supabaseAnonKey = 'sb_publishable_oETBQ6DWJnOxL1h9suEY2w_hqsgt-J9';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
