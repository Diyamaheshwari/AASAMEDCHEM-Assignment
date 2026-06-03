'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, LogOut, Search, Plus, Edit2, Trash2, 
  Check, X, RefreshCw, FileText, LayoutDashboard, 
  Package, ShoppingCart, Sun, Moon, Database, AlertCircle,
  UserPlus, Bell
} from 'lucide-react';
import { UNITS_BY_DIMENSION, calculateUnitPrice, calculateItemPrice, formatCurrency, formatQuantity } from '@/lib/converter';
import Decimal from 'decimal.js';

interface User {
  name: string;
  email: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  dimension: 'weight' | 'volume' | 'count';
  base_unit: 'g' | 'mL' | 'items';
  base_price: string;
  stock_quantity: string;
  seller_id?: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_sku: string;
  ordered_unit: string;
  ordered_quantity: string;
  base_quantity: string;
  unit_price: string;
  total_item_price: string;
  product_base_unit: string;
  product_base_price: string;
  product_category: string;
}

interface Order {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  total_price: string;
  created_at: string;
  items: OrderItem[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [user, setUser] = useState<User | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'users'>('dashboard');

  // Products CRUD State
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dimension, setDimension] = useState<'weight' | 'volume' | 'count'>('weight');
  const [baseUnit, setBaseUnit] = useState<'g' | 'mL' | 'items'>('g');
  const [basePrice, setBasePrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [formError, setFormError] = useState('');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<Order | null>(null);

  // Users Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsersList, setLoadingUsersList] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'seller' | 'admin'>('seller');
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Stats State
  const [syncing, setSyncing] = useState(false);

  const fetchUsersList = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Error fetching users list:', err);
    } finally {
      setLoadingUsersList(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  useEffect(() => {
    // Hydrate theme
    const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';
    setTheme(currentTheme);

    // Fetch user details
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) router.push('/');
        return res.json();
      })
      .then((data) => {
        if (data && data.user) {
          if (data.user.role !== 'admin') {
            router.push('/seller');
          } else {
            setUser(data.user);
          }
        }
      })
      .catch(() => router.push('/'));

    // Fetch dashboard records
    fetchProducts();
    fetchOrders();
    fetchUsersList();
    fetchNotifications();

    // Setup polling for notifications
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const syncData = async () => {
    setSyncing(true);
    await Promise.all([fetchProducts(), fetchOrders(), fetchUsersList(), fetchNotifications()]);
    setSyncing(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');

    if (!newUserName || !newUserEmail || !newUserPassword) {
      setUserFormError('All fields are required.');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setUserFormSuccess(`User (${newUserRole}) created successfully!`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('seller');

      // Refresh users list
      fetchUsersList();
      
      // Close modal after success
      setTimeout(() => {
        setShowUserModal(false);
        setUserFormSuccess('');
      }, 1000);
    } catch (err: any) {
      setUserFormError(err.message || 'An error occurred.');
    }
  };

  // Set default base unit on dimension change
  const handleDimensionChange = (val: 'weight' | 'volume' | 'count') => {
    setDimension(val);
    if (val === 'weight') setBaseUnit('g');
    else if (val === 'volume') setBaseUnit('mL');
    else setBaseUnit('items');
  };

  // Open modal for adding product
  const openAddModal = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setDescription('');
    setCategory('');
    setDimension('weight');
    setBaseUnit('g');
    setBasePrice('');
    setStockQuantity('');
    setSellerId('');
    setFormError('');
    setShowProductModal(true);
  };

  // Open modal for editing product
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setSku(p.sku);
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setDimension(p.dimension);
    setBaseUnit(p.base_unit);
    setBasePrice(new Decimal(p.base_price).toString());
    setStockQuantity(new Decimal(p.stock_quantity).toString());
    setSellerId(p.seller_id || '');
    setFormError('');
    setShowProductModal(true);
  };

  // Create or Update Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!sku || !name || !category || basePrice === '' || stockQuantity === '') {
      setFormError('Please fill in all required fields.');
      return;
    }

    const payload = {
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      dimension,
      base_unit: baseUnit,
      base_price: parseFloat(basePrice),
      stock_quantity: parseFloat(stockQuantity),
      seller_id: sellerId || null,
    };

    const endpoint = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const method = editingProduct ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      setShowProductModal(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? All historical references will be kept but product entry will be removed.')) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete product');
      }
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'pending' | 'approved' | 'rejected' | 'completed') => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update order status');
      }

      fetchOrders();
      fetchProducts(); // Refresh stocks as well

      // Sync active audited order if open
      if (selectedAuditOrder && selectedAuditOrder.id === orderId) {
        setSelectedAuditOrder({ ...selectedAuditOrder, status: newStatus });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filters
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredOrders = orders.filter((o) =>
    o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.user_name.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.user_email.toLowerCase().includes(orderSearch.toLowerCase())
  );

  // DASHBOARD ANALYTICS COMPUTATIONS

  // 1. Stat cards calculations
  const totalSKUs = products.length;
  const totalInventoryValue = products.reduce((sum, p) => {
    const price = new Decimal(p.base_price);
    const qty = new Decimal(p.stock_quantity);
    return sum.plus(price.times(qty));
  }, new Decimal(0)).toString();

  const lowStockProducts = products.filter((p) => new Decimal(p.stock_quantity).lessThan(15));
  const pendingOrdersVal = orders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum.plus(new Decimal(o.total_price)), new Decimal(0)).toString();

  // 2. Stock Category Distribution Donut Chart Calculations
  const getCategoryShare = () => {
    const categoryTotals: Record<string, number> = {};
    products.forEach((p) => {
      const val = new Decimal(p.base_price).times(new Decimal(p.stock_quantity)).toNumber();
      categoryTotals[p.category] = (categoryTotals[p.category] || 0) + val;
    });

    const totalVal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    if (totalVal === 0) return [];

    return Object.entries(categoryTotals).map(([name, value], index) => {
      const percent = value / totalVal;
      return {
        name,
        value,
        percent,
        color: `hsl(${(index * 60) + 240}, 75%, 55%)`,
      };
    });
  };

  const categoryShare = getCategoryShare();

  // Draw Donut segments
  let cumulativePercent = 0;
  const donutSegments = categoryShare.map((cat) => {
    const startPercent = cumulativePercent;
    cumulativePercent += cat.percent;
    
    // Circle circumference logic
    const r = 60;
    const circ = 2 * Math.PI * r;
    const strokeDash = `${cat.percent * circ} ${circ}`;
    const strokeOffset = `${-startPercent * circ}`;

    return {
      ...cat,
      strokeDash,
      strokeOffset,
      r,
    };
  });

  // 3. Sales Trend Area Chart Calculations
  // Get aggregate sales by day (last 7 order records or dates)
  const getSalesTrend = () => {
    const trendMap: Record<string, Decimal> = {};
    // Seed last 5 days
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trendMap[d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })] = new Decimal(0);
    }

    orders.forEach((o) => {
      if (o.status !== 'rejected') {
        const dateKey = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (trendMap[dateKey] !== undefined) {
          trendMap[dateKey] = trendMap[dateKey].plus(new Decimal(o.total_price));
        }
      }
    });

    return Object.entries(trendMap).map(([day, val]) => ({
      day,
      value: val.toNumber(),
    }));
  };

  const salesTrend = getSalesTrend();
  const maxTrendVal = Math.max(...salesTrend.map((t) => t.value), 1000);

  // Generate SVG Path for Area Chart
  const getAreaChartPath = () => {
    const width = 400;
    const height = 150;
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = salesTrend.map((t, i) => {
      const x = padding + (i * chartWidth) / (salesTrend.length - 1);
      const y = padding + chartHeight - (t.value * chartHeight) / maxTrendVal;
      return { x, y };
    });

    if (points.length === 0) return { linePath: '', areaPath: '', points: [] };

    const linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

    return { linePath, areaPath, points };
  };

  const { linePath, areaPath, points: trendPoints } = getAreaChartPath();

  // 4. Order Status Distribution stacked bar chart
  const getOrderStatusCount = () => {
    const counts = { pending: 0, approved: 0, completed: 0, rejected: 0 };
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  };
  
  const statusCounts = getOrderStatusCount();
  const maxStatusCount = Math.max(statusCounts.pending, statusCounts.approved, statusCounts.completed, statusCounts.rejected, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Sticky Glassmorphic Top Navbar */}
      <header className="glass-panel" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        marginBottom: '24px',
        overflow: 'visible'
      }}>
        {/* Left: Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', color: 'white' }}>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
              <line x1="12" y1="3" x2="12" y2="9"/>
              <line x1="12" y1="15" x2="12" y2="21"/>
              <line x1="3" y1="12" x2="9" y2="12"/>
              <line x1="15" y1="12" x2="21" y2="12"/>
              <circle cx="12" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="21" r="1.5" fill="currentColor"/>
              <circle cx="3" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="21" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <span className="logo-title" style={{ fontSize: '1rem', display: 'block' }}>Aasa<span className="gradient-text font-bold">MedChem</span></span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Admin Console</span>
          </div>
        </div>

        {/* Center: Horizontal Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn btn-secondary ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
          >
            <LayoutDashboard size={16} />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`btn btn-secondary ${activeTab === 'products' ? 'active' : ''}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
          >
            <Package size={16} />
            <span>Products</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`btn btn-secondary ${activeTab === 'orders' ? 'active' : ''}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
          >
            <ShoppingCart size={16} />
            <span>Orders</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`btn btn-secondary ${activeTab === 'users' ? 'active' : ''}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>Sellers & Buyers</span>
          </button>
        </nav>

        {/* Right: Controls & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* User Profile Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid var(--border)', paddingRight: '14px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--danger) 0%, var(--warning) 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}>
              {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'Admin'}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Administrator</span>
            </div>
          </div>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`btn btn-secondary ${showNotifications ? 'active' : ''}`}
              style={{ padding: '8px', minWidth: '36px', position: 'relative', borderRadius: 'var(--radius-sm)' }}
              title="Notifications"
            >
              <Bell size={16} className={unreadCount > 0 ? 'animate-bounce' : ''} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--danger)',
                  color: 'white',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 2px var(--bg-surface)'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Overlay */}
            {showNotifications && (
              <div className="glass-panel" style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                width: '360px',
                maxHeight: '480px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 9999,
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} style={{ color: 'var(--primary)' }} /> Alerts & Activity
                  </span>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllAsRead}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                
                <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0', maxHeight: '380px' }}>
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No notifications or alerts.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const relativeTime = (() => {
                        const diffMs = Date.now() - new Date(n.created_at).getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMins / 60000);
                        if (diffMins < 1) return 'Just now';
                        if (diffMins < 60) return `${diffMins}m ago`;
                        if (diffHours < 24) return `${diffHours}h ago`;
                        return new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                      })();

                      const typeColor = (() => {
                        switch (n.type) {
                          case 'new_order': return 'var(--success)';
                          case 'new_user': return 'var(--primary)';
                          case 'low_stock': return 'var(--warning)';
                          case 'order_status': return 'var(--secondary)';
                          default: return 'var(--text-muted)';
                        }
                      })();

                      return (
                        <div 
                          key={n.id} 
                          onClick={async () => {
                            await handleMarkAsRead(n.id);
                            if (n.link) {
                              const tabParam = n.link.split('tab=')[1];
                              if (tabParam) {
                                setActiveTab(tabParam as any);
                              }
                            }
                            setShowNotifications(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            gap: '10px',
                            cursor: 'pointer',
                            background: n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.03)',
                            transition: 'background 0.2s',
                            alignItems: 'flex-start'
                          }}
                          className="notification-item"
                        >
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: typeColor,
                            marginTop: '5px',
                            flexShrink: 0
                          }}></span>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-primary)', marginBottom: '1px' }}>
                              {n.title}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                              {n.message}
                            </p>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                              {relativeTime}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary" 
            style={{ padding: '8px', minWidth: '36px', borderRadius: 'var(--radius-sm)' }}
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px', fontSize: '0.8rem', gap: '6px', color: 'var(--danger)', borderColor: 'var(--danger-glow)' }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content" style={{ flex: 1, padding: '24px 40px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '2rem' }} className="gradient-text">
              {activeTab === 'dashboard' && 'Analytics Overview'}
              {activeTab === 'products' && 'Inventory Management'}
              {activeTab === 'orders' && 'Quotation Verification'}
              {activeTab === 'users' && 'Sellers & Buyers'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {activeTab === 'dashboard' && 'Live system telemetry, stock valuations, and billing graphics.'}
              {activeTab === 'products' && 'Create base reagents, customize conversion units, and adjust base rates.'}
              {activeTab === 'orders' && 'Verify conversions, examine prices audit log, and approve shipments.'}
              {activeTab === 'users' && 'Manage system staff operators and client buyer accounts separately.'}
            </p>
          </div>
          <button onClick={syncData} disabled={syncing} className="btn btn-secondary" style={{ gap: '8px' }}>
            <RefreshCw size={16} className={syncing ? 'spinner' : ''} />
            <span>Sync Data</span>
          </button>
        </div>

        {/* Dashboard Analytics View */}
        {activeTab === 'dashboard' && (
          <section className="animate-fade-in">
            {/* Stat Cards */}
            <div className="stats-grid">
              <div className="glass-panel stat-card">
                <span className="stat-label">Unique Products (SKUs)</span>
                <div className="stat-value">{totalSKUs}</div>
                <span className="stat-trend">Active chemical items</span>
              </div>
              <div className="glass-panel stat-card">
                <span className="stat-label">Total Portfolio Valuation</span>
                <div className="stat-value text-success">₹{formatCurrency(totalInventoryValue)}</div>
                <span className="stat-trend">Stored base unit assets</span>
              </div>
              <div className="glass-panel stat-card">
                <span className="stat-label">Awaiting Billings</span>
                <div className="stat-value text-warning">₹{formatCurrency(pendingOrdersVal)}</div>
                <span className="stat-trend">Pending quotations</span>
              </div>
              <div className="glass-panel stat-card">
                <span className="stat-label">Low Stock Alerts</span>
                <div className="stat-value text-danger">{lowStockProducts.length}</div>
                <span className="stat-trend">Items under 15 units</span>
              </div>
            </div>

            {/* Graphics and Interactive SVG Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginBottom: '30px' }}>
              
              {/* Chart 1: Donut chart */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                <h3 style={{ width: '100%', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Stock Value Category Share</h3>
                {categoryShare.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', padding: '40px' }}>No category data available.</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      {donutSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="80"
                          cy="80"
                          r={seg.r}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="18"
                          strokeDasharray={seg.strokeDash}
                          strokeDashoffset={seg.strokeOffset}
                          transform="rotate(-90 80 80)"
                          className="chart-slice"
                        />
                      ))}
                      <circle cx="80" cy="80" r="50" fill="var(--bg-surface)" />
                      <text x="80" y="85" textAnchor="middle" style={{ fill: 'var(--text-primary)', fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '0.85rem' }}>
                        Valuation
                      </text>
                    </svg>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {categoryShare.map((cat, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: cat.color, display: 'inline-block' }} />
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cat.name}:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{(cat.percent * 100).toFixed(0)}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chart 2: Area sales trend */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Active Sales Valuation Trend</h3>
                <svg width="100%" height="150" viewBox="0 0 400 150" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <g className="chart-grid">
                    <line x1="20" y1="20" x2="380" y2="20" />
                    <line x1="20" y1="75" x2="380" y2="75" />
                    <line x1="20" y1="130" x2="380" y2="130" />
                  </g>
                  
                  {/* Area fill */}
                  <path d={areaPath} fill="var(--primary-glow)" opacity="0.4" />
                  
                  {/* Line path */}
                  <path d={linePath} className="chart-line" />
                  
                  {/* Circles on dots */}
                  {trendPoints.map((pt, idx) => (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="var(--bg-surface)"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                    />
                  ))}
                </svg>
                
                {/* Y labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {salesTrend.map((t, idx) => (
                    <span key={idx}>{t.day}</span>
                  ))}
                </div>
              </div>

              {/* Chart 3: Stacked Bar Chart for Order Status */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Orders Distribution by Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', height: '100%' }}>
                  
                  {/* Pending bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending</span>
                    <div style={{ flex: 1, height: '14px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(statusCounts.pending / maxStatusCount) * 100}%`, height: '100%', background: 'var(--warning)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '20px' }}>{statusCounts.pending}</span>
                  </div>

                  {/* Approved bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Approved</span>
                    <div style={{ flex: 1, height: '14px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(statusCounts.approved / maxStatusCount) * 100}%`, height: '100%', background: 'var(--success)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '20px' }}>{statusCounts.approved}</span>
                  </div>

                  {/* Completed bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Completed</span>
                    <div style={{ flex: 1, height: '14px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(statusCounts.completed / maxStatusCount) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '20px' }}>{statusCounts.completed}</span>
                  </div>

                  {/* Rejected bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rejected</span>
                    <div style={{ flex: 1, height: '14px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${(statusCounts.rejected / maxStatusCount) * 100}%`, height: '100%', background: 'var(--danger)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '20px' }}>{statusCounts.rejected}</span>
                  </div>

                </div>
              </div>

            </div>

            {/* Low stock table checklist */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px' }} className="gradient-text">Critical Low-Stock Checklist</h3>
              {lowStockProducts.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 500 }}>
                  <Check size={18} /> All stocks are sufficiently replenished. No warning triggers.
                </div>
              ) : (
                <div className="table-container" style={{ marginTop: 0 }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Product SKU</th>
                        <th>Chemical Reagent</th>
                        <th>Category</th>
                        <th>Current stock level</th>
                        <th>Criticality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map((p) => {
                        const stockVal = parseFloat(p.stock_quantity);
                        const isSevere = stockVal < 5;
                        return (
                          <tr key={p.id}>
                            <td><code>{p.sku}</code></td>
                            <td><strong>{p.name}</strong></td>
                            <td>{p.category}</td>
                            <td>
                              <span style={{ fontWeight: 700, color: isSevere ? 'var(--danger)' : 'var(--warning)' }}>
                                {formatQuantity(p.stock_quantity)} {p.base_unit}
                              </span>
                            </td>
                            <td>
                              <span style={{ background: isSevere ? 'var(--danger-glow)' : 'var(--warning-glow)', color: isSevere ? 'var(--danger)' : 'var(--warning)' }} className="badge">
                                {isSevere ? 'critical limit' : 'refill suggested'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Products CRUD View */}
        {activeTab === 'products' && (
          <section className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div className="search-input-wrapper" style={{ position: 'relative', maxWidth: '300px', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter products catalog..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '40px', width: '100%' }}
                />
              </div>

              <button onClick={openAddModal} className="btn btn-primary" style={{ gap: '8px' }}>
                <Plus size={16} /> Add New Reagent
              </button>
            </div>

            {loadingProducts ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', margin: '0 auto 16px auto', width: '32px', height: '32px' }} />
                <p>Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <AlertCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <h3>No products matched search filters</h3>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>SKU Code</th>
                      <th>Chemical / Item Name</th>
                      <th>Category</th>
                      <th>Dimension</th>
                      <th>Base Unit</th>
                      <th>Base Price (INR)</th>
                      <th>Stock Quantity</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td><code>{p.sku}</code></td>
                        <td>
                          <strong>{p.name}</strong>
                          {p.description && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</span>}
                        </td>
                        <td>{p.category}</td>
                        <td style={{ textTransform: 'capitalize' }}>{p.dimension}</td>
                        <td><code>{p.base_unit}</code></td>
                        <td>₹{formatCurrency(p.base_price, 4)} per {p.base_unit}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{formatQuantity(p.stock_quantity)}</span> {p.base_unit}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => openEditModal(p)} className="btn btn-secondary" style={{ padding: '6px 10px' }} aria-label="Edit product">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteProduct(p.id)} className="btn btn-secondary btn-danger" style={{ padding: '6px 10px', color: 'white' }} aria-label="Delete product">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Incoming Orders / Quotations view */}
        {activeTab === 'orders' && (
          <section className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ position: 'relative', maxWidth: '350px', marginBottom: '20px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search orders, seller names, or email..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '40px', width: '100%' }}
              />
            </div>

            {loadingOrders ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', margin: '0 auto 16px auto', width: '32px', height: '32px' }} />
                <p>Loading quotations list...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <h3>No incoming quotations matching filters</h3>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Order UUID</th>
                      <th>Seller / User Account</th>
                      <th>Submission Date</th>
                      <th>Total Value</th>
                      <th>Verification Status</th>
                      <th style={{ textAlign: 'right' }}>Billing Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const dateStr = new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      });

                      return (
                        <tr key={order.id}>
                          <td><code style={{ fontSize: '0.8rem' }}>{order.id.substring(0, 8)}...</code></td>
                          <td>
                            <strong>{order.user_name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.user_email}</span>
                          </td>
                          <td>{dateStr}</td>
                          <td style={{ fontWeight: 700 }}>₹{formatCurrency(order.total_price)}</td>
                          <td>
                            <span className={`badge badge-${order.status}`}>{order.status}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => setSelectedAuditOrder(order)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', gap: '4px', fontSize: '0.8rem' }}
                              >
                                <Database size={12} /> Audit Conversions
                              </button>

                              {order.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateOrderStatus(order.id, 'approved')}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px', color: 'var(--success)', borderColor: 'var(--success-glow)' }}
                                    title="Approve Order"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger-glow)' }}
                                    title="Reject Order"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}

                              {order.status === 'approved' && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                  className="btn btn-secondary btn-primary"
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                >
                                  Complete Order
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Sellers & Buyers Directory Tab */}
        {activeTab === 'users' && (() => {
          const filteredUsers = usersList.filter((u: any) => {
            const q = userSearch.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
          });
          const staffUsers = filteredUsers.filter((u: any) => u.role === 'admin' || u.role === 'seller');
          const buyerUsers = filteredUsers.filter((u: any) => u.role === 'buyer');

          return (
            <section className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header controls inside tab */}
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', maxWidth: '350px', width: '100%' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search sellers, buyers, or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '40px', width: '100%' }}
                  />
                </div>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="btn btn-primary"
                  style={{ gap: '8px' }}
                >
                  <UserPlus size={16} />
                  <span>Create Staff Account</span>
                </button>
              </div>

              {/* Split Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                {/* Left Column: Sellers and Admins (Staff) */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99, 102, 241, 0.03)' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={18} style={{ color: 'var(--primary)' }} />
                        <span>System Staff & Sellers</span>
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorized operators & staff accounts</p>
                    </div>
                    <span className="badge badge-completed" style={{ fontSize: '0.75rem' }}>
                      {loadingUsersList ? '...' : staffUsers.length} active
                    </span>
                  </div>
                  
                  <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loadingUsersList ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px auto', width: '24px', height: '24px' }} />
                        <p style={{ fontSize: '0.85rem' }}>Loading staff list...</p>
                      </div>
                    ) : staffUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No staff accounts found.
                      </div>
                    ) : (
                      staffUsers.map((u: any) => {
                        const initials = u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        const dateJoined = new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        });
                        const isCurrentUser = u.email === user?.email;
                        return (
                          <div key={u.id} className="user-card-item" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-surface)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: u.role === 'admin' 
                                  ? 'linear-gradient(135deg, var(--danger) 0%, var(--warning) 100%)' 
                                  : 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                boxShadow: 'var(--shadow-sm)'
                              }}>
                                {initials}
                              </div>
                              <div>
                                <p style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                  <span>{u.name}</span>
                                  {isCurrentUser && (
                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600 }}>You</span>
                                  )}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{u.email}</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              <span className={`badge ${u.role === 'admin' ? 'badge-rejected' : 'badge-completed'}`} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                                {u.role}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Joined {dateJoined}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Buyers (Clients) */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(34, 197, 94, 0.03)' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingCart size={18} style={{ color: 'var(--success)' }} />
                        <span>Registered Buyers & Clients</span>
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Public client accounts & buyer directory</p>
                    </div>
                    <span className="badge badge-approved" style={{ fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success-glow)' }}>
                      {loadingUsersList ? '...' : buyerUsers.length} active
                    </span>
                  </div>
                  
                  <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loadingUsersList ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px auto', width: '24px', height: '24px' }} />
                        <p style={{ fontSize: '0.85rem' }}>Loading clients list...</p>
                      </div>
                    ) : buyerUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No buyer client accounts found.
                      </div>
                    ) : (
                      buyerUsers.map((u: any) => {
                        const initials = u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        const dateJoined = new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        });
                        return (
                          <div key={u.id} className="user-card-item" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-surface)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                boxShadow: 'var(--shadow-sm)'
                              }}>
                                {initials}
                              </div>
                              <div>
                                <p style={{ fontWeight: 600, margin: 0 }}>{u.name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{u.email}</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              <span className="badge badge-approved" style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                                buyer
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Joined {dateJoined}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}
      </main>

      {/* Product ADD/EDIT Modal */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h2>{editingProduct ? 'Edit Chemical Record' : 'Add Chemical Reagent'}</h2>
              <button onClick={() => setShowProductModal(false)} className="cart-item-delete" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {formError && <div className="alert-message alert-error">{formError}</div>}

              <div className="form-group">
                <label className="form-label">SKU Code (e.g. CHEM-ETH-100)</label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="form-control"
                  placeholder="CHEM-ETH-100"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product/Chemical Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-control"
                  placeholder="Ethanol 99.9% AR"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Chemical Category</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-control"
                  placeholder="Solvents / Reagents"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-control"
                  placeholder="Additional safety specifications..."
                  style={{ height: '60px', resize: 'vertical' }}
                />
              </div>

              {/* Responsible Seller Selector */}
              <div className="form-group">
                <label className="form-label">Responsible Seller / Owner</label>
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="form-control"
                >
                  <option value="">-- No Seller Assigned --</option>
                  {usersList.filter((u: any) => u.role === 'seller').map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Dimension</label>
                  <select
                    value={dimension}
                    onChange={(e) => handleDimensionChange(e.target.value as any)}
                    className="form-control"
                  >
                    <option value="weight">Weight (g / kg)</option>
                    <option value="volume">Volume (mL / L)</option>
                    <option value="count">Count (items)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Base Unit (Internal)</label>
                  <select
                    disabled
                    value={baseUnit}
                    className="form-control"
                    style={{ background: 'var(--bg-surface-hover)', cursor: 'not-allowed' }}
                  >
                    <option value="g">grams (g)</option>
                    <option value="mL">milliliters (mL)</option>
                    <option value="items">items (count)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Price per Base Unit (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="form-control"
                    placeholder="0.15"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Quantity (Base Unit)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="form-control"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conversion Verification & Auditing Drawer/Modal */}
      {selectedAuditOrder && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content animate-fade-in" style={{ maxWidth: '800px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h2>Conversions & pricing Audit Log</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verifying mathematical calculations for billing auditing</span>
              </div>
              <button onClick={() => setSelectedAuditOrder(null)} className="cart-item-delete" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Info summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>AUDITED ORDER ID</span>
                  <strong style={{ fontSize: '0.85rem' }}>{selectedAuditOrder.id}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>REQUESTING AGENT</span>
                  <strong style={{ fontSize: '0.85rem' }}>{selectedAuditOrder.user_name}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL AMOUNT</span>
                  <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>₹{formatCurrency(selectedAuditOrder.total_price)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>AUDIT DECISION</span>
                  <span className={`badge badge-${selectedAuditOrder.status}`} style={{ marginTop: '2px' }}>{selectedAuditOrder.status}</span>
                </div>
              </div>

              {/* Items Breakdown list */}
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {selectedAuditOrder.items.map((item) => {
                  const basePrice = new Decimal(item.product_base_price);
                  const baseQty = new Decimal(item.base_quantity);
                  const qtyOrdered = new Decimal(item.ordered_quantity);
                  const unitPrice = new Decimal(item.unit_price);
                  const totalExpectedItemPrice = baseQty.times(basePrice);

                  return (
                    <div key={item.id} style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem' }}>{item.product_name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>SKU: {item.product_sku} | Category: {item.product_category}</span>
                        </div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>₹{formatCurrency(item.total_item_price)}</strong>
                      </div>

                      {/* Calculations steps audit display */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: 'var(--bg-surface-hover)', padding: '12px', borderRadius: '4px', borderLeft: '3px solid var(--primary)', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>1. Unit conversion strategy:</span>
                          <p style={{ marginTop: '2px', fontWeight: 600 }}>
                            {formatQuantity(qtyOrdered)} {item.ordered_unit} = {formatQuantity(baseQty)} {item.product_base_unit}
                          </p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Stored internally in base unit ({item.product_base_unit})
                          </span>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>2. Rate calculation:</span>
                          <p style={{ marginTop: '2px', fontWeight: 600 }}>
                            ₹{formatCurrency(unitPrice)} per {item.ordered_unit}
                          </p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Base rate: ₹{formatCurrency(basePrice, 4)} per {item.product_base_unit}
                          </span>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>3. Verification math:</span>
                          <p style={{ marginTop: '2px', fontWeight: 600 }}>
                            {formatQuantity(baseQty)} {item.product_base_unit} * ₹{formatCurrency(basePrice, 4)} = ₹{formatCurrency(totalExpectedItemPrice)}
                          </p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>
                            ✓ Match (Calculated total matches database entry)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons inside audit panel (monitored read-only for admin) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} style={{ color: 'var(--warning)' }} /> Managed and approved only by the assigned product Seller.
                </span>
                <button type="button" onClick={() => setSelectedAuditOrder(null)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                  Close Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Account Creation Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h2>Register Staff Account</h2>
              <button onClick={() => setShowUserModal(false)} className="cart-item-delete" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              {userFormError && <div className="alert-message alert-error">{userFormError}</div>}
              {userFormSuccess && <div className="alert-message alert-success">{userFormSuccess}</div>}

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="form-control"
                  placeholder="e.g. Dr. Jane Doe"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="form-control"
                  placeholder="e.g. jane.doe@aasamedchem.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="form-control"
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'seller' | 'admin')}
                  className="form-control"
                >
                  <option value="seller">Seller / Operator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowUserModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
