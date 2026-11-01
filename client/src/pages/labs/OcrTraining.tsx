import { useEffect, useRef, useState } from 'react';
import { ScanText, Upload, Check, Pencil, X, Trash2, Plus } from 'lucide-react';
import { Button } from '../../components/Button';
import { HelpBanner } from '../../components/HelpBanner';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { compressImage } from '../../utils/compressImage';
import { ocrImageToLabels, terminateOcrWorker } from '../../utils/ocrBarcode';
import {
  listSamples,
  createSample,
  updateSample,
  deleteSample,
  type TrainingSample,
  type TrainingLabel,
} from '../../api/ocr-training';

/** Editable working copy of a sample's labels, keyed by sample id. */
type Edits = Record<string, TrainingLabel[]>;

function labelsFor(sample: TrainingSample): TrainingLabel[] {
  const base = sample.correctedJson ?? sample.parsedJson ?? [];
  // Prefill the editable "token" with the matched ref so admins only change the
  // mis-read ones; the raw OCR text panel shows what was actually printed.
  return base.map((l) => ({ token: l.token ?? l.ref ?? '', ref: l.ref ?? '', lot: l.lot ?? '', exp: l.exp ?? '', gs1: l.gs1 }));
}

export default function OcrTraining() {
  const { toasts, addToast, removeToast } = useToast();
  const [samples, setSamples] = useState<TrainingSample[]>([]);
  const [edits, setEdits] = useState<Edits>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listSamples('pending')
      .then((rows) => {
        setSamples(rows);
        setEdits(Object.fromEntries(rows.map((s) => [s.id, labelsFor(s)])));
      })
      .catch(() => addToast('Failed to load training samples', 'error'))
      .finally(() => setLoading(false));
    // Free the reused OCR worker when leaving the batch screen.
    return () => {
      terminateOcrWorker();
    };
  }, [addToast]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setBusy({ done: 0, total: files.length });
    const created: TrainingSample[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImage(files[i]);
        const { rawText, labels } = await ocrImageToLabels(files[i]);
        const sample = await createSample({ imageData: compressed, rawText, parsedJson: labels });
        created.push(sample);
      } catch {
        addToast(`Couldn't process ${files[i].name}`, 'error');
      }
      setBusy({ done: i + 1, total: files.length });
    }
    setSamples((prev) => [...created, ...prev]);
    setEdits((prev) => ({ ...prev, ...Object.fromEntries(created.map((s) => [s.id, labelsFor(s)])) }));
    setBusy(null);
    if (created.length) addToast(`Read ${created.length} label photo(s)`, 'success');
  }

  function setLabel(sampleId: string, idx: number, field: keyof TrainingLabel, value: string) {
    setEdits((prev) => {
      const next = [...(prev[sampleId] ?? [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, [sampleId]: next };
    });
  }

  function addLabel(sampleId: string) {
    setEdits((prev) => ({
      ...prev,
      [sampleId]: [...(prev[sampleId] ?? []), { token: '', ref: '', lot: '', exp: '' }],
    }));
  }

  function removeLabel(sampleId: string, idx: number) {
    setEdits((prev) => ({
      ...prev,
      [sampleId]: (prev[sampleId] ?? []).filter((_, i) => i !== idx),
    }));
  }

  async function review(sample: TrainingSample, status: 'confirmed' | 'corrected' | 'rejected') {
    try {
      const correctedJson = status === 'rejected' ? undefined : edits[sample.id];
      const res = await updateSample(sample.id, { correctedJson, status });
      setSamples((prev) => prev.filter((s) => s.id !== sample.id));
      const added = res?.aliasesAdded ?? 0;
      addToast(
        status === 'rejected'
          ? 'Sample rejected'
          : added > 0
            ? `Saved — learned ${added} new correction(s)`
            : 'Saved',
        'success',
      );
    } catch {
      addToast('Failed to save review', 'error');
    }
  }

  async function discard(sample: TrainingSample) {
    try {
      await deleteSample(sample.id);
      setSamples((prev) => prev.filter((s) => s.id !== sample.id));
    } catch {
      addToast('Failed to delete sample', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <div className="mb-4 flex items-center gap-2">
        <ScanText size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">OCR Training</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
          Beta
        </span>
      </div>

      <HelpBanner storageKey="ocr-training">
        Upload photos of implant labels, check what the scanner read, and correct
        any mistakes. Each correction is remembered and used to recognise that
        label next time — so accuracy improves the more you train. This doesn't
        retrain the OCR engine itself; it builds a correction list the matcher
        consults.
      </HelpBanner>

      <div className="mb-4">
        <Button variant="primary" onClick={() => uploadRef.current?.click()} disabled={!!busy}>
          <Upload size={18} />
          {busy ? `Reading ${busy.done}/${busy.total}…` : 'Upload label photos'}
        </Button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : samples.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">
          No samples awaiting review. Upload some label photos to start training.
        </div>
      ) : (
        <div className="space-y-4">
          {samples.map((sample) => {
            const labels = edits[sample.id] ?? [];
            return (
              <div key={sample.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="text-xs text-gray-400">
                    {new Date(sample.createdAt).toLocaleString()}
                    {sample.createdBy ? ` · ${sample.createdBy}` : ''}
                  </span>
                  <button
                    onClick={() => discard(sample)}
                    className="shrink-0 text-gray-400 hover:text-red-500"
                    title="Delete sample"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Raw OCR text — the source of truth for corrections */}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Raw OCR text
                    </p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-900 p-3 font-mono text-xs text-gray-200">
                      {sample.rawText || '(no text detected)'}
                    </pre>
                  </div>

                  {/* Parsed / editable labels */}
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      <Pencil size={12} /> Parsed labels
                    </p>
                    {labels.length === 0 && (
                      <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Nothing parsed — add the correct REF / lot below if the label is readable.
                      </p>
                    )}
                    <div className="space-y-2">
                      {labels.map((l, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 p-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={l.token ?? ''}
                              onChange={(e) => setLabel(sample.id, idx, 'token', e.target.value)}
                              placeholder="As printed (token)"
                              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-primary-500 focus:outline-none"
                            />
                            <input
                              value={l.ref ?? ''}
                              onChange={(e) => setLabel(sample.id, idx, 'ref', e.target.value)}
                              placeholder="Correct REF"
                              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-primary-500 focus:outline-none"
                            />
                            <input
                              value={l.lot ?? ''}
                              onChange={(e) => setLabel(sample.id, idx, 'lot', e.target.value)}
                              placeholder="Lot"
                              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-primary-500 focus:outline-none"
                            />
                            <input
                              value={l.exp ?? ''}
                              onChange={(e) => setLabel(sample.id, idx, 'exp', e.target.value)}
                              placeholder="Exp (YYMMDD)"
                              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-primary-500 focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => removeLabel(sample.id, idx)}
                            className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500"
                          >
                            <X size={11} /> remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => addLabel(sample.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                    >
                      <Plus size={12} /> Add label
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => review(sample, 'confirmed')}>
                    <Check size={16} /> Looks right
                  </Button>
                  <Button variant="warning" size="sm" onClick={() => review(sample, 'corrected')}>
                    <Pencil size={16} /> Save correction
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => review(sample, 'rejected')}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
