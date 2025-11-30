const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Get client profile
router.get('/', authenticateToken, authorizeRole('client'), async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('client_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    // If no profile exists yet, return null
    if (error && error.code === 'PGRST116') {
      return res.json({ profile: null });
    }

    if (error) throw error;

    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Create or update client profile
router.post('/', authenticateToken, authorizeRole('client'), async (req, res) => {
  try {
    const { phone, city, district, state, address_line } = req.body;

    // Validate required fields
    if (!phone || !city || !district || !state || !address_line) {
      return res.status(400).json({ 
        error: 'All fields are required',
        missing: { phone: !phone, city: !city, district: !district, state: !state, address_line: !address_line }
      });
    }

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    let profile;

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabaseAdmin
        .from('client_profiles')
        .update({
          phone,
          city,
          district,
          state,
          address_line
        })
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (error) throw error;
      profile = data;
    } else {
      // Create new profile
      const { data, error } = await supabaseAdmin
        .from('client_profiles')
        .insert([{
          user_id: req.user.id,
          phone,
          city,
          district,
          state,
          address_line
        }])
        .select()
        .single();

      if (error) throw error;
      profile = data;
    }

    res.json({
      message: 'Profile saved successfully',
      profile
    });
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Check if profile is complete
router.get('/check', authenticateToken, authorizeRole('client'), async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('phone, city, district, state, address_line')
      .eq('user_id', req.user.id)
      .single();

    const isComplete = profile && 
      profile.phone && 
      profile.city && 
      profile.district && 
      profile.state && 
      profile.address_line;

    res.json({ 
      isComplete,
      profile: profile || null
    });
  } catch (error) {
    console.error('Check profile error:', error);
    res.json({ isComplete: false, profile: null });
  }
});

module.exports = router;
