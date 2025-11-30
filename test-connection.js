require('dotenv').config();
const { supabase } = require('./config/supabase');

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  
  try {
    // Test 1: Check users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (userError) throw userError;
    console.log('✅ Users table accessible');
    
    // Test 2: Check products table
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('count')
      .limit(1);
    
    if (prodError) throw prodError;
    console.log('✅ Products table accessible');
    
    // Test 3: Check if admin user exists
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('email, role, name')
      .eq('email', 'admin@greenverse.com')
      .single();
    
    if (adminError) throw adminError;
    console.log('✅ Admin user found:', admin.name, `(${admin.role})`);
    
    // Test 4: Count all tables
    const tables = ['users', 'products', 'orders', 'clusters', 'production', 'attendance', 'invoices', 'impact_metrics'];
    console.log('\n📊 Table counts:');
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      } else {
        console.log(`   ${table}: ${count} rows`);
      }
    }
    
    console.log('\n🎉 Supabase connection successful! All systems operational.\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testConnection();
