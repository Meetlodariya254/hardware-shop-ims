import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Layout from './components/Common/Layout';

// Auth Pages
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';

// Protected Pages
import Dashboard from './components/Dashboard/Dashboard';
import ProductList from './components/Products/ProductList';
import PurchaseList from './components/Purchases/PurchaseList';
import SupplierList from './components/Purchases/SupplierList';
import SalesList from './components/Sales/SalesList';
import Reports from './components/Reports/Reports';
import Settings from './pages/Settings';
import CustomerList from './pages/CustomerList';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<ProductList />} />
              <Route path="purchases" element={<PurchaseList />} />
              <Route path="suppliers" element={<SupplierList />} />
              <Route path="sales" element={<SalesList />} />
              <Route path="customers" element={<CustomerList />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          <Toaster
            position="top-right"
            reverseOrder={false}
            toastOptions={{
              duration: 3500,
              style: {
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
