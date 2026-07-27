import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function checkTable() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error fetching notifications:', error);
  } else {
    console.log('Notifications table exists and is accessible.');
  }
}

checkTable();
