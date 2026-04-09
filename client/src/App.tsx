import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Scan from './pages/Scan';
import Inventory from './pages/Inventory';
import InventoryDetail from './pages/InventoryDetail';
import Reports from './pages/Reports';
import Distributors from './pages/Distributors';
import DistributorDetail from './pages/DistributorDetail';
import Users from './pages/Users';
import BatchUpload from './pages/BatchUpload';
import Receive from './pages/Receive';
import Transfer from './pages/Transfer';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/receive" replace />} />
        <Route path="receive" element={<Receive />} />
        <Route path="scan" element={<Scan />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/:udi" element={<InventoryDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="distributors" element={<Distributors />} />
        <Route path="distributors/:id" element={<DistributorDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="batch" element={<BatchUpload />} />
        <Route path="transfer" element={<Transfer />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
