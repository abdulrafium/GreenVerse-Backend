const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Get all clusters
router.get('/', authenticateToken, async (req, res) => {
  try {
    // First get all clusters with manager info
    const { data: clusters, error } = await supabase
      .from('clusters')
      .select(`
        *,
        manager:users!clusters_manager_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get today's date for utilization calculation
    const today = new Date().toISOString().split('T')[0];

    // Get employee counts and real-time utilization for each cluster
    const clustersWithCounts = await Promise.all(
      clusters.map(async (cluster) => {
        // Get employee count
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('cluster_id', cluster.id);
        
        // Try to get today's production first
        const { data: todayProduction, error: prodError } = await supabase
          .from('production')
          .select('quantity, date')
          .eq('cluster_id', cluster.id)
          .eq('date', today);

        let todayTotal = todayProduction?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        let utilizationDate = today;

        // If no production today, get the most recent production date
        if (todayTotal === 0) {
          const { data: recentProduction } = await supabase
            .from('production')
            .select('quantity, date')
            .eq('cluster_id', cluster.id)
            .order('date', { ascending: false })
            .limit(10); // Get last 10 records to sum up most recent day

          if (recentProduction && recentProduction.length > 0) {
            const mostRecentDate = recentProduction[0].date;
            utilizationDate = mostRecentDate;
            todayTotal = recentProduction
              .filter(p => p.date === mostRecentDate)
              .reduce((sum, p) => sum + p.quantity, 0);
          }
        }

        const dailyCapacity = cluster.capacity || 1000;
        const utilization = Math.min(Math.round((todayTotal / dailyCapacity) * 100), 100);
        
        console.log(`Cluster ${cluster.name} (${cluster.id}):`, {
          utilizationDate,
          production: todayTotal,
          dailyCapacity,
          utilization,
          isToday: utilizationDate === today
        });
        
        return {
          ...cluster,
          employees_count: count || 0,
          utilization // Utilization from most recent production
        };
      })
    );

    res.json({ clusters: clustersWithCounts });
  } catch (error) {
    console.error('Get clusters error:', error);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// Get cluster by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { data: cluster, error } = await supabase
      .from('clusters')
      .select(`
        *,
        manager:users!clusters_manager_id_fkey(id, name, email)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Get employee count for this cluster
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('cluster_id', req.params.id);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Try to get today's production first
    const { data: todayProduction } = await supabase
      .from('production')
      .select('quantity, date')
      .eq('cluster_id', req.params.id)
      .eq('date', today);

    let todayTotal = todayProduction?.reduce((sum, p) => sum + p.quantity, 0) || 0;

    // If no production today, get the most recent production date
    if (todayTotal === 0) {
      const { data: recentProduction } = await supabase
        .from('production')
        .select('quantity, date')
        .eq('cluster_id', req.params.id)
        .order('date', { ascending: false })
        .limit(10);

      if (recentProduction && recentProduction.length > 0) {
        const mostRecentDate = recentProduction[0].date;
        todayTotal = recentProduction
          .filter(p => p.date === mostRecentDate)
          .reduce((sum, p) => sum + p.quantity, 0);
      }
    }

    const dailyCapacity = cluster.capacity || 1000;
    const utilization = Math.min(Math.round((todayTotal / dailyCapacity) * 100), 100);

    res.json({ 
      cluster: {
        ...cluster,
        employees_count: count || 0,
        utilization // Real-time utilization from today's production
      }
    });
  } catch (error) {
    console.error('Get cluster error:', error);
    res.status(500).json({ error: 'Failed to fetch cluster' });
  }
});

// Create cluster (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, manager_name, email, password, location, city, province, capacity } = req.body;

    if (!name || !manager_name || !email || !password || !capacity) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Build location from city and province if provided, otherwise use location field
    const locationValue = location || (city && province ? `${city}, ${province}` : city || province);

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create cluster first
    const { data: cluster, error: clusterError } = await supabase
      .from('clusters')
      .insert([{ name, manager_name, location: locationValue, capacity, status: 'Active', utilization: 0 }])
      .select()
      .single();

    if (clusterError) throw clusterError;

    // Create user account for cluster
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash,
        name: `${name} Manager`,
        role: 'cluster',
        location,
        cluster_id: cluster.id
      }])
      .select()
      .single();

    if (userError) {
      // Rollback cluster creation if user creation fails
      await supabase.from('clusters').delete().eq('id', cluster.id);
      throw userError;
    }

    // Update cluster with manager_id
    await supabase
      .from('clusters')
      .update({ manager_id: user.id })
      .eq('id', cluster.id);

    res.status(201).json({
      message: 'Cluster and user account created successfully',
      cluster: { ...cluster, manager_id: user.id },
      credentials: {
        email: email,
        note: 'Password has been set as provided'
      }
    });
  } catch (error) {
    console.error('Create cluster error:', error);
    res.status(500).json({ error: 'Failed to create cluster' });
  }
});

// Update cluster
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, manager_name, location, city, province, manager_id, capacity, utilization, status, email, password } = req.body;

    // Build location from city and province if provided
    const locationValue = location || (city && province ? `${city}, ${province}` : city || province);

    // Build update object with only defined values
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (manager_name !== undefined) updateData.manager_name = manager_name;
    if (locationValue !== undefined) updateData.location = locationValue;
    if (manager_id !== undefined) updateData.manager_id = manager_id;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (utilization !== undefined) updateData.utilization = utilization;
    if (status !== undefined) updateData.status = status;

    // If email or password is provided, update the user account
    if (email || password) {
      const { data: cluster } = await supabase.from('clusters').select('manager_id').eq('id', req.params.id).single();
      if (cluster?.manager_id) {
        const userUpdate = {};
        if (email) userUpdate.email = email;
        if (password) userUpdate.password_hash = await bcrypt.hash(password, 10);
        const { error: userError } = await supabase.from('users').update(userUpdate).eq('id', cluster.manager_id);
        if (userError) throw userError;
      }
    }

    const { data: updatedCluster, error } = await supabase
      .from('clusters')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Cluster updated successfully',
      cluster: updatedCluster
    });
  } catch (error) {
    console.error('Update cluster error:', error);
    res.status(500).json({ error: 'Failed to update cluster' });
  }
});

// Delete cluster (admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const clusterId = req.params.id;

    // First, delete all users associated with this cluster
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('cluster_id', clusterId);

    if (userDeleteError) {
      console.error('Error deleting cluster users:', userDeleteError);
      throw userDeleteError;
    }

    // Also delete user who is the manager of this cluster
    const { error: managerDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', (await supabase.from('clusters').select('manager_id').eq('id', clusterId).single()).data?.manager_id);

    // Then delete the cluster
    const { error: clusterDeleteError } = await supabase
      .from('clusters')
      .delete()
      .eq('id', clusterId);

    if (clusterDeleteError) {
      console.error('Error deleting cluster:', clusterDeleteError);
      throw clusterDeleteError;
    }

    res.json({
      message: 'Cluster and associated users deleted successfully'
    });
  } catch (error) {
    console.error('Delete cluster error:', error);
    res.status(500).json({ error: 'Failed to delete cluster' });
  }
});

module.exports = router;
