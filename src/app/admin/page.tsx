'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, LogOut, Search, Plus, Edit2, Trash2, 
  Check, X, RefreshCw, FileText, LayoutDashboard, 
  Package, ShoppingCart, Sun, Moon, Database, AlertCircle 
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders'>('dashboard');

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
  const [formError, setFormError] = useState('');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<Order | null>(null);

  // Stats State
  const [syncing, setSyncing] = useState(false);

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
    await Promise.all([fetchProducts(), fetchOrders()]);
    setSyncing(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
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
    <div className="dashboard-grid">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo-group" style={{ marginBottom: '32px' }}>
            <div className="logo-icon">
              <svg className="logo-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px', color: 'white' }}>
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
              <span className="logo-title" style={{ fontSize: '1.1rem' }}>Aasa<span className="gradient-text font-bold">MedChem</span></span>
              <p className="logo-subtitle" style={{ fontSize: '0.65rem' }}>Admin Control Center</p>
            </div>
          </div>

          <div className="user-profile-panel glass-panel">
            <div className="avatar-placeholder" style={{ background: 'linear-gradient(135deg, var(--danger) 0%, var(--warning) 100%)' }}>
              <Shield size={20} className="avatar-svg" />
            </div>
            <div className="user-info">
              <p className="user-name">{user?.name || 'Admin Officer'}</p>
              <span className="user-role-badge" style={{ color: 'var(--danger)' }}>Administrator</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Analytics & Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}
            >
              <Package size={18} />
              <span>Manage Products</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            >
              <ShoppingCart size={18} />
              <span>Incoming Orders</span>
            </button>
          </nav>
          
          {/* Graphical System Health Indicator */}
          <div className="sidebar-health-panel animate-fade-in">
            <div className="health-status-row">
              <span className="pulse-dot"></span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>System Node: Active</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span>Precision Math Link</span>
              <span>98.4%</span>
            </div>
            <div className="health-bar-container">
              <div className="health-bar-fill"></div>
            </div>
          </div>
        </div>

        <div className="sidebar-bottom">
          <button onClick={toggleTheme} className="theme-toggle-btn w-full" style={{ marginBottom: '12px' }}>
            {theme === 'light' ? (
              <>
                <Moon size={16} /> Dark mode
              </>
            ) : (
              <>
                <Sun size={16} /> Light mode
              </>
            )}
          </button>
          <button onClick={handleLogout} className="btn btn-secondary w-full" style={{ gap: '10px' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '2rem' }} className="gradient-text">
              {activeTab === 'dashboard' && 'Analytics Overview'}
              {activeTab === 'products' && 'Inventory Management'}
              {activeTab === 'orders' && 'Quotation Verification'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {activeTab === 'dashboard' && 'Live system telemetry, stock valuations, and billing graphics.'}
              {activeTab === 'products' && 'Create base reagents, customize conversion units, and adjust base rates.'}
              {activeTab === 'orders' && 'Verify conversions, examine prices audit log, and approve shipments.'}
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

              {/* Action buttons inside audit panel */}
              {selectedAuditOrder.status === 'pending' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button
                    onClick={() => {
                      handleUpdateOrderStatus(selectedAuditOrder.id, 'rejected');
                      setSelectedAuditOrder(null);
                    }}
                    className="btn btn-secondary btn-danger"
                    style={{ color: 'white', padding: '10px 18px' }}
                  >
                    Reject & Restore Stock
                  </button>
                  <button
                    onClick={() => {
                      handleUpdateOrderStatus(selectedAuditOrder.id, 'approved');
                      setSelectedAuditOrder(null);
                    }}
                    className="btn btn-primary"
                    style={{ padding: '10px 18px' }}
                  >
                    Approve Quotation
                  </button>
                </div>
              )}

              {selectedAuditOrder.status === 'approved' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button
                    onClick={() => {
                      handleUpdateOrderStatus(selectedAuditOrder.id, 'rejected');
                      setSelectedAuditOrder(null);
                    }}
                    className="btn btn-secondary btn-danger"
                    style={{ color: 'white', padding: '10px 18px' }}
                  >
                    Reject & Replenish Stock
                  </button>
                  <button
                    onClick={() => {
                      handleUpdateOrderStatus(selectedAuditOrder.id, 'completed');
                      setSelectedAuditOrder(null);
                    }}
                    className="btn btn-primary"
                    style={{ padding: '10px 18px' }}
                  >
                    Complete / Deliver Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
