const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Get all materials (filtered by cluster for cluster users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = supabase
      .from('materials')
      .select(`
        *,
        cluster:clusters!materials_cluster_id_fkey(id, name, location)
      `)
      .order('created_at', { ascending: false });

    // Filter by cluster for cluster role
    if (req.user.role === 'cluster' && req.user.cluster_id) {
      query = query.eq('cluster_id', req.user.cluster_id);
    }

    const { data: materials, error } = await query;

    if (error) throw error;

    res.json({ materials });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Create material (cluster role only)
router.post('/', authenticateToken, authorizeRole('cluster'), async (req, res) => {
  try {
    const { name, quantity, unit, quality, supplier, cost_per_unit } = req.body;

    if (!name || !quantity || !unit) {
      return res.status(400).json({ error: 'Name, quantity, and unit are required' });
    }

    // Get cluster_id from user
    const cluster_id = req.user.cluster_id;
    if (!cluster_id) {
      return res.status(400).json({ error: 'Cluster ID not found for user' });
    }

    const { data: material, error } = await supabase
      .from('materials')
      .insert([{
        cluster_id,
        name,
        quantity: parseFloat(quantity),
        unit,
        quality: quality || null,
        supplier: supplier || null,
        cost_per_unit: cost_per_unit ? parseFloat(cost_per_unit) : null
      }])
      .select(`
        *,
        cluster:clusters!materials_cluster_id_fkey(id, name, location)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ material });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// Update material
router.put('/:id', authenticateToken, authorizeRole('cluster'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, unit, quality, supplier, cost_per_unit } = req.body;

    // Verify material belongs to user's cluster
    const { data: existing, error: fetchError } = await supabase
      .from('materials')
      .select('cluster_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (existing.cluster_id !== req.user.cluster_id) {
      return res.status(403).json({ error: 'Not authorized to update this material' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (unit !== undefined) updateData.unit = unit;
    if (quality !== undefined) updateData.quality = quality;
    if (supplier !== undefined) updateData.supplier = supplier;
    if (cost_per_unit !== undefined) updateData.cost_per_unit = cost_per_unit ? parseFloat(cost_per_unit) : null;

    const { data: material, error } = await supabase
      .from('materials')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        cluster:clusters!materials_cluster_id_fkey(id, name, location)
      `)
      .single();

    if (error) throw error;

    res.json({ material });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// Delete material
router.delete('/:id', authenticateToken, authorizeRole('cluster'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify material belongs to user's cluster
    const { data: existing, error: fetchError } = await supabase
      .from('materials')
      .select('cluster_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (existing.cluster_id !== req.user.cluster_id) {
      return res.status(403).json({ error: 'Not authorized to delete this material' });
    }

    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

module.exports = router;
