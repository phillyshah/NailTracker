// Inventory Backup download URLs. Like the other exports, the auth token rides
// as a query param so a plain anchor / window.location download is authed.
function backupUrl(format: 'excel' | 'json', params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const token = localStorage.getItem('token');
  if (token) sp.set('token', token);
  return `/api/backup/${format}?${sp.toString()}`;
}

export function getBackupExcelUrl(p: { from?: string; to?: string }) {
  return backupUrl('excel', p);
}

export function getBackupJsonUrl(p: { from?: string; to?: string; includeImages?: boolean }) {
  return backupUrl('json', {
    from: p.from,
    to: p.to,
    includeImages: p.includeImages === false ? 'false' : undefined,
  });
}
