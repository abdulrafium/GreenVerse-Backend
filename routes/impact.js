const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get impact statistics (admin only)
router.get('/stats', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // Get total production quantity (waste processed)
    const { data: production, error: prodError } = await supabase
      .from('production')
      .select('quantity, created_at');

    if (prodError) throw prodError;

    const totalWasteProcessed = production?.reduce((sum, prod) => sum + (prod.quantity || 0), 0) || 0;

    // Calculate this month's waste
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const monthProduction = production?.filter(prod => {
      const prodDate = new Date(prod.created_at);
      return prodDate >= new Date(monthStart) && prodDate <= new Date(monthEnd);
    }) || [];

    const monthWaste = monthProduction.reduce((sum, prod) => sum + (prod.quantity || 0), 0);

    // CO2 saved calculation (1kg banana waste = 0.3kg CO2 saved)
    const totalCO2Saved = Math.round(totalWasteProcessed * 0.3);
    const monthCO2 = Math.round(monthWaste * 0.3);

    // Landfill diverted (assume 80% would go to landfill)
    const totalLandfillDiverted = Math.round(totalWasteProcessed * 0.8);
    const monthLandfill = Math.round(monthWaste * 0.8);

    // Farmers supported (get unique cluster count as proxy)
    const { data: clusters, error: clusterError } = await supabase
      .from('clusters')
      .select('id');

    if (clusterError) throw clusterError;

    // Assume 10 farmers per cluster
    const farmersSupported = (clusters?.length || 0) * 10;

    // Trees equivalent (1 tree absorbs ~20kg CO2 per year)
    const treesEquivalent = Math.round(totalCO2Saved / 20);

    // Active clusters
    const activeClusters = clusters?.length || 0;

    // Active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'client');

    if (usersError) throw usersError;

    const activeUsers = users?.length || 0;

    res.json({
      stats: {
        wasteProcessed: totalWasteProcessed,
        wasteChange: '+12%',
        co2Saved: totalCO2Saved,
        co2Change: '+8%',
        landfillDiverted: totalLandfillDiverted,
        landfillChange: '+15%',
        farmersSupported,
        farmersChange: '+8',
        treesEquivalent,
        activeClusters,
        activeUsers
      }
    });
  } catch (error) {
    console.error('Get impact stats error:', error);
    res.status(500).json({ error: 'Failed to fetch impact statistics' });
  }
});

// Get environmental impact trend (admin only)
router.get('/trend', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { data: production, error } = await supabase
      .from('production')
      .select('quantity, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by month
    const monthlyData = {};
    production?.forEach(prod => {
      const date = new Date(prod.created_at);
      const monthKey = date.toLocaleString('default', { month: 'short' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += prod.quantity || 0;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const trendData = [];

    for (let i = 3; i >= 0; i--) {
      const monthIndex = (now.getMonth() - i + 12) % 12;
      const monthName = months[monthIndex];
      const waste = monthlyData[monthName] || 0;
      const co2 = Math.round(waste * 0.3);
      
      trendData.push({
        month: monthName,
        waste,
        co2
      });
    }

    res.json({ trendData });
  } catch (error) {
    console.error('Get impact trend error:', error);
    res.status(500).json({ error: 'Failed to fetch impact trend' });
  }
});

module.exports = router;
