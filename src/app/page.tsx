'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Sparkles, LogIn, UserPlus, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'seller'>('seller');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Hydrate theme on mount
  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email, password } 
      : { email, password, name, role };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setSuccess(isLogin ? 'Logged in successfully! Redirecting...' : 'Registered successfully! Redirecting...');
      
      // Allow user to see success state, then redirect
      setTimeout(() => {
        const dest = data.user.role === 'admin' ? '/admin' : '/seller';
        router.push(dest);
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const autofillCredentials = (userRole: 'admin' | 'seller') => {
    setIsLogin(true);
    if (userRole === 'admin') {
      setEmail('admin@aasamedchem.com');
      setPassword('admin123');
    } else {
      setEmail('seller@aasamedchem.com');
      setPassword('seller123');
    }
  };

  return (
    <main className="login-container animate-fade-in">
      {/* Dynamic Ambient Background Graphics */}
      <div className="ambient-blur-1" />
      <div className="ambient-blur-2" />

      {/* Header with Theme Toggle */}
      <header className="auth-header">
        <div className="logo-group">
          <div className="logo-icon">
            <Shield className="logo-icon-svg" />
          </div>
          <div>
            <span className="logo-title">Aasa<span className="gradient-text font-bold">MedChem</span></span>
            <p className="logo-subtitle">Inventory & Order Management</p>
          </div>
        </div>
        
        <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </header>

      {/* Form Card */}
      <div className="auth-card-wrapper">
        <div className="glass-panel auth-card card-3d">
          <div className="card-3d-inner">
            <div className="auth-card-header">
              <h1 className="auth-title">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="auth-desc">
                {isLogin 
                  ? 'Enter credentials to manage chemicals, inventories, and quotes.' 
                  : 'Register a new profile to start submitting quotes.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {error && <div className="alert-message alert-error">{error}</div>}
              {success && <div className="alert-message alert-success">{success}</div>}

              {!isLogin && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Rajesh Patel"
                    className="form-control"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@aasamedchem.com"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-control"
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label className="form-label">System Role</label>
                  <div className="role-selector">
                    <button
                      type="button"
                      onClick={() => setRole('seller')}
                      className={`role-btn ${role === 'seller' ? 'active' : ''}`}
                    >
                      Seller / User
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`role-btn ${role === 'admin' ? 'active' : ''}`}
                    >
                      Administrator
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary auth-submit-btn"
              >
                {loading ? (
                  <div className="spinner" />
                ) : isLogin ? (
                  <>
                    <LogIn size={18} /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={18} /> Register Profile
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                }}
                className="auth-switch-btn"
              >
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          </div>
        </div>

        {/* Demo Credentials Panel */}
        <div className="glass-panel demo-credentials animate-fade-in">
          <div className="demo-header">
            <Sparkles size={16} className="sparkle-icon" />
            <span>Developer Sandbox Credentials</span>
          </div>
          <div className="demo-body">
            <div className="demo-item" onClick={() => autofillCredentials('admin')}>
              <div className="demo-role admin-badge">Admin</div>
              <div className="demo-details">
                <p>admin@aasamedchem.com</p>
                <span>Password: <strong>admin123</strong></span>
              </div>
            </div>
            <div className="demo-item" onClick={() => autofillCredentials('seller')}>
              <div className="demo-role seller-badge">Seller / User</div>
              <div className="demo-details">
                <p>seller@aasamedchem.com</p>
                <span>Password: <strong>seller123</strong></span>
              </div>
            </div>
          </div>
          <p className="demo-click-hint">Click on a card above to automatically fill the credentials.</p>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 24px;
        }

        .ambient-blur-1 {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
          top: -150px;
          left: -100px;
          z-index: -1;
        }

        .ambient-blur-2 {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--secondary-glow) 0%, transparent 70%);
          bottom: -200px;
          right: -100px;
          z-index: -1;
        }

        .auth-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 40px;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        .logo-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(var(--primary-hsl), 0.2);
        }

        .logo-icon-svg {
          color: white;
          width: 22px;
          height: 22px;
        }

        .logo-title {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .logo-subtitle {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: -2px;
        }

        .theme-toggle-btn {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        .theme-toggle-btn:hover {
          background: var(--bg-surface-hover);
          border-color: var(--border-focus);
          transform: scale(1.05);
        }

        .auth-card-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 440px;
          margin-top: 60px;
          z-index: 10;
        }

        .auth-card {
          padding: 40px;
          border-radius: var(--radius-lg);
        }

        .auth-card-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .auth-title {
          font-size: 1.8rem;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .auth-desc {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
        }

        .alert-message {
          padding: 10px 14px;
          border-radius: var(--radius-xs);
          font-size: 0.85rem;
          margin-bottom: 16px;
          font-weight: 500;
        }
        .alert-error {
          background: var(--danger-glow);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .alert-success {
          background: var(--success-glow);
          color: var(--success);
          border: 1px solid rgba(34, 197, 94, 0.15);
        }

        .role-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: var(--bg-app);
          padding: 4px;
          border-radius: var(--radius-xs);
          border: 1px solid var(--border);
          gap: 4px;
        }

        .role-btn {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.8rem;
          padding: 8px;
          border: none;
          background: transparent;
          border-radius: 4px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .role-btn.active {
          background: var(--bg-surface);
          color: var(--primary);
          box-shadow: var(--shadow-sm);
        }

        .auth-submit-btn {
          margin-top: 10px;
          width: 100%;
          height: 44px;
        }

        .auth-footer {
          margin-top: 24px;
          text-align: center;
        }

        .auth-switch-btn {
          font-family: var(--font-sans);
          font-size: 0.85rem;
          color: var(--primary);
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 600;
        }
        .auth-switch-btn:hover {
          text-decoration: underline;
        }

        .demo-credentials {
          padding: 20px;
          border-radius: var(--radius-md);
        }

        .demo-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .sparkle-icon {
          color: var(--warning);
        }

        .demo-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .demo-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: var(--radius-xs);
          background: var(--bg-app);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .demo-item:hover {
          background: var(--bg-surface-hover);
          border-color: var(--primary);
          transform: translateX(2px);
        }

        .demo-role {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.7rem;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .admin-badge {
          background: var(--danger-glow);
          color: var(--danger);
        }
        .seller-badge {
          background: var(--success-glow);
          color: var(--success);
        }

        .demo-details p {
          font-weight: 600;
          font-size: 0.85rem;
        }
        .demo-details span {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .demo-click-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          margin-top: 8px;
          font-style: italic;
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 24px;
          }
          .auth-header {
            padding: 16px 20px;
          }
        }
      `}</style>
    </main>
  );
}
