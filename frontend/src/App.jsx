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

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Status loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
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
