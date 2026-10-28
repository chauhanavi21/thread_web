import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import { Status } from './components/Status.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import Checkout from './pages/Checkout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import Dashboard from './admin/Dashboard.jsx';
import AdminProducts from './admin/Products.jsx';
import ProductEditor from './admin/ProductEditor.jsx';
import AdminOrders from './admin/Orders.jsx';
import Customers from './admin/Customers.jsx';
import Categories from './admin/Categories.jsx';
import SiteSettings from './admin/SiteSettings.jsx';

function RequireAuth({ children }) {
  const { user, loading, signedOutOnPurpose } = useAuth();
  const location = useLocation();
  if (loading) return <Status loading />;
  if (!user) {
    // Someone who just clicked "Sign out" goes home; someone who opened a private link is sent back to it after signing in.
    return signedOutOnPurpose.current ? <Navigate to="/" replace /> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function Page() {
  return (
    <div className="page py-8 sm:py-12">
      <Outlet />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main className="min-h-[70vh]">
        <Routes>
          {/* The home page lays out its own full-width sections. Everything else sits in the shared wide container. */}
          <Route path="/" element={<Home />} />
          <Route element={<Page />}>
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
            <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="products/:id" element={<ProductEditor />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="customers" element={<Customers />} />
              <Route path="categories" element={<Categories />} />
              <Route path="settings" element={<SiteSettings />} />
            </Route>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route
              path="*"
              element={
                <Status>
                  <h1 className="text-3xl">Page not found</h1>
                  <Link to="/" className="btn mt-6">Back home</Link>
                </Status>
              }
            />
          </Route>
        </Routes>
      </main>
      <Footer />
    </>
  );
}
