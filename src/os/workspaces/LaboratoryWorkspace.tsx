// src/os/workspaces/LaboratoryWorkspace.tsx
//
// Now includes a real file browser (GET /api/autonomy/files/list,
// /read) and a real write flow (POST /api/autonomy/files/write) that
// goes through the same propose -> approve cycle as every other write
// path in this system. This closes the "file tree" gap noted in the
// previous version of this file's own header comment -- still no live
// preview or terminal grid; those are separate, larger pieces not
// built here.

import { useCallback, useEffect, useState } from 'react';
import { request } from '../state/api.ts';
import { useOS } from '../state/os-context.tsx';
import { audioManager } from '../shell/audio-manager.ts';

type Approval = { id: string; tenantId: string; status: string; runId?: string; createdAt: string; description?: string };
type DirEntry = { name: string; type: 'file' | 'directory' };

export function LaboratoryWorkspace() {
  const { adminKey, tenantId } = useOS();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  const [currentDir, setCurrentDir] = useState('src/autonomy');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [dirError, setDirError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [writeStatus, setWriteStatus] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  const [previewStatus, setPreviewStatus] = useState<{ mode: string; note: string; distLastBuilt: string | null } | null>(null);
  const [rebuildStatus, setRebuildStatus] = useState<string | null>(null);
  const [rebuildApprovalId, setRebuildApprovalId] = useState<string | null>(null);

  const loadPreviewStatus = useCallback(() => {
    if (!adminKey) return;
    request('/api/autonomy/preview/status', adminKey, tenantId).then(setPreviewStatus).catch(() => {});
  }, [adminKey, tenantId]);

  useEffect(() => { loadPreviewStatus(); }, [loadPreviewStatus]);

  const loadApprovals = useCallback(() => {
    if (!adminKey) return;
    request<{ approvals: Approval[] }>('/api/autonomy/approvals?status=pending', adminKey, tenantId)
      .then((r) => setApprovals(r.approvals))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const requestRebuild = useCallback(async () => {
    setRebuildStatus('Requesting...');
    try {
      const result = await request<{ status: string; approvalId?: string; exitCode?: number; stdout?: string; stderr?: string; reasons?: string[] }>('/api/autonomy/preview/rebuild', adminKey, tenantId, {
        method: 'POST', body: JSON.stringify({ requestedBy: 'Craig' }),
      });
      if (result.status === 'awaiting_approval' && result.approvalId) { setRebuildApprovalId(result.approvalId); setRebuildStatus(`Awaiting approval (approvalId: ${result.approvalId}).`); loadApprovals(); }
      else if (result.status === 'ok') { setRebuildStatus(`Rebuild succeeded.`); loadPreviewStatus(); }
      else setRebuildStatus(`Rebuild failed (exit ${result.exitCode}): ${result.stderr?.slice(0, 300)}`);
    } catch (e) { setRebuildStatus(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }, [adminKey, tenantId, loadApprovals, loadPreviewStatus]);

  const confirmRebuild = useCallback(async () => {
    if (!rebuildApprovalId) return;
    setRebuildStatus('Rebuilding (this can take a minute)...');
    try {
      const result = await request<{ status: string; exitCode: number | null; stderr: string }>('/api/autonomy/preview/rebuild', adminKey, tenantId, {
        method: 'POST', body: JSON.stringify({ approvalId: rebuildApprovalId, requestedBy: 'Craig' }),
      });
      setRebuildStatus(result.status === 'ok' ? 'Rebuild succeeded.' : `Rebuild failed (exit ${result.exitCode}): ${result.stderr.slice(0, 300)}`);
      setRebuildApprovalId(null);
      loadPreviewStatus();
    } catch (e) { setRebuildStatus(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }, [adminKey, tenantId, rebuildApprovalId, loadPreviewStatus]);

  const loadDir = useCallback((path: string) => {
    if (!adminKey) return;
    setDirError(null);
    request<{ status: string; entries?: DirEntry[]; error?: string }>(`/api/autonomy/files/list?path=${encodeURIComponent(path)}`, adminKey, tenantId)
      .then((r) => { if (r.status === 'ok' && r.entries) { setEntries(r.entries); setCurrentDir(path); } else setDirError(r.error ?? 'Could not list that directory.'); })
      .catch((e) => setDirError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  useEffect(() => { loadDir(currentDir); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openFile = useCallback((path: string) => {
    if (!adminKey) return;
    request<{ status: string; content?: string; error?: string }>(`/api/autonomy/files/read?path=${encodeURIComponent(path)}`, adminKey, tenantId)
      .then((r) => {
        if (r.status === 'ok' && r.content !== undefined) { setSelectedFile(path); setFileContent(r.content); setEditedContent(r.content); setWriteStatus(null); setPendingApprovalId(null); }
        else setDirError(r.error ?? 'Could not read that file.');
      })
      .catch((e) => setDirError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  const proposeWrite = useCallback(async () => {
    if (!selectedFile) return;
    setWriteStatus('Submitting...');
    try {
      const result = await request<{ status: string; approvalId?: string; reasons?: string[] }>('/api/autonomy/files/write', adminKey, tenantId, {
        method: 'POST', body: JSON.stringify({ path: selectedFile, content: editedContent, requestedBy: 'Craig' }),
      });
      if (result.status === 'awaiting_approval' && result.approvalId) { setPendingApprovalId(result.approvalId); setWriteStatus(`Awaiting your approval (approvalId: ${result.approvalId}).`); loadApprovals(); }
      else if (result.status === 'denied') setWriteStatus(`Denied: ${result.reasons?.join(' ')}`);
      else setWriteStatus(`Unexpected response: ${JSON.stringify(result)}`);
    } catch (e) { setWriteStatus(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }, [adminKey, tenantId, selectedFile, editedContent, loadApprovals]);

  const confirmWrite = useCallback(async () => {
    if (!selectedFile || !pendingApprovalId) return;
    setWriteStatus('Writing...');
    try {
      const result = await request<{ status: string; written?: string[]; error?: string }>('/api/autonomy/files/write', adminKey, tenantId, {
        method: 'POST', body: JSON.stringify({ path: selectedFile, content: editedContent, approvalId: pendingApprovalId, requestedBy: 'Craig' }),
      });
      setWriteStatus(result.status === 'ok' ? `Wrote ${selectedFile}.` : `Failed: ${result.error}`);
      if (result.status === 'ok') { setFileContent(editedContent); setPendingApprovalId(null); }
    } catch (e) { setWriteStatus(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }, [adminKey, tenantId, selectedFile, editedContent, pendingApprovalId]);

  const decide = useCallback(async (approvalId: string, approved: boolean) => {
    audioManager.markUserInteracted();
    try {
      await request(`/api/autonomy/approvals/${approvalId}/decision`, adminKey, tenantId, { method: 'POST', body: JSON.stringify({ approved, decidedBy: 'Craig' }) });
      audioManager.play(approved ? 'approval-granted' : 'warning');
      loadApprovals();
      if (approved && approvalId === pendingApprovalId) void confirmWrite();
      if (approved && approvalId === rebuildApprovalId) void confirmRebuild();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [adminKey, tenantId, loadApprovals, pendingApprovalId, confirmWrite, rebuildApprovalId, confirmRebuild]);

  const runImport = useCallback(async () => {
    setImportResult(null);
    try {
      const result = await request<{ content: string }>('/api/autonomy/github/import', adminKey, tenantId, { method: 'POST', body: JSON.stringify({ owner, repo, path: importPath }) });
      setImportResult(`Imported ${importPath} (${result.content?.length ?? 0} chars).`);
    } catch (e) { setImportResult(`Import failed: ${e instanceof Error ? e.message : String(e)}`); }
  }, [adminKey, tenantId, owner, repo, importPath]);

  const dirty = editedContent !== fileContent;
  const parentDir = currentDir.split('/').slice(0, -1).join('/') || '.';

  return (
    <div className="p-6 text-slate-200 space-y-6">
      <div>
        <div className="text-[11px] tracking-widest text-teal-400/70 font-mono mb-2">LABORATORY</div>
        <h1 className="text-2xl font-semibold">File browser, approvals, and Git</h1>
      </div>
      {!adminKey && <div className="text-xs text-amber-400">Connect an admin key to load real workspace data.</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="rounded-md border border-teal-500/10 bg-black/30 p-3 space-y-1">
          <div className="mb-2 flex items-center justify-between text-[11px] tracking-widest text-teal-400/70 font-mono">
            <span>FILES</span>
            <button onClick={() => loadDir(parentDir)} className="text-slate-500 hover:text-slate-300 normal-case tracking-normal">.. up</button>
          </div>
          <div className="text-[11px] text-slate-500 mb-2 truncate">{currentDir}</div>
          {dirError && <div className="text-[11px] text-red-400">{dirError}</div>}
          <ul className="space-y-0.5 max-h-96 overflow-y-auto">
            {entries.map((e) => (
              <li key={e.name}>
                <button
                  onClick={() => (e.type === 'directory' ? loadDir(`${currentDir}/${e.name}`) : openFile(`${currentDir}/${e.name}`))}
                  className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-white/5 ${e.type === 'directory' ? 'text-violet-300' : 'text-slate-400'}`}
                >
                  {e.type === 'directory' ? '📁' : '📄'} {e.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-teal-500/10 bg-black/30 p-3 space-y-2">
          <div className="text-[11px] tracking-widest text-teal-400/70 font-mono">{selectedFile ?? 'EDITOR (select a file)'}</div>
          {selectedFile && (
            <>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-72 rounded border border-white/10 bg-black/60 p-2 text-xs font-mono text-slate-300"
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                <button onClick={proposeWrite} disabled={!dirty || !!pendingApprovalId} className="rounded border border-teal-400/40 px-3 py-1 text-xs text-teal-300 disabled:opacity-40">
                  Propose write {dirty ? '(unsaved changes)' : ''}
                </button>
                {writeStatus && <span className="text-[11px] text-slate-400">{writeStatus}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border border-teal-500/10 bg-black/30 p-4 space-y-2">
        <div className="mb-1 text-[11px] tracking-widest text-teal-400/70 font-mono">PREVIEW</div>
        {previewStatus ? (
          <div className="text-xs text-slate-400">
            <div className="mb-1"><span className="text-slate-500">Mode:</span> {previewStatus.mode}</div>
            <div className="mb-2">{previewStatus.note}</div>
            {previewStatus.mode === 'production' && (
              <button onClick={requestRebuild} className="rounded border border-teal-400/40 px-3 py-1 text-teal-300">Rebuild &amp; Preview</button>
            )}
            {rebuildStatus && <div className="mt-2 text-slate-400">{rebuildStatus}</div>}
          </div>
        ) : <div className="text-xs text-slate-600">Loading preview status...</div>}
      </div>

      <div className="rounded-md border border-teal-500/10 bg-black/30 p-4">
        <div className="mb-3 text-[11px] tracking-widest text-teal-400/70 font-mono">PENDING APPROVALS</div>
        {approvals.length === 0 && <div className="text-xs text-slate-600">No pending approvals.</div>}
        <ul className="space-y-2">
          {approvals.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded border border-white/5 px-3 py-2 text-xs">
              <span className="text-slate-400">{a.description ?? a.id}</span>
              <span className="flex gap-2">
                <button onClick={() => decide(a.id, true)} className="rounded border border-teal-400/40 px-2 py-1 text-teal-300">Approve</button>
                <button onClick={() => decide(a.id, false)} className="rounded border border-red-400/40 px-2 py-1 text-red-300">Deny</button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-teal-500/10 bg-black/30 p-4 space-y-2">
        <div className="mb-1 text-[11px] tracking-widest text-teal-400/70 font-mono">GITHUB IMPORT</div>
        <div className="flex flex-wrap gap-2">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="owner" className="flex-1 min-w-[8rem] rounded border border-white/10 bg-black/40 px-2 py-1 text-xs" />
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="repo" className="flex-1 min-w-[8rem] rounded border border-white/10 bg-black/40 px-2 py-1 text-xs" />
          <input value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="path/to/file.ts" className="flex-1 min-w-[8rem] rounded border border-white/10 bg-black/40 px-2 py-1 text-xs" />
          <button onClick={runImport} disabled={!adminKey || !owner || !repo || !importPath} className="rounded border border-teal-400/40 px-3 py-1 text-xs text-teal-300 disabled:opacity-40">Import</button>
        </div>
        {importResult && <div className="text-xs text-slate-400">{importResult}</div>}
      </div>
    </div>
  );
}
