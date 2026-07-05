import { Routes, Route, Navigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Notifications } from './pages/Notifications';
import { Products } from './pages/Products';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { currentUserAtom } from './atoms/auth';

export function App() {
  const user = useAtomValue(currentUserAtom);

  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            user?.role === 'admin' ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/calendar"
          element={
            user?.role === 'admin' ? (
              <Layout>
                <Calendar />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/notifications"
          element={
            user?.role === 'admin' ? (
              <Layout>
                <Notifications />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/products"
          element={
            user?.role === 'admin' ? (
              <Layout>
                <Products />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </AuthGate>
  );
}
