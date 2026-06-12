import { useNavigate } from 'react-router';
import { ArrowLeft, FlaskConical } from 'lucide-react';

/** Placeholder for TrackerLabs experiments that are wired into the nav but not
 *  yet built. Replaced by the real page when each feature ships. */
export default function ComingSoon({ title }: { title?: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <button
        onClick={() => navigate('/labs')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to TrackerLabs
      </button>
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <FlaskConical size={40} className="mx-auto mb-3 text-gray-300" />
        <h2 className="text-lg font-bold text-gray-900">{title || 'Coming soon'}</h2>
        <p className="mt-1 text-sm text-gray-500">
          This TrackerLabs experiment is in development and will light up in an
          upcoming release.
        </p>
      </div>
    </div>
  );
}
