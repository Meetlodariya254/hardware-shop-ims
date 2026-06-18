import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import {
  MdNotifications, MdLogout, MdPerson, MdSettings, MdKeyboardArrowDown,
  MdDarkMode, MdLightMode
} from 'react-icons/md';

export default function Navbar({ title, subtitle, lowStockCount = 0, sidebarCollapsed }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
    setDropdownOpen(false);
  };

  const initials = user?.shop_owner_name
    ? user.shop_owner_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SH';

  return (
    <header className={`navbar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="navbar-breadcrumb">
        <h1>{title || 'Dashboard'}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="navbar-actions">
        <button 
          className="navbar-btn" 
          onClick={toggleTheme}
          title="Toggle Dark Mode"
        >
          {theme === 'dark' ? <MdLightMode /> : <MdDarkMode />}
        </button>

        {lowStockCount > 0 && (
          <button
            className="navbar-btn"
            onClick={() => navigate('/products?stock_status=low_stock')}
            title={`${lowStockCount} low stock items`}
          >
            🔔
            <span className="badge">{lowStockCount > 9 ? '9+' : lowStockCount}</span>
          </button>
        )}

        {/* User Menu */}
        <div className="dropdown" ref={dropdownRef}>
          <div className="user-menu" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.shop_owner_name || 'Shop Owner'}</div>
              <div className="user-role">Owner</div>
            </div>
            <MdKeyboardArrowDown
              style={{
                color: 'var(--text-muted)',
                transition: 'transform 0.2s',
                transform: dropdownOpen ? 'rotate(180deg)' : 'none',
              }}
            />
          </div>

          {dropdownOpen && (
            <div className="dropdown-menu">
              <div
                className="dropdown-item"
                onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
              >
                <MdPerson /> My Profile
              </div>
              <div
                className="dropdown-item"
                onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
              >
                <MdSettings /> Settings
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item danger" onClick={handleLogout}>
                <MdLogout /> Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
