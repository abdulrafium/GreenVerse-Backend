const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Get all attendance records (filtered by cluster for cluster users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        cluster:clusters(id, name, location)
      `)
      .order('date', { ascending: false });

    // Filter by cluster for cluster role
    if (req.user.role === 'cluster' && req.user.cluster_id) {
      query = query.eq('cluster_id', req.user.cluster_id);
    }

    const { data: attendance, error } = await query;

    if (error) throw error;

    res.json({ attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Create attendance record (cluster role only)
router.post('/', authenticateToken, authorizeRole('cluster'), async (req, res) => {
  try {
    const { worker_name, shift, status, date } = req.body;

    if (!worker_name || !shift || !status || !date) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Get cluster_id from user
    const cluster_id = req.user.cluster_id;
    if (!cluster_id) {
      return res.status(400).json({ error: 'No cluster associated with this user' });
    }

    // Create attendance record
    const { data: attendance, error } = await supabase
      .from('attendance')
      .insert([{
        cluster_id,
        worker_name,
        shift,
        status,
        date
      }])
      .select(`
        *,
        cluster:clusters(id, name)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// Bulk create attendance records (cluster role only)
router.post('/bulk', authenticateToken, authorizeRole('cluster'), async (req, res) => {
  try {
    const { attendanceRecords } = req.body;

    if (!attendanceRecords || !Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({ error: 'Attendance records are required' });
    }

    // Get cluster_id from user
    const cluster_id = req.user.cluster_id;
    if (!cluster_id) {
      return res.status(400).json({ error: 'No cluster associated with this user' });
    }

    // Prepare bulk insert data
    const attendanceData = attendanceRecords.map(record => ({
      cluster_id,
      employee_id: record.employee_id,
      worker_name: record.worker_name,
      status: record.status,
      date: record.date
    }));

    // Check if attendance already exists for this date
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('id, date')
      .eq('cluster_id', cluster_id)
      .eq('date', attendanceRecords[0].date);

    if (checkError) {
      throw checkError;
    }

    // If attendance exists for this date, delete it first
    if (existingAttendance && existingAttendance.length > 0) {
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('cluster_id', cluster_id)
        .eq('date', attendanceRecords[0].date);

      if (deleteError) {
        throw deleteError;
      }
    }

    // Insert new attendance records
    const { data: attendance, error } = await supabase
      .from('attendance')
      .insert(attendanceData)
      .select();

    if (error) {
      throw error;
    }

    res.status(201).json({
      message: 'Attendance marked successfully',
      count: attendance.length,
      attendance
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to mark attendance',
      details: error.message 
    });
  }
});

// Get attendance for a specific date
router.get('/date/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    
    let query = supabase
      .from('attendance')
      .select(`
        *,
        cluster:clusters(id, name, location)
      `)
      .eq('date', date);

    // Filter by cluster for cluster role
    if (req.user.role === 'cluster' && req.user.cluster_id) {
      query = query.eq('cluster_id', req.user.cluster_id);
    }

    const { data: attendance, error } = await query;

    if (error) throw error;

    res.json({ attendance });
  } catch (error) {
    console.error('Get attendance by date error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Get attendance statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('attendance')
      .select('status')
      .eq('date', targetDate);

    // Filter by cluster for cluster role
    if (req.user.role === 'cluster' && req.user.cluster_id) {
      query = query.eq('cluster_id', req.user.cluster_id);
    }

    const { data: attendance, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const stats = {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'Present').length,
      absent: attendance.filter(a => a.status === 'Absent').length,
      leave: attendance.filter(a => a.status === 'Leave').length,
      presentPercentage: attendance.length > 0 
        ? Math.round((attendance.filter(a => a.status === 'Present').length / attendance.length) * 100)
        : 0
    };

    res.json({ stats, date: targetDate });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance statistics' });
  }
});

module.exports = router;
