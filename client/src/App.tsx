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
import ParLevels from './pages/labs/ParLevels';
import ReorderReport from './pages/labs/ReorderReport';
import CycleCount from './pages/labs/CycleCount';
import AuditHistory from './pages/labs/AuditHistory';
import InventoryBackup from './pages/labs/InventoryBackup';
import WhoHasWhat from './pages/labs/WhoHasWhat';
import DistributorHome from './pages/DistributorHome';
import MyInventory from './pages/MyInventory';

// Where each role lands by default. Distributor accounts get a focused home;
// everyone else gets the standard Receive screen.
function homePathForRole(role?: string) {
  return role === 'distributor' ? '/home' : '/receive';
}

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

// Role gate: a signed-in user without one of the allowed roles is bounced to
// their own home rather than seeing a blank/forbidden page.
function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePathForRole(user.role)} replace />;
  return <>{children}</>;
}

// TrackerLabs (and any other admin-only area) is gated here.
function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute roles={['admin']}>{children}</RoleRoute>;
}

// Sends the index route to the right home for the signed-in role.
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathForRole(user?.role)} replace />;
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
        <Route index element={<HomeRedirect />} />
        {/* Distributor-scoped pages */}
        <Route path="home" element={<RoleRoute roles={['distributor']}><DistributorHome /></RoleRoute>} />
        <Route path="my-inventory" element={<RoleRoute roles={['admin', 'distributor']}><MyInventory /></RoleRoute>} />
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
        <Route path="labs/par-levels" element={<AdminRoute><ParLevels /></AdminRoute>} />
        <Route path="labs/reorder" element={<AdminRoute><ReorderReport /></AdminRoute>} />
        <Route path="labs/cycle-count" element={<RoleRoute roles={['admin', 'distributor']}><CycleCount /></RoleRoute>} />
        <Route path="labs/audits" element={<AdminRoute><AuditHistory /></AdminRoute>} />
        <Route path="labs/inventory-backup" element={<AdminRoute><InventoryBackup /></AdminRoute>} />
        <Route path="labs/who-has-what" element={<AdminRoute><WhoHasWhat /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
