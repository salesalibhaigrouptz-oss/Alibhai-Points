import { supabase } from './src/config/supabase.js';

async function checkFunction() {
  console.log('Checking if preview_purchase function exists...');

  // Try to list all RPC functions
  const { data: functions, error: listError } = await supabase.rpc('preview_purchase', {
    p_customer_code: 'TEST',
    p_amount: 1000
  });

  if (listError) {
    console.error('Function does NOT exist or error calling it:', listError);
    console.error('Error details:', JSON.stringify(listError, null, 2));
  } else {
    console.log('Function EXISTS! Response:', functions);
  }

  // Try to get all functions from pg_proc
  const { data: pgData, error: pgError } = await supabase
    .from('pg_proc')
    .select('*')
    .eq('proname', 'preview_purchase')
    .eq('pronamespace', 'public'::regnamespace);

  if (pgError) {
    console.error('Error querying pg_proc:', pgError);
  } else {
    console.log('pg_proc result:', pgData);
  }
}

checkFunction().then(() => process.exit(0)).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
