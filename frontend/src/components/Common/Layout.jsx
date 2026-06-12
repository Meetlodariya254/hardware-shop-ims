import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { productService } from '../../services/productService';

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your shop performance' },
  '/products': { title: 'Products', subtitle: 'Manage your inventory' },
  '/purchases': { title: 'Purchases', subtitle: 'Manage purchase orders' },
  '/sales': { title: 'Sales', subtitle: 'Manage sales transactions' },
  '/suppliers': { title: 'Suppliers', subtitle: 'Manage your suppliers' },
  '/customers': { title: 'Customers', subtitle: 'Manage your customers' },
  '/reports': { title: 'Reports & Analytics', subtitle: 'Business insights and data' },
  '/settings': { title: 'Settings', subtitle: 'Account and shop settings' },
};

export default function Layout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Hardware Shop IMS', subtitle: '' };

  useEffect(() => {
    productService.getLowStock()
      .then((res) => setLowStockCount(res.data.data?.length || 0))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Sidebar lowStockCount={lowStockCount} />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Navbar
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          lowStockCount={lowStockCount}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
