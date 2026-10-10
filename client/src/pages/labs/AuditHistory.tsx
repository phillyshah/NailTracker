import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { listAudits } from '../../api/audits';

export default function AuditHistory() {
  const navigate = useNavigate();
  const { data: audits = [], isLoading } = useQuery({ queryKey: ['audits'], queryFn: listAudits });

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <button onClick={() => navigate('/labs/cycle-count')} className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} /> Back to Cycle Count
      </button>

      <div className="mb-4 flex items-center gap-2">
        <ClipboardList size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Audit History</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">Beta</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : audits.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base text-gray-500">No counts yet</p>
          <p className="mt-1 text-sm text-gray-400">Finish a cycle count and it'll show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {audits.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-gray-900">{a.auditId}</span>
                <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{a.distributorName}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-700">{a.matchedCount} matched</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{a.missingCount} removed</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{a.extraCount} added</span>
                {a.createdBy && <span className="rounded-full bg-gray-50 px-2 py-0.5 text-gray-500">by {a.createdBy}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
