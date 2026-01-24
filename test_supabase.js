// Test Supabase connection and sessions table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.frontend' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection\n');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'MISSING');
console.log('');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.frontend');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    // Test 1: Check if sessions table exists
    console.log('1️⃣  Testing sessions table read...');
    const { data: sessions, error: readError } = await supabase
      .from('sessions')
      .select('id, user_id, created_at')
      .limit(1);
    
    if (readError) {
      console.error('❌ Failed to read sessions table:', readError.message);
      console.error('   Code:', readError.code);
      console.error('   Details:', readError.details);
      console.error('   Hint:', readError.hint);
    } else {
      console.log('✅ Sessions table exists and is readable');
      console.log('   Found', sessions?.length || 0, 'sessions');
    }
    
    // Test 2: Try to insert a test session (will fail due to RLS if not authenticated)
    console.log('\n2️⃣  Testing session creation (will fail without auth)...');
    const testSessionId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('sessions')
      .insert({
        id: testSessionId,
        user_id: 'test_user_' + Date.now(),
        status: 'active'
      });
    
    if (insertError) {
      if (insertError.code === '42501') {
        console.log('⚠️  RLS policy blocking insert (expected without auth)');
        console.log('   This is normal - you need to be logged in via Clerk');
      } else {
        console.error('❌ Failed to insert session:', insertError.message);
        console.error('   Code:', insertError.code);
      }
    } else {
      console.log('✅ Test session created (RLS might be disabled)');
    }
    
    // Test 3: Check messages table
    console.log('\n3️⃣  Testing messages table...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id')
      .limit(1);
    
    if (messagesError) {
      console.error('❌ Failed to read messages table:', messagesError.message);
    } else {
      console.log('✅ Messages table exists and is readable');
    }
    
    console.log('\n========================================');
    console.log('Diagnosis:');
    if (readError || messagesError) {
      console.log('❌ Database tables not accessible');
      console.log('\nPossible issues:');
      console.log('1. Tables don\'t exist - run migrations');
      console.log('2. Wrong database URL or key');
      console.log('3. Network connectivity issue');
    } else {
      console.log('✅ Database connection OK');
      console.log('\nTo fix the frontend error:');
      console.log('1. Make sure you\'re logged in with Clerk');
      console.log('2. Check browser console for detailed errors');
      console.log('3. Verify RLS policies allow authenticated users to create sessions');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

test();
