import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Key, Trash2, Shield, ShieldCheck, X } from 'lucide-react';
import { listUsers, createUser, updatePassword, updateRole, deleteUser, type User } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('user');

  const [changingPwd, setChangingPwd] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  });

  const createMutation = useMutation({
    mutationFn: () => createUser(addUsername, addPassword, addRole),
    onSuccess: () => {
      addToast('User created', 'success');
      setShowAddForm(false);
      setAddUsername('');
      setAddPassword('');
      setAddRole('user');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const pwdMutation = useMutation({
    mutationFn: () => updatePassword(changingPwd!.id, newPassword),
    onSuccess: () => {
      addToast('Password updated', 'success');
      setChangingPwd(null);
      setNewPassword('');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateRole(id, role),
    onSuccess: () => {
      addToast('Role updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      addToast('User deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">User Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={20} /> Add User
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isCurrentUser = u.id === currentUser?.userId;
            return (
              <div
                key={u.id}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-gray-900">
                        {u.username}
                      </p>
                      {isCurrentUser && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        onClick={() =>
                          roleMutation.mutate({
                            id: u.id,
                            role: u.role === 'admin' ? 'user' : 'admin',
                          })
                        }
                        disabled={isCurrentUser}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isCurrentUser ? "Can't change your own role" : 'Toggle role'}
                      >
                        {u.role === 'admin' ? (
                          <ShieldCheck size={16} className="text-primary-600" />
                        ) : (
                          <Shield size={16} />
                        )}
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </button>
                      <span className="text-xs text-gray-400">
                        Added {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setChangingPwd(u);
                        setNewPassword('');
                      }}
                      className="rounded-lg p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title="Change password"
                    >
                      <Key size={18} />
                    </button>
                    {!isCurrentUser && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete user "${u.username}"?`)) {
                            deleteMutation.mutate(u.id);
                          }
                        }}
                        className="rounded-lg p-2.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete user"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add User Panel */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add User</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-3"
            >
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Username</span>
                <input
                  type="text"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  required
                  minLength={2}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Password</span>
                <input
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                  autoComplete="new-password"
                />
                <span className="text-xs text-gray-400 mt-1">At least 6 characters</span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Role</span>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Panel */}
      {changingPwd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Change Password for {changingPwd.username}
              </h3>
              <button
                onClick={() => setChangingPwd(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                pwdMutation.mutate();
              }}
              className="space-y-3"
            >
              <label className="block">
                <span className="text-sm font-medium text-gray-700">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                  autoComplete="new-password"
                />
                <span className="text-xs text-gray-400 mt-1">At least 6 characters</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setChangingPwd(null)}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdMutation.isPending}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {pwdMutation.isPending ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
