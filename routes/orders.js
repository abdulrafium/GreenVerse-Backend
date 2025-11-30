const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Get all orders (with filters and items)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:users(id, name, email),
        product:products(id, name, price)
      `)
      .order('created_at', { ascending: false});

    // Filter by user role
    if (req.user.role === 'client') {
      query = query.eq('user_id', req.user.id);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    // Fetch order items for each order
    const ordersWithItems = await Promise.all(
      (orders || []).map(async (order) => {
        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select(`
            *,
            product:products(id, name, price, category)
          `)
          .eq('order_id', order.id);

        // Fetch client profile
        const { data: profile } = await supabaseAdmin
          .from('client_profiles')
          .select('phone, city, district, state, address_line')
          .eq('user_id', order.user_id)
          .single();

        return {
          ...order,
          items: items || [],
          profile: profile || null
        };
      })
    );

    res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:users(id, name, email),
        product:products(id, name, price)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Clients can only see their own orders
    if (req.user.role === 'client' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch order items
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select(`
        *,
        product:products(id, name, price, category)
      `)
      .eq('order_id', order.id);

    // Fetch client profile
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('phone, city, district, state, address_line')
      .eq('user_id', order.user_id)
      .single();

    res.json({ 
      order: {
        ...order,
        items: items || [],
        profile: profile || null
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Create new order with multiple products
router.post('/cart', authenticateToken, async (req, res) => {
  try {
    const { items, delivery_date } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    // Check if client profile is complete
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('phone, city, district, state, address_line')
      .eq('user_id', req.user.id)
      .single();

    if (!profile || !profile.phone || !profile.city || !profile.district || !profile.state || !profile.address_line) {
      return res.status(400).json({ 
        error: 'Please complete your profile before placing an order',
        profileIncomplete: true
      });
    }

    // Validate all products and check stock
    let totalAmount = 0;
    const productDetails = [];

    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid product or quantity' });
      }

      // Get product details
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, name, price, stock')
        .eq('id', product_id)
        .single();

      if (productError || !product) {
        return res.status(404).json({ error: `Product not found: ${product_id}` });
      }

      // Check stock
      if (product.stock < quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
        });
      }

      const itemTotal = product.price * quantity;
      totalAmount += itemTotal;

      productDetails.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: product.price,
        total_price: itemTotal,
        current_stock: product.stock
      });
    }

    // Create main order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([{
        user_id: req.user.id,
        product_id: productDetails[0].product_id, // First product for reference
        quantity: productDetails.reduce((sum, item) => sum + item.quantity, 0), // Total quantity
        amount: totalAmount,
        delivery_date,
        status: 'Pending'
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items for each product
    const orderItems = productDetails.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Update stock for each product
    for (const item of productDetails) {
      await supabaseAdmin
        .from('products')
        .update({ stock: item.current_stock - item.quantity })
        .eq('id', item.product_id);
    }

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        ...order,
        items: orderItems
      }
    });
  } catch (error) {
    console.error('Create cart order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Create new order (old single product method - keep for backward compatibility)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity, delivery_date } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({ error: 'Product and quantity are required' });
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('price, stock')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check stock
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Calculate amount
    const amount = product.price * quantity;

    // Create order
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        user_id: req.user.id,
        product_id,
        quantity,
        amount,
        delivery_date,
        status: 'Pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // Update product stock
    await supabase
      .from('products')
      .update({ stock: product.stock - quantity })
      .eq('id', product_id);

    res.status(201).json({
      message: 'Order placed successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status (admin only)
router.patch('/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Delete order (admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Get sales statistics (admin only)
router.get('/sales/stats', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // Get current month date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Get last month for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Total sales (all delivered orders)
    const { data: allOrders } = await supabase
      .from('orders')
      .select('amount')
      .eq('status', 'Delivered');

    const totalSales = allOrders?.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0) || 0;

    // This month's orders
    const { data: monthOrders } = await supabase
      .from('orders')
      .select('amount, created_at')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const ordersThisMonth = monthOrders?.length || 0;
    const monthSales = monthOrders?.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0) || 0;

    // Last month's orders for comparison
    const { data: lastMonthOrders } = await supabase
      .from('orders')
      .select('amount')
      .gte('created_at', lastMonthStart)
      .lte('created_at', lastMonthEnd);

    const lastMonthCount = lastMonthOrders?.length || 0;
    const lastMonthSales = lastMonthOrders?.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0) || 0;

    // Calculate changes (handle division by zero)
    let salesChange = 0;
    if (lastMonthSales > 0) {
      salesChange = ((monthSales - lastMonthSales) / lastMonthSales * 100).toFixed(1);
    } else if (monthSales > 0) {
      salesChange = 100; // New sales from zero
    }

    let ordersChange = 0;
    if (lastMonthCount > 0) {
      ordersChange = ((ordersThisMonth - lastMonthCount) / lastMonthCount * 100).toFixed(1);
    } else if (ordersThisMonth > 0) {
      ordersChange = 100;
    }

    // Average order value
    const avgOrderValue = ordersThisMonth > 0 ? Math.round(monthSales / ordersThisMonth) : 0;
    const lastAvgOrderValue = lastMonthCount > 0 ? (lastMonthSales / lastMonthCount) : 0;
    
    let avgChange = 0;
    if (lastAvgOrderValue > 0) {
      avgChange = ((avgOrderValue - lastAvgOrderValue) / lastAvgOrderValue * 100).toFixed(1);
    } else if (avgOrderValue > 0) {
      avgChange = 100;
    }

    // Conversion rate
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'client');

    const conversionRate = totalUsers > 0 ? ((ordersThisMonth / totalUsers) * 100).toFixed(1) : 0;
    
    // Calculate conversion change (compare to last month)
    const lastMonthConversionRate = totalUsers > 0 ? ((lastMonthCount / totalUsers) * 100) : 0;
    let conversionChange = 0;
    if (lastMonthConversionRate > 0) {
      conversionChange = ((conversionRate - lastMonthConversionRate) / lastMonthConversionRate * 100).toFixed(1);
    } else if (conversionRate > 0) {
      conversionChange = 100;
    }

    res.json({
      stats: {
        totalSales: Math.round(totalSales),
        salesChange: `${salesChange >= 0 ? '+' : ''}${salesChange}%`,
        ordersThisMonth,
        ordersChange: `${ordersChange >= 0 ? '+' : ''}${ordersChange}%`,
        avgOrderValue,
        avgChange: `${avgChange >= 0 ? '+' : ''}${avgChange}%`,
        conversionRate: `${conversionRate}%`,
        conversionChange: `${conversionChange >= 0 ? '+' : ''}${conversionChange}%`
      }
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

// Get monthly sales trend (admin only)
router.get('/sales/monthly-trend', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('amount, created_at')
      .order('created_at', { ascending: true });

    // Group by month
    const monthlyData = {};
    orders?.forEach(order => {
      const date = new Date(order.created_at);
      const monthKey = date.toLocaleString('default', { month: 'short' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += parseFloat(order.amount || 0);
    });

    // Get last 6 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const trendData = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (now.getMonth() - i + 12) % 12;
      const monthName = months[monthIndex];
      trendData.push({
        month: monthName,
        amount: Math.round(monthlyData[monthName] || 0)
      });
    }

    res.json({ trendData });
  } catch (error) {
    console.error('Get monthly trend error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
});

// Get top selling products (admin only)
router.get('/sales/top-products', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        quantity,
        product:products(id, name)
      `);

    // Group by product
    const productSales = {};
    orders?.forEach(order => {
      const productName = order.product?.name || 'Unknown';
      if (!productSales[productName]) {
        productSales[productName] = 0;
      }
      productSales[productName] += order.quantity || 0;
    });

    // Sort and get top 4
    const topProducts = Object.entries(productSales)
      .map(([name, sales]) => ({ name, sales }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 4);

    res.json({ topProducts });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// Get sales by category (admin only)
router.get('/sales/by-category', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        quantity,
        amount,
        product:products(category)
      `);

    // Group by category
    const categorySales = {};
    let totalSales = 0;

    orders?.forEach(order => {
      const category = order.product?.category || 'Other';
      const amount = parseFloat(order.amount || 0);
      
      if (!categorySales[category]) {
        categorySales[category] = 0;
      }
      categorySales[category] += amount;
      totalSales += amount;
    });

    // Calculate percentages
    const categories = Object.entries(categorySales).map(([name, amount]) => ({
      name,
      percentage: totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0
    }));

    res.json({ categories });
  } catch (error) {
    console.error('Get sales by category error:', error);
    res.status(500).json({ error: 'Failed to fetch sales by category' });
  }
});

module.exports = router;
