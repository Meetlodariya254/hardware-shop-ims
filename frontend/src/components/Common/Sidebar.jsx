import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  MdDashboard, MdInventory, MdShoppingCart, MdPointOfSale,
  MdPeople, MdLocalShipping, MdBarChart, MdSettings,
  MdChevronLeft, MdChevronRight, MdStorefront, MdWarning,
} from 'react-icons/md';

const navItems = [
  { group: 'Main', items: [
    { to: '/dashboard', icon: MdDashboard, label: 'Dashboard' },
  ]},
  { group: 'Operations', items: [
    { to: '/products', icon: MdInventory, label: 'Products' },
    { to: '/purchases', icon: MdShoppingCart, label: 'Purchases' },
    { to: '/sales', icon: MdPointOfSale, label: 'Sales' },
  ]},
  { group: 'Management', items: [
    { to: '/suppliers', icon: MdLocalShipping, label: 'Suppliers' },
    { to: '/customers', icon: MdPeople, label: 'Customers' },
  ]},
  { group: 'Insights', items: [
    { to: '/reports', icon: MdBarChart, label: 'Reports' },
    { to: '/settings', icon: MdSettings, label: 'Settings' },
  ]},
];

export default function Sidebar({ lowStockCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🔧</div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <h2>{user?.shop_name || 'Hardware Shop'}</h2>
            <p>Inventory System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((group) => (
          <div key={group.group}>
            {!collapsed && <div className="sidebar-group-label">{group.group}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-nav-item ${isActive ? 'active' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-icon"><Icon /></span>
                  {!collapsed && (
                    <>
                      <span className="nav-label">{item.label}</span>
                      {item.label === 'Products' && lowStockCount > 0 && (
                        <span className="nav-badge">{lowStockCount}</span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="sidebar-bottom">
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          <span className="nav-icon">
            {collapsed ? <MdChevronRight /> : <MdChevronLeft />}
          </span>
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
