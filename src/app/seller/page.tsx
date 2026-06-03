'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, LogOut, Search, Filter, RefreshCw, 
  Trash2, Send, CheckCircle, Clock, AlertTriangle, 
  XCircle, Award, BarChart3, Sun, Moon, Database, ChevronRight 
} from 'lucide-react';
import { UNIT_DIMENSIONS, UNITS_BY_DIMENSION, calculateUnitPrice, calculateItemPrice, convertToBase, formatCurrency, formatQuantity } from '@/lib/converter';
import Decimal from 'decimal.js';

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

interface CartItem {
  product: Product;
  quantity: string;
  unit: string;
  unitPrice: string; // Calculated unit price for the chosen unit
  totalPrice: string; // Calculated total price for this item
  baseQuantity: string; // Quantity in base unit
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
}

interface Order {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  total_price: string;
  created_at: string;
  items: OrderItem[];
}

export default function SellerDashboard() {
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  
  // Products Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [calculatorInput, setCalculatorInput] = useState<Record<string, { qty: string; unit: string }>>({});

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  // Transaction States
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState('');
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    // Hydrate theme
    const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';
    setTheme(currentTheme);

    // Fetch Session User
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/');
        } else {
          return res.json();
        }
      })
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/'));

    // Fetch initial data
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
        const data: Product[] = await res.json();
        setProducts(data);
        
        // Extract unique categories
        const cats = Array.from(new Set(data.map((p) => p.category)));
        setCategories(['All', ...cats]);

        // Initialize calculator inputs
        const initialCalc: Record<string, { qty: string; unit: string }> = {};
        data.forEach((p) => {
          initialCalc[p.id] = {
            qty: '1',
            unit: UNITS_BY_DIMENSION[p.dimension][0] || p.base_unit,
          };
        });
        setCalculatorInput(initialCalc);
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  // Calculator helper to get dynamic values for UI
  const getLiveCalculation = (product: Product) => {
    const input = calculatorInput[product.id];
    if (!input || !input.qty || isNaN(Number(input.qty)) || Number(input.qty) <= 0) {
      return {
        baseQty: '0',
        unitPrice: '0.00',
        totalPrice: '0.00',
        isValid: false,
      };
    }

    try {
      const basePrice = new Decimal(product.base_price);
      const qty = new Decimal(input.qty);
      const unit = input.unit;

      const baseQty = convertToBase(qty, unit);
      const unitPrice = calculateUnitPrice(basePrice, unit);
      const totalPrice = calculateItemPrice(basePrice, qty, unit);

      return {
        baseQty: baseQty.toString(),
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
        isValid: true,
      };
    } catch {
      return {
        baseQty: '0',
        unitPrice: '0.00',
        totalPrice: '0.00',
        isValid: false,
      };
    }
  };

  const handleCalculatorChange = (productId: string, field: 'qty' | 'unit', value: string) => {
    setCalculatorInput((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  // Cart Operations
  const addToCart = (product: Product) => {
    const input = calculatorInput[product.id];
    const calc = getLiveCalculation(product);

    if (!calc.isValid) return;

    // Check if stock is available
    const baseQtyDecimal = new Decimal(calc.baseQty);
    const stockDecimal = new Decimal(product.stock_quantity);

    // Calculate total requested quantity in cart already for this product
    const existingCartItem = cart.find((item) => item.product.id === product.id);
    const existingBaseQty = existingCartItem ? new Decimal(existingCartItem.baseQuantity) : new Decimal(0);
    const totalNeededBaseQty = baseQtyDecimal.plus(existingBaseQty);

    if (stockDecimal.lessThan(totalNeededBaseQty)) {
      alert(`Insufficient stock. Total requested including cart: ${totalNeededBaseQty.toString()} ${product.base_unit}, Available: ${product.stock_quantity} ${product.base_unit}`);
      return;
    }

    if (existingCartItem) {
      // Update existing item
      setCart((prev) =>
        prev.map((item) => {
          if (item.product.id === product.id) {
            const newQty = new Decimal(item.quantity).plus(new Decimal(input.qty));
            const newCalc = getLiveCalculation(product); // re-calc for safety
            return {
              ...item,
              quantity: newQty.toString(),
              baseQuantity: totalNeededBaseQty.toString(),
              totalPrice: new Decimal(item.totalPrice).plus(new Decimal(calc.totalPrice)).toString(),
            };
          }
          return item;
        })
      );
    } else {
      // Add new item
      setCart((prev) => [
        ...prev,
        {
          product,
          quantity: input.qty,
          unit: input.unit,
          unitPrice: calc.unitPrice,
          totalPrice: calc.totalPrice,
          baseQuantity: calc.baseQty,
        },
      ]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum.plus(new Decimal(item.totalPrice)), new Decimal(0)).toString();
  };

  // Submit Quote / Place Order
  const submitQuotation = async () => {
    if (cart.length === 0) return;
    setSubmittingOrder(true);
    setOrderError('');
    setOrderSuccess('');

    const payload = {
      items: cart.map((item) => ({
        productId: item.product.id,
        orderedQuantity: item.quantity,
        orderedUnit: item.unit,
      })),
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      setOrderSuccess(`Quotation placed successfully! Order ID: ${data.orderId.substring(0, 8)}...`);
      clearCart();
      
      // Refresh products and orders
      fetchProducts();
      fetchOrders();
      
      // Shift to history tab
      setTimeout(() => {
        setActiveTab('history');
      }, 1500);
    } catch (err: any) {
      setOrderError(err.message || 'An error occurred while submitting quotation');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Filtering Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Seller Dashboard Analytics/Stats helpers
  const getOrderStats = () => {
    const total = orders.length;
    const pendingVal = orders
      .filter((o) => o.status === 'pending')
      .reduce((sum, o) => sum.plus(new Decimal(o.total_price)), new Decimal(0));
    const approvedVal = orders
      .filter((o) => o.status === 'approved' || o.status === 'completed')
      .reduce((sum, o) => sum.plus(new Decimal(o.total_price)), new Decimal(0));
    const completedCount = orders.filter((o) => o.status === 'completed').length;
    const successRate = total > 0 ? (completedCount / total) * 100 : 0;
    
    return {
      total,
      pendingVal: pendingVal.toString(),
      approvedVal: approvedVal.toString(),
      successRate: successRate.toFixed(1),
    };
  };

  const stats = getOrderStats();

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
              <p className="logo-subtitle" style={{ fontSize: '0.65rem' }}>Seller Workspace</p>
            </div>
          </div>

          <div className="user-profile-panel glass-panel">
            <div className="avatar-placeholder">
              <Award size={20} className="avatar-svg" />
            </div>
            <div className="user-info">
              <p className="user-name">{user?.name || 'Seller Agent'}</p>
              <span className="user-role-badge">Seller Account</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
            >
              <ShoppingBag size={18} />
              <span>Product Catalog</span>
              <ChevronRight size={14} className="nav-arrow" />
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            >
              <Clock size={18} />
              <span>Quotation History</span>
              <ChevronRight size={14} className="nav-arrow" />
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
        {/* Top Header stats */}
        <section className="dashboard-header-stats">
          <div className="stats-grid">
            <div className="glass-panel stat-card">
              <span className="stat-label">Total Quotations Placed</span>
              <div className="stat-value">{stats.total}</div>
              <span className="stat-trend">Quotes recorded</span>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Pending Value</span>
              <div className="stat-value text-warning">₹{formatCurrency(stats.pendingVal)}</div>
              <span className="stat-trend">Awaiting approval</span>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Approved Value</span>
              <div className="stat-value text-success">₹{formatCurrency(stats.approvedVal)}</div>
              <span className="stat-trend">Invoiced sales</span>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Complete Rate</span>
              <div className="stat-value text-primary">{stats.successRate}%</div>
              <span className="stat-trend">Order fulfilment</span>
            </div>
          </div>
        </section>

        {activeTab === 'catalog' ? (
          /* Tab 1: Catalog & Checkout Order Flow */
          <div className="workspace-layout">
            <div className="workspace-main">
              {/* Filter controls */}
              <div className="glass-panel search-filter-bar" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-input-wrapper" style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={18} className="search-icon-svg" style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search by name, SKU, descriptions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '40px', width: '100%' }}
                  />
                </div>

                <div className="category-filter-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="form-control"
                    style={{ padding: '8px 12px' }}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Products list grid */}
              <div className="products-grid-catalog">
                {loadingProducts ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
                    <div className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', margin: '0 auto 16px auto', width: '32px', height: '32px' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading catalog...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }} className="glass-panel">
                    <AlertTriangle size={32} style={{ color: 'var(--warning)', marginBottom: '12px' }} />
                    <h3>No products found</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Try adjusting your search filters or keyword.</p>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const calc = getLiveCalculation(p);
                    const calcInput = calculatorInput[p.id] || { qty: '1', unit: p.base_unit };
                    const availableStock = formatQuantity(p.stock_quantity);

                    return (
                      <div key={p.id} className="glass-panel product-card card-3d">
                        <div className="card-3d-inner">
                          <div className="product-card-header">
                            <span className="product-category-tag">{p.category}</span>
                            <span className="product-sku-tag">{p.sku}</span>
                          </div>

                          <h3 className="product-name-title">{p.name}</h3>
                          <p className="product-desc-text">{p.description}</p>

                          <div className="product-stock-line">
                            <Database size={14} style={{ color: 'var(--text-muted)' }} />
                            <span>Stock Available: <strong>{availableStock} {p.base_unit}</strong></span>
                          </div>

                          {/* Unit Conversion Live Calculator Box */}
                          <div className="calculator-box">
                            <div className="calc-inputs">
                              <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                                <label className="form-label">Order Quantity</label>
                                <input
                                  type="number"
                                  min="0.00000001"
                                  step="any"
                                  value={calcInput.qty}
                                  onChange={(e) => handleCalculatorChange(p.id, 'qty', e.target.value)}
                                  className="form-control"
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0, flex: 1.5 }}>
                                <label className="form-label">Select Unit</label>
                                <select
                                  value={calcInput.unit}
                                  onChange={(e) => handleCalculatorChange(p.id, 'unit', e.target.value)}
                                  className="form-control"
                                >
                                  {UNITS_BY_DIMENSION[p.dimension].map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Live calculations visualization */}
                            <div className="calc-live-results">
                              <div className="calc-result-row">
                                <span>Unit Rate ({calcInput.unit}):</span>
                                <strong>₹{formatCurrency(calc.unitPrice)}</strong>
                              </div>
                              <div className="calc-result-row">
                                <span>Stored Equivalent:</span>
                                <span>{formatQuantity(calc.baseQty)} {p.base_unit}</span>
                              </div>
                              <div className="calc-result-row calc-total-row">
                                <span>Calculated Total:</span>
                                <span className="gradient-text font-bold">₹{formatCurrency(calc.totalPrice)}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => addToCart(p)}
                            disabled={!calc.isValid || new Decimal(p.stock_quantity).lessThan(new Decimal(calc.baseQty))}
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '16px' }}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cart Drawer */}
            <aside className="workspace-aside">
              <div className="glass-panel cart-panel animate-fade-in">
                <div className="cart-header">
                  <ShoppingBag size={20} />
                  <h3>Quotation Cart</h3>
                  {cart.length > 0 && (
                    <button onClick={clearCart} className="cart-clear-btn" aria-label="Clear cart">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="cart-items-list">
                  {cart.length === 0 ? (
                    <div className="cart-empty-state">
                      <ShoppingBag size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                      <p>Your quotation is empty</p>
                      <span>Add chemicals from the catalog to build a quotation request.</span>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.product.id} className="cart-item">
                        <div className="cart-item-details">
                          <p className="cart-item-name">{item.product.name}</p>
                          <span className="cart-item-sku">{item.product.sku}</span>
                          <div className="cart-item-conversions">
                            <span>Ordered: <strong>{item.quantity} {item.unit}</strong></span>
                            <span className="conversion-arrow">→</span>
                            <span>Stored: {formatQuantity(item.baseQuantity)} {item.product.base_unit}</span>
                          </div>
                        </div>
                        <div className="cart-item-actions">
                          <button onClick={() => removeFromCart(item.product.id)} className="cart-item-delete">
                            <Trash2 size={14} />
                          </button>
                          <span className="cart-item-price">₹{formatCurrency(item.totalPrice)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="cart-footer">
                    {orderError && <div className="alert-message alert-error" style={{ marginBottom: '12px' }}>{orderError}</div>}
                    {orderSuccess && <div className="alert-message alert-success" style={{ marginBottom: '12px' }}>{orderSuccess}</div>}

                    <div className="cart-total-line">
                      <span>Grand Total (INR):</span>
                      <span className="cart-total-value">₹{formatCurrency(getCartTotal())}</span>
                    </div>

                    <button
                      onClick={submitQuotation}
                      disabled={submittingOrder}
                      className="btn btn-primary w-full"
                      style={{ gap: '10px', height: '46px' }}
                    >
                      {submittingOrder ? (
                        <div className="spinner" />
                      ) : (
                        <>
                          <Send size={16} /> Place Quotation Order
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : (
          /* Tab 2: Orders History Flow */
          <div className="glass-panel" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2>Your Quotation History</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Track status of all your placed orders and quotes.</p>
              </div>
              <button onClick={fetchOrders} className="btn btn-secondary" style={{ gap: '8px' }}>
                <RefreshCw size={16} /> Sync Data
              </button>
            </div>

            {loadingOrders ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', margin: '0 auto 16px auto', width: '32px', height: '32px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Loading history...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 40px' }}>
                <ShoppingBag size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h3>No quotations submitted yet</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Your completed orders will be visible here.</p>
                <button onClick={() => setActiveTab('catalog')} className="btn btn-primary">Browse Catalog</button>
              </div>
            ) : (
              <div className="orders-timeline">
                {orders.map((order) => {
                  const dateStr = new Date(order.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={order.id} className="order-history-card glass-panel" style={{ marginBottom: '20px', border: '1px solid var(--border)' }}>
                      <div className="order-history-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-hover)' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ORDER ID</span>
                          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>{order.id}</p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Placed on {dateStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textAlign: 'right' }}>TOTAL VALUE</span>
                            <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>₹{formatCurrency(order.total_price)}</strong>
                          </div>
                          <span className={`badge badge-${order.status}`}>{order.status}</span>
                        </div>
                      </div>

                      {/* Items table nested in order card */}
                      <div style={{ padding: '0 20px' }}>
                        <div className="table-container" style={{ marginTop: 0 }}>
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Product Details</th>
                                <th>Quantity Ordered</th>
                                <th>Conversion details</th>
                                <th>Unit Price</th>
                                <th style={{ textAlign: 'right' }}>Total Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <strong>{item.product_name}</strong>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.product_sku}</span>
                                  </td>
                                  <td>{formatQuantity(item.ordered_quantity)} {item.ordered_unit}</td>
                                  <td>
                                    <span style={{ fontSize: '0.85rem' }}>
                                      {formatQuantity(item.base_quantity)} {item.product_base_unit}
                                    </span>
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                      Stored internally in base units
                                    </span>
                                  </td>
                                  <td>₹{formatCurrency(item.unit_price)} per {item.ordered_unit}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{formatCurrency(item.total_item_price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        .user-profile-panel {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          margin-bottom: 24px;
        }

        .avatar-placeholder {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-xs);
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(var(--primary-hsl), 0.2);
        }

        .avatar-svg {
          color: white;
        }

        .user-info {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.85rem;
          line-height: 1.2;
        }

        .user-role-badge {
          font-size: 0.7rem;
          color: var(--success);
          font-weight: 600;
          margin-top: 2px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: all 0.2s ease;
          position: relative;
        }
        .nav-item:hover {
          background: var(--bg-surface-hover);
          color: var(--text-primary);
        }
        .nav-item.active {
          background: var(--primary-glow);
          color: var(--primary);
        }

        .nav-arrow {
          position: absolute;
          right: 16px;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .nav-item.active .nav-arrow {
          opacity: 1;
          transform: translateX(2px);
        }

        .workspace-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 30px;
          align-items: start;
        }

        @media (max-width: 1200px) {
          .workspace-layout {
            grid-template-columns: 1fr;
          }
        }

        .products-grid-catalog {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }

        .product-card {
          padding: 24px;
        }

        .product-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .product-category-tag {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--primary);
          background: var(--primary-glow);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .product-sku-tag {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .product-name-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .product-desc-text {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 16px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          height: 2.7em;
          line-height: 1.35;
        }

        .product-stock-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .calculator-box {
          background: var(--bg-app);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 14px;
        }

        .calc-inputs {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .calc-live-results {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.8rem;
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }

        .calc-result-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
        }

        .calc-total-row {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
          border-top: 1px dashed var(--border);
          padding-top: 6px;
          margin-top: 2px;
        }

        .cart-panel {
          position: sticky;
          top: 24px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 80px);
        }

        .cart-header {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 16px;
          margin-bottom: 16px;
        }
        .cart-header h3 {
          flex: 1;
        }

        .cart-clear-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-xs);
          transition: all 0.2s ease;
        }
        .cart-clear-btn:hover {
          color: var(--danger);
          background: var(--danger-glow);
        }

        .cart-items-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 16px;
          min-height: 200px;
        }

        .cart-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 10px;
          height: 100%;
        }
        .cart-empty-state p {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1rem;
          margin-bottom: 4px;
        }
        .cart-empty-state span {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }

        .cart-item-name {
          font-weight: 600;
          font-size: 0.85rem;
          line-height: 1.3;
        }
        .cart-item-sku {
          font-size: 0.7rem;
          color: var(--text-muted);
          display: block;
          margin-top: 2px;
        }

        .cart-item-conversions {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 6px;
        }
        .conversion-arrow {
          color: var(--primary);
          font-weight: 700;
        }

        .cart-item-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
        }

        .cart-item-delete {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          border-radius: var(--radius-xs);
        }
        .cart-item-delete:hover {
          color: var(--danger);
          background: var(--danger-glow);
        }

        .cart-item-price {
          font-weight: 700;
          font-size: 0.9rem;
        }

        .cart-footer {
          border-top: 1px solid var(--border);
          padding-top: 16px;
        }

        .cart-total-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .cart-total-line span {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .cart-total-value {
          font-size: 1.3rem !important;
          font-weight: 800;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
