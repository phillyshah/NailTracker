import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Scan from './pages/Scan';
import Inventory from './pages/Inventory';
import InventoryDetail from './pages/InventoryDetail';
import Reports from './pages/Reports';
import StockByItem from './pages/StockByItem';
import UsageTrends from './pages/UsageTrends';
import UsageMatrix from './pages/UsageMatrix';
import MonthlyUsage from './pages/MonthlyUsage';
import Distributors from './pages/Distributors';
import DistributorDetail from './pages/DistributorDetail';
import Users from './pages/Users';
import Receive from './pages/Receive';
import Transfer from './pages/Transfer';
import TransferDetail from './pages/TransferDetail';
import Banks from './pages/Banks';
import BankDetail from './pages/BankDetail';
import Usage from './pages/Usage';
import UsageHistory from './pages/UsageHistory';
import UsageDetail from './pages/UsageDetail';
import Labs from './pages/Labs';
import ComingSoon from './pages/labs/ComingSoon';

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

// TrackerLabs (and any other admin-only area) is gated here: a signed-in
// non-admin who lands on the URL directly is bounced to the app home rather
// than seeing a blank/forbidden page.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/receive" replace />;
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
        <Route path="inventory/:id" element={<InventoryDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/stock-by-item" element={<StockByItem />} />
        <Route path="reports/usage-trends" element={<UsageTrends />} />
        <Route path="reports/usage-by-distributor" element={<UsageMatrix />} />
        <Route path="reports/monthly-usage" element={<MonthlyUsage />} />
        <Route path="distributors" element={<Distributors />} />
        <Route path="distributors/:id" element={<DistributorDetail />} />
        <Route path="users" element={<Users />} />
        {/* Batch Upload folded into Receive — redirect old links */}
        <Route path="batch" element={<Navigate to="/receive" replace />} />
        <Route path="banks" element={<Banks />} />
        <Route path="banks/:id" element={<BankDetail />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="transfer/:transferId" element={<TransferDetail />} />
        <Route path="usage" element={<Usage />} />
        <Route path="usage/history" element={<UsageHistory />} />
        <Route path="usage/history/:ticketId" element={<UsageDetail />} />
        {/* TrackerLabs — admin-only experimental features */}
        <Route path="labs" element={<AdminRoute><Labs /></AdminRoute>} />
        <Route path="labs/par-levels" element={<AdminRoute><ComingSoon title="Par Levels & Reorder" /></AdminRoute>} />
        <Route path="labs/cycle-count" element={<AdminRoute><ComingSoon title="Cycle Count" /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
