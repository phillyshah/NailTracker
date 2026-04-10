import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { listDistributors, createDistributor, updateDistributor, deactivateDistributor } from '../api/distributors';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Distributor } from '../types';

interface FormData {
  name: string;
  region: string;
  contact: string;
  email: string;
  phone: string;
}

const emptyForm: FormData = { name: '', region: '', contact: '', email: '', phone: '' };

export default function Distributors() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: distributors = [], isLoading } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return updateDistributor(editing, form);
      }
      return createDistributor(form);
    },
    onSuccess: () => {
      addToast(editing ? 'Distributor updated' : 'Distributor added', 'success');
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['distributors'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deactivateDistributor(id),
    onSuccess: (data) => {
      if (data.data?.warning) {
        addToast(data.data.warning, 'info');
      } else {
        addToast('Distributor deactivated', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['distributors'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function openEdit(d: Distributor) {
    setEditing(d.id);
    setForm({
      name: d.name,
      region: d.region || '',
      contact: d.contact || '',
      email: d.email || '',
      phone: d.phone || '',
    });
    setShowForm(true);
  }

  function handleField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Distributors</h2>
        <button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={20} /> Add
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : distributors.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-gray-500">No distributors yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {distributors.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl bg-white p-4 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => navigate(`/distributors/${d.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900">{d.name}</p>
                  <p className="text-sm text-gray-500">
                    {[d.region, d.contact].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-700">
                    {d._count?.items ?? 0} items
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(d);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Deactivate ${d.name}?`)) {
                        deleteMutation.mutate(d.id);
                      }
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit panel — full screen on mobile */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Distributor' : 'Add Distributor'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-3"
            >
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleField('name', e.target.value)}
                  required
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Region</span>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => handleField('region', e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Contact Person</span>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => handleField('contact', e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleField('email', e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Phone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleField('phone', e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
