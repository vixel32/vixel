import { ChangeEvent, useEffect, useState } from 'react';
import {
  Archive,
  RefreshCw,
  Upload,
  FileArchive,
  CheckCircle,
  Download,
  Trash2,
  AlertCircle,
  RotateCcw,
  X,
  Database,
  HardDrive,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const BACKUP_BUCKET = 'system-backups';

type Backup = {
  id: string;
  backup_name: string;
  version: string;
  file_size: number | null;
  status: string;
  storage_path: string | null;
  backup_type: string | null;
  backup_scope: string | null;
  notes: string | null;
  created_at: string;
};

type CreateBackupTableResult = {
  name: string;
  rows: number;
  file: string;
};

type RestoreTableResult = {
  table: string;
  rows: number;
  insertedOrUpdated: number;
};

type RestoreStorageResult = {
  bucket: string;
  files: number;
  restored: number;
  failed: number;
};

type DetailBackup = Backup & {
  backup_path?: string | null;
  update_id?: string | null;
};

export default function AdminBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [detailBackup, setDetailBackup] = useState<DetailBackup | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    tables: RestoreTableResult[];
    storage: RestoreStorageResult[];
    totalRows: number;
  } | null>(null);

  async function loadBackups() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_backups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        alert(`Gagal mengambil data backup.\n\n${error.message}`);
        return;
      }

      setBackups((data as Backup[]) ?? []);
    } catch {
      alert('Terjadi kesalahan saat mengambil data backup.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function handleCreateBackup() {
    setShowCreateConfirm(false);
    setCreatingBackup(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-backup', {
        body: {},
      });

      if (error) {
        throw new Error(error.message || 'Gagal menjalankan Create Backup.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Create Backup gagal.');
      }

      const tables = Array.isArray(data.database?.tables)
        ? (data.database.tables as CreateBackupTableResult[])
        : Array.isArray(data.tables)
          ? (data.tables as CreateBackupTableResult[])
          : [];

      const storageBuckets = Array.isArray(data.storage?.buckets)
        ? data.storage.buckets
        : [];

      const tableSummary =
        tables.length > 0
          ? tables.map((t) => `${t.name}: ${t.rows} data`).join(', ')
          : 'Tidak ada tabel.';

      const storageSummary =
        storageBuckets.length > 0
          ? storageBuckets.map((s: { bucket: string; files: number }) => `${s.bucket}: ${s.files} file`).join(', ')
          : 'Tidak ada file storage.';

      alert(
        `BACKUP FULL DATA BERHASIL!\n\n` +
          `File: ${data.backup?.backup_name ?? '-'}\n` +
          `Ukuran: ${formatFileSize(data.backup?.file_size ?? null)}\n\n` +
          `Database: ${tableSummary}\n\n` +
          `Storage: ${storageSummary}`
      );

      await loadBackups();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat backup.';
      alert(`CREATE BACKUP GAGAL.\n\n${errorMessage}`);
      await loadBackups();
    } finally {
      setCreatingBackup(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('File tidak valid. Silakan pilih file backup dengan format ZIP.');
      event.target.value = '';
      return;
    }

    if (file.size === 0) {
      alert('File ZIP kosong.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    let uploadedFilePath = '';

    try {
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      uploadedFilePath = `backups/${timestamp}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(uploadedFilePath, file, {
          contentType: 'application/zip',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload Storage gagal: ${uploadError.message}`);
      }

      const version = `backup-${timestamp}`;

      const { error: insertError } = await supabase.from('system_backups').insert({
        backup_name: file.name,
        version,
        file_size: file.size,
        status: 'completed',
        storage_path: uploadedFilePath,
        backup_path: uploadedFilePath,
        backup_type: 'manual',
        backup_scope: 'full_data',
        notes: 'Backup diupload secara manual.',
      });

      if (insertError) {
        await supabase.storage.from(BACKUP_BUCKET).remove([uploadedFilePath]);
        throw new Error(`Database Error: ${insertError.message}`);
      }

      alert('Backup berhasil diupload dan disimpan.');
      event.target.value = '';
      await loadBackups();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      alert(`Upload gagal.\n\n${errorMessage}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(backup: Backup) {
    if (!backup.storage_path) {
      alert('Path file backup tidak ditemukan.');
      return;
    }

    setDownloadingId(backup.id);

    try {
      const { data, error } = await supabase.storage
        .from(BACKUP_BUCKET)
        .download(backup.storage_path);

      if (error) throw new Error(error.message);
      if (!data) throw new Error('File backup tidak ditemukan.');

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.backup_name || 'vixel-backup.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat download.';
      alert(`Download gagal.\n\n${errorMessage}`);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRestore(backup: Backup) {
    setRestoreTarget(null);
    setRestoringId(backup.id);
    setRestoreResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('restore-backup', {
        body: { backupId: backup.id },
      });

      if (error) {
        throw new Error(error.message || 'Gagal menjalankan Restore.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Restore gagal.');
      }

      const tables = Array.isArray(data.database?.tables)
        ? (data.database.tables as RestoreTableResult[])
        : [];
      const storage = Array.isArray(data.storage) ? (data.storage as RestoreStorageResult[]) : [];
      const totalRows = data.database?.totalRows ?? 0;

      setRestoreResult({ tables, storage, totalRows });
      await loadBackups();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat restore.';
      alert(`RESTORE GAGAL.\n\n${errorMessage}`);
      await loadBackups();
    } finally {
      setRestoringId(null);
    }
  }

  async function handleDelete(backup: Backup) {
    if (!window.confirm(`Hapus backup "${backup.backup_name}"?\n\nFile akan dihapus dari Storage dan Database.`)) {
      return;
    }

    setDeletingId(backup.id);

    try {
      if (backup.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(BACKUP_BUCKET)
          .remove([backup.storage_path]);

        if (storageError) {
          throw new Error(`Gagal menghapus file Storage: ${storageError.message}`);
        }
      }

      const { error: databaseError } = await supabase
        .from('system_backups')
        .delete()
        .eq('id', backup.id);

      if (databaseError) {
        throw new Error(`Gagal menghapus data database: ${databaseError.message}`);
      }

      await loadBackups();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus backup.';
      alert(`Gagal menghapus backup.\n\n${errorMessage}`);
    } finally {
      setDeletingId(null);
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes || bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} Bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function getStatusClass(status: string) {
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'restoring') return 'bg-blue-100 text-blue-700';
    if (status === 'restored') return 'bg-purple-100 text-purple-700';
    if (status === 'uploading') return 'bg-blue-100 text-blue-700';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
    if (status === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-charcoal-100 text-charcoal-600';
  }

  function getScopeLabel(scope: string | null) {
    if (scope === 'full_data') return 'Full Data';
    if (scope === 'database') return 'Database Only';
    if (scope === 'pre_update') return 'Pre-Update';
    return 'Full Data';
  }

  function getTypeLabel(type: string | null) {
    if (type === 'pre_update') return 'Pre-Update';
    if (type === 'manual') return 'Manual';
    return type ?? 'Manual';
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-charcoal-800">Backup Sistem</h2>
          <p className="text-sm text-charcoal-400 mt-1">
            Buat, upload, download, restore, dan kelola file backup sistem Vixel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateConfirm(true)}
            disabled={loading || uploading || creatingBackup || restoringId !== null}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            {creatingBackup ? 'Membuat Backup...' : 'Buat Full Backup'}
          </button>

          <button
            type="button"
            onClick={loadBackups}
            disabled={loading || uploading || creatingBackup || restoringId !== null}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-charcoal-200 bg-white text-sm font-medium text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* SOURCE CODE STATUS */}
      <div className="rounded-xl bg-charcoal-50 border border-charcoal-100 p-4">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-charcoal-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-charcoal-700">Source Code Versioning</p>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Belum terhubung. Backup saat ini mencakup Database + Storage.
            </p>
          </div>
        </div>
      </div>

      {/* UPLOAD */}
      <div className="card p-6">
        <div className="border-2 border-dashed border-charcoal-200 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-navy-50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-navy-700" />
          </div>
          <h3 className="font-semibold text-charcoal-800">Upload File Backup</h3>
          <p className="text-sm text-charcoal-400 mt-2">Pilih file backup dengan format ZIP.</p>

          <div className="mt-5">
            <label className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-navy-900 text-white text-sm font-medium cursor-pointer hover:bg-navy-800 transition-colors">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Pilih File ZIP'}
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={handleUpload}
                disabled={uploading || creatingBackup || restoringId !== null}
                className="hidden"
              />
            </label>
          </div>

          {uploading && (
            <p className="text-sm text-charcoal-400 mt-4">Sedang mengupload dan menyimpan backup...</p>
          )}
          {creatingBackup && (
            <p className="text-sm text-charcoal-400 mt-4">
              Sedang mengambil data database dan file storage, lalu membuat ZIP...
            </p>
          )}
        </div>
      </div>

      {/* RESTORE RESULT */}
      {restoreResult && (
        <div className="card p-6 animate-scale-in">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-serif text-lg font-semibold text-charcoal-800">Hasil Restore</h3>
            <button
              type="button"
              onClick={() => setRestoreResult(null)}
              className="ml-auto p-1 rounded-lg hover:bg-charcoal-100"
            >
              <X className="w-4 h-4 text-charcoal-400" />
            </button>
          </div>

          <div className="space-y-4">
            {/* DATABASE */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-navy-600" />
                <p className="text-sm font-medium text-charcoal-700">Database</p>
                <span className="text-xs text-charcoal-400">({restoreResult.totalRows} rows total)</span>
              </div>
              <div className="space-y-1 pl-6">
                {restoreResult.tables.map((t) => (
                  <div key={t.table} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-charcoal-600">{t.table}</span>
                    <span className="text-charcoal-400">— {t.insertedOrUpdated} data</span>
                  </div>
                ))}
              </div>
            </div>

            {/* STORAGE */}
            {restoreResult.storage.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-4 h-4 text-navy-600" />
                  <p className="text-sm font-medium text-charcoal-700">Storage</p>
                </div>
                <div className="space-y-1 pl-6">
                  {restoreResult.storage.map((s) => (
                    <div key={s.bucket} className="flex items-center gap-2 text-xs">
                      {s.failed > 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-gold-500" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      )}
                      <span className="text-charcoal-600">{s.bucket}</span>
                      <span className="text-charcoal-400">
                        — {s.restored}/{s.files} files restored
                        {s.failed > 0 && ` (${s.failed} gagal)`}
                      </span>
                    </div>
                  ))}
                </div>
                {restoreResult.storage.some((s) => s.failed > 0) && (
                  <p className="text-xs text-gold-600 mt-2 pl-6">
                    Beberapa file Storage gagal direstore. Lihat log untuk detail.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BACKUP LIST */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Archive className="w-5 h-5 text-navy-700" />
          <div>
            <h3 className="font-semibold text-charcoal-800">Riwayat Backup</h3>
            <p className="text-xs text-charcoal-400 mt-1">Daftar file backup yang tersimpan di sistem.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 mx-auto text-charcoal-300 animate-spin mb-3" />
            <p className="text-sm text-charcoal-400">Memuat data backup...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12">
            <Archive className="w-12 h-12 mx-auto text-charcoal-300 mb-4" />
            <p className="font-medium text-charcoal-700">Belum ada backup</p>
            <p className="text-sm text-charcoal-400 mt-1">
              File backup yang dibuat atau diupload akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between p-4 rounded-xl border border-charcoal-100 hover:bg-charcoal-50 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-navy-50 flex items-center justify-center">
                    <FileArchive className="w-5 h-5 text-navy-700" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium text-charcoal-800 truncate">{backup.backup_name}</p>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-charcoal-400">{formatFileSize(backup.file_size)}</span>
                      <span className="text-xs text-charcoal-400">{backup.version}</span>
                      <span className="text-xs text-navy-600 font-medium">
                        {getScopeLabel(backup.backup_scope)}
                      </span>
                      <span className="text-xs text-charcoal-400">{getTypeLabel(backup.backup_type)}</span>
                      <span className="text-xs text-charcoal-400">{formatDate(backup.created_at)}</span>
                    </div>

                    {backup.notes && (
                      <p className="text-xs text-charcoal-400 mt-1 truncate">{backup.notes}</p>
                    )}

                    {!backup.storage_path && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                        <span className="text-xs text-yellow-600">Backup lama tidak memiliki path Storage.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full font-medium ${getStatusClass(backup.status)}`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {backup.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => setDetailBackup(backup)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-charcoal-50 text-charcoal-600 text-xs font-medium hover:bg-charcoal-100 transition-colors"
                  >
                    Detail
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(backup)}
                    disabled={
                      downloadingId === backup.id || !backup.storage_path || creatingBackup || restoringId !== null
                    }
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-900 text-white text-xs font-medium hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingId === backup.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreTarget(backup)}
                    disabled={
                      restoringId === backup.id ||
                      !backup.storage_path ||
                      deletingId === backup.id ||
                      creatingBackup ||
                      uploading ||
                      restoringId !== null
                    }
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-400 text-navy-900 text-xs font-medium hover:bg-gold-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {restoringId === backup.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    {restoringId === backup.id ? 'Restore...' : 'Restore'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(backup)}
                    disabled={deletingId === backup.id || restoringId !== null || creatingBackup}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === backup.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE CONFIRMATION MODAL */}
      {showCreateConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50"
          onClick={() => setShowCreateConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center">
                <Archive className="w-5 h-5 text-navy-600" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-charcoal-800">Buat Full Backup</h3>
            </div>

            <p className="text-sm text-charcoal-600 mb-4">
              Backup ini akan menyimpan database dan file Storage yang digunakan website.
              Proses ini mungkin membutuhkan beberapa saat.
            </p>

            <div className="rounded-xl bg-cream-100 p-3 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-charcoal-600">
                <Database className="w-4 h-4 text-navy-500" />
                8 tabel database
              </div>
              <div className="flex items-center gap-2 text-xs text-charcoal-600">
                <HardDrive className="w-4 h-4 text-navy-500" />
                File Storage (product-images)
              </div>
              <div className="flex items-center gap-2 text-xs text-charcoal-400">
                <GitBranch className="w-4 h-4" />
                Source Code: belum terhubung
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-charcoal-200 text-charcoal-700 text-sm font-medium hover:bg-charcoal-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateBackup}
                className="flex-1 px-4 py-3 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 transition-colors"
              >
                Buat Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50"
          onClick={() => setRestoreTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-gold-600" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-charcoal-800">Konfirmasi Restore</h3>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-charcoal-500">Backup:</span>
                <span className="font-medium text-charcoal-800 text-right">{restoreTarget.backup_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-charcoal-500">Scope:</span>
                <span className="font-medium text-charcoal-800">{getScopeLabel(restoreTarget.backup_scope)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-cream-100 p-3 mb-4">
              <p className="text-xs text-charcoal-600">
                {restoreTarget.backup_scope === 'full_data' || !restoreTarget.backup_scope
                  ? 'Backup ini berisi database dan file Storage. Restore akan memulihkan data database dan file Storage. File existing yang tidak ada di backup tidak akan otomatis dihapus.'
                  : 'Backup ini berisi data database. Restore akan memulihkan data database.'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-charcoal-200 text-charcoal-700 text-sm font-medium hover:bg-charcoal-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleRestore(restoreTarget)}
                className="flex-1 px-4 py-3 rounded-xl bg-gold-400 text-navy-900 text-sm font-medium hover:bg-gold-300 transition-colors"
              >
                Restore Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailBackup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50"
          onClick={() => setDetailBackup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-scale-in max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center">
                <FileArchive className="w-5 h-5 text-navy-600" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-charcoal-800">Detail Backup</h3>
              <button
                type="button"
                onClick={() => setDetailBackup(null)}
                className="ml-auto p-1 rounded-lg hover:bg-charcoal-100"
              >
                <X className="w-4 h-4 text-charcoal-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Nama File</span>
                <span className="text-sm font-medium text-charcoal-800 text-right break-all">
                  {detailBackup.backup_name}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Versi</span>
                <span className="text-sm font-medium text-charcoal-800">{detailBackup.version}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Tipe</span>
                <span className="text-sm font-medium text-charcoal-800">{getTypeLabel(detailBackup.backup_type)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Scope</span>
                <span className="text-sm font-medium text-charcoal-800">
                  {getScopeLabel(detailBackup.backup_scope)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Ukuran</span>
                <span className="text-sm font-medium text-charcoal-800">
                  {formatFileSize(detailBackup.file_size)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Status</span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusClass(detailBackup.status)}`}
                >
                  {detailBackup.status}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Dibuat</span>
                <span className="text-sm font-medium text-charcoal-800">{formatDate(detailBackup.created_at)}</span>
              </div>

              {detailBackup.notes && (
                <div className="py-2 border-b border-charcoal-100">
                  <span className="text-sm text-charcoal-500 block mb-1">Catatan</span>
                  <span className="text-sm text-charcoal-700">{detailBackup.notes}</span>
                </div>
              )}

              <div className="py-2">
                <span className="text-sm text-charcoal-500 block mb-2">Source Code Versioning</span>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-charcoal-400" />
                  <span className="text-sm text-charcoal-400">Belum terhubung</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
