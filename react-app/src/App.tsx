import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import MyAccountPage from './pages/MyAccountPage';

// Admin panel
import AdminLayout     from './pages/admin/AdminLayout';
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminOrders     from './pages/admin/AdminOrders';
import AdminCustomers  from './pages/admin/AdminCustomers';
import AdminPayments   from './pages/admin/AdminPayments';
import AdminInventory  from './pages/admin/AdminInventory';
import AdminAudit      from './pages/admin/AdminAudit';

export default function App() {
  return (
    <Routes>
      {/* ── Storefront ─────────────────────────────────────────── */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/about-us" element={<AboutPage />} />
        <Route path="/contact-us" element={<ContactPage />} />
        <Route path="/my-account" element={<MyAccountPage />} />
      </Route>

      {/* ── Admin panel — own layout, no store header/footer ───── */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="orders"    element={<AdminOrders />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="payments"  element={<AdminPayments />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="audit"     element={<AdminAudit />} />
      </Route>
    </Routes>
  );
}
