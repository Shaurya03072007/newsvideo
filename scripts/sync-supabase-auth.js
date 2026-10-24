import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('--- Checking Supabase Auth & Public Users ---');
  
  // 1. Fetch all users from public.users
  const { data: dbUsers, error: dbErr } = await supabase
    .from('users')
    .select('id, email, display_name, display_name_telugu, role, google_id');

  if (dbErr) {
    console.error('Error fetching public.users:', dbErr.message);
    return;
  }

  console.log(`Found ${dbUsers?.length || 0} user records in public.users:`);
  for (const u of dbUsers || []) {
    console.log(`  - [${u.role}] ${u.email} (${u.display_name})`);
  }

  // 2. Fetch existing auth.users
  const { data: authList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing auth.users:', listErr.message);
    return;
  }
  const existingEmails = new Set((authList?.users || []).map((u) => u.email?.toLowerCase()));
  console.log(`Current users in Supabase Auth (auth.users): ${existingEmails.size}`);

  // 3. For any user with an email, provision in auth.users
  for (const u of dbUsers || []) {
    if (!u.email) continue;
    const lowerEmail = u.email.toLowerCase();
    if (existingEmails.has(lowerEmail)) {
      console.log(`✓ ${u.email} already exists in Supabase Authentication dashboard.`);
      continue;
    }

    console.log(`Attempting to provision ${u.email} into Supabase Auth...`);
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      user_metadata: {
        name: u.display_name,
        displayNameTelugu: u.display_name_telugu,
        role: u.role,
        sub: u.google_id || u.id,
      },
    });

    if (createErr) {
      console.warn(`✗ Could not create auth user for ${u.email}:`, createErr.message);
      if (createErr.message.includes('Database error')) {
        console.warn('  --> Please run fix_supabase_trigger.sql in your Supabase SQL Editor first!');
      }
    } else {
      console.log(`✓ Successfully registered ${u.email} into Supabase Auth (${created?.user?.id})`);
    }
  }

  console.log('\n--- Final Supabase Auth Check ---');
  const { data: finalAuth } = await supabase.auth.admin.listUsers();
  console.log(`Total users in Supabase Authentication dashboard: ${finalAuth?.users?.length || 0}`);
  for (const u of finalAuth?.users || []) {
    console.log(`  - ${u.email} (${u.id})`);
  }
}

main().catch(console.error);
