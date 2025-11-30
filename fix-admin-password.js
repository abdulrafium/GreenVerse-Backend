require('dotenv').config();
const { supabaseAdmin } = require('./config/supabase');
const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
  try {
    console.log('🔐 Updating admin password...\n');
    
    // Generate proper bcrypt hash for 'admin123'
    const hash = await bcrypt.hash('admin123', 10);
    console.log('✅ Hash generated');
    
    // Update the password in database
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: hash })
      .eq('email', 'admin@greenverse.com')
      .select();
    
    if (error) {
      console.error('❌ Error updating password:', error);
      process.exit(1);
    }
    
    console.log('✅ Admin password updated successfully!');
    
    // Verify the password works
    const isValid = await bcrypt.compare('admin123', hash);
    console.log('✅ Password verification:', isValid ? 'PASSED' : 'FAILED');
    
    console.log('\n🎉 You can now login with:');
    console.log('   Email: admin@greenverse.com');
    console.log('   Password: admin123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateAdminPassword();
