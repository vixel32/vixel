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

export default function AdminBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function loadBackups() {
    setLoading(true);

    try {
      console.log('Mengambil data backup...');

      const { data, error } = await supabase
        .from('system_backups')
        .select(`
          id,
          backup_name,
          version,
          file_size,
          status,
          storage_path,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error mengambil backup:', error);
        alert(`Gagal mengambil data backup.\n\n${error.message}`);
        return;
      }

      setBackups(data || []);

      console.log('Data backup berhasil dimuat:', data);
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Terjadi kesalahan saat mengambil data backup.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function handleCreateBackup() {
    const confirmed = window.confirm(
      `Buat backup sistem sekarang?\n\n` +
        `Sistem akan mengambil data tabel Vixel dan membuat file ZIP.\n\n` +
        `Isi backup:\n` +
        `• product_categories\n` +
        `• products\n` +
        `• product_images\n` +
        `• orders\n` +
        `• store_settings\n` +
        `• testimonials\n` +
        `• system_versions\n` +
        `• system_updates\n\n` +
        `Proses ini mungkin membutuhkan beberapa saat.\n\n` +
        `Lanjutkan?`
    );

    if (!confirmed) return;

    setCreatingBackup(true);

    try {
      console.log('Memanggil Edge Function create-backup...');

      const { data, error } = await supabase.functions.invoke(
        'create-backup',
        {
          body: {},
        }
      );

      if (error) {
        throw new Error(
          error.message || 'Gagal menjalankan Create Backup.'
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error || 'Create Backup gagal.'
        );
      }

      const tables = Array.isArray(data.tables)
        ? (data.tables as CreateBackupTableResult[])
        : [];

      const tableSummary =
        tables.length > 0
          ? tables
              .map(
                (table) =>
                  `- ${table.name}: ${table.rows} data`
              )
              .join('\n')
          : '- Tidak ada tabel.';

      alert(
        `BACKUP BERHASIL!\n\n` +
          `File:\n${data.backup?.backup_name || '-'}\n\n` +
          `Ukuran:\n${formatFileSize(
            data.backup?.file_size ?? null
          )}\n\n` +
          `Isi backup:\n${tableSummary}`
      );

      await loadBackups();
    } catch (error) {
      console.error('Create Backup gagal:', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat membuat backup.';

      alert(
        `CREATE BACKUP GAGAL.\n\n${errorMessage}`
      );

      await loadBackups();
    } finally {
      setCreatingBackup(false);
    }
  }

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert(
        'File tidak valid.\n\n' +
          'Silakan pilih file backup dengan format ZIP.'
      );

      event.target.value = '';
      return;
    }

    if (file.size === 0) {
      alert(
        'File ZIP kosong.\n\n' +
          'Silakan pilih file backup yang valid.'
      );

      event.target.value = '';
      return;
    }

    setUploading(true);

    let uploadedFilePath = '';

    try {
      console.log('Memulai upload backup...');
      console.log('Nama file:', file.name);
      console.log('Ukuran file:', file.size);

      const timestamp = Date.now();

      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      uploadedFilePath =
        `backups/${timestamp}-${safeFileName}`;

      console.log(
        'Upload ke Supabase Storage:',
        uploadedFilePath
      );

      const { error: uploadError } =
        await supabase.storage
          .from(BACKUP_BUCKET)
          .upload(
            uploadedFilePath,
            file,
            {
              contentType: 'application/zip',
              upsert: false,
            }
          );

      if (uploadError) {
        console.error(
          'Storage Upload Error:',
          uploadError
        );

        throw new Error(
          `Upload Storage gagal: ${uploadError.message}`
        );
      }

      console.log(
        'File berhasil diupload ke Storage.'
      );

      const version =
        `backup-${timestamp}`;

      console.log(
        'Menyimpan metadata ke database...'
      );

      const { error: insertError } =
        await supabase
          .from('system_backups')
          .insert({
            backup_name: file.name,
            version,
            file_size: file.size,
            status: 'completed',
            storage_path: uploadedFilePath,
            backup_path: uploadedFilePath,
            backup_type: 'manual',
            notes:
              'Backup diupload secara manual.',
          });

      if (insertError) {
        console.error(
          'Database Insert Error:',
          insertError
        );

        console.log(
          'Menghapus file dari Storage karena database gagal...'
        );

        await supabase.storage
          .from(BACKUP_BUCKET)
          .remove([
            uploadedFilePath,
          ]);

        throw new Error(
          `Database Error: ${insertError.message}`
        );
      }

      console.log(
        'Metadata backup berhasil disimpan.'
      );

      alert(
        'Backup berhasil diupload dan disimpan.'
      );

      event.target.value = '';

      await loadBackups();
    } catch (error) {
      console.error(
        'Upload gagal:',
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan yang tidak diketahui.';

      alert(
        `Upload gagal.\n\n${errorMessage}`
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(
    backup: Backup
  ) {
    if (!backup.storage_path) {
      alert(
        'Path file backup tidak ditemukan.\n\n' +
          'Backup lama mungkin dibuat sebelum fitur Download ditambahkan.'
      );

      return;
    }

    setDownloadingId(backup.id);

    try {
      console.log(
        'Memulai download:',
        backup.storage_path
      );

      const { data, error } =
        await supabase.storage
          .from(BACKUP_BUCKET)
          .download(
            backup.storage_path
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data) {
        throw new Error(
          'File backup tidak ditemukan.'
        );
      }

      const url =
        URL.createObjectURL(data);

      const link =
        document.createElement('a');

      link.href = url;
      link.download =
        backup.backup_name ||
        'vixel-backup.zip';

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(url);

      console.log(
        'Download berhasil.'
      );
    } catch (error) {
      console.error(
        'Download gagal:',
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat download.';

      alert(
        `Download gagal.\n\n${errorMessage}`
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRestore(
    backup: Backup
  ) {
    if (!backup.storage_path) {
      alert(
        'Backup tidak memiliki path Storage.'
      );

      return;
    }

    const confirmed =
      window.confirm(
        `RESTORE BACKUP\n\n` +
          `Backup:\n${backup.backup_name}\n\n` +
          `Versi:\n${backup.version}\n\n` +
          `PERINGATAN!\n\n` +
          `Data backup akan dimasukkan kembali ke database Vixel.\n\n` +
          `Data dengan ID yang sama akan diperbarui.\n\n` +
          `Data baru dari backup akan dibuat.\n\n` +
          `Lanjutkan Restore?`
      );

    if (!confirmed) return;

    setRestoringId(backup.id);

    try {
      console.log(
        'Memanggil Edge Function restore-backup...'
      );

      const { data, error } =
        await supabase.functions.invoke(
          'restore-backup',
          {
            body: {
              backupId: backup.id,
            },
          }
        );

      if (error) {
        throw new Error(
          error.message ||
            'Gagal menjalankan Restore.'
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            'Restore gagal.'
        );
      }

      const tables =
        Array.isArray(data.tables)
          ? (data.tables as RestoreTableResult[])
          : [];

      console.log('HASIL RESTORE DARI EDGE FUNCTION:', data);
console.log('TABLES RESTORE:', data?.tables);
      const tableSummary =
        tables.length > 0
          ? tables
              .map(
                (table) =>
                  `- ${table.table}: ${table.insertedOrUpdated} data`
              )
              .join('\n')
          : '- Tidak ada tabel direstore.';

      alert(
        `RESTORE BERHASIL!\n\n` +
          `Backup:\n${backup.backup_name}\n\n` +
          `Tabel:\n${tableSummary}`
      );

      await loadBackups();
    } catch (error) {
      console.error(
        'Restore gagal:',
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat restore.';

      alert(
        `RESTORE GAGAL.\n\n${errorMessage}`
      );

      await loadBackups();
    } finally {
      setRestoringId(null);
    }
  }

  async function handleDelete(
    backup: Backup
  ) {
    const confirmed =
      window.confirm(
        `Hapus backup "${backup.backup_name}"?\n\n` +
          `File akan dihapus dari Storage dan Database.\n\n` +
          `Tindakan ini tidak dapat dibatalkan.`
      );

    if (!confirmed) return;

    setDeletingId(backup.id);

    try {
      console.log(
        'Menghapus backup:',
        backup
      );

      if (backup.storage_path) {
        const {
          error: storageError,
        } = await supabase.storage
          .from(BACKUP_BUCKET)
          .remove([
            backup.storage_path,
          ]);

        if (storageError) {
          throw new Error(
            `Gagal menghapus file Storage: ${storageError.message}`
          );
        }

        console.log(
          'File Storage berhasil dihapus.'
        );
      }

      const {
        error: databaseError,
      } = await supabase
        .from('system_backups')
        .delete()
        .eq('id', backup.id);

      if (databaseError) {
        throw new Error(
          `Gagal menghapus data database: ${databaseError.message}`
        );
      }

      console.log(
        'Metadata backup berhasil dihapus.'
      );

      alert(
        'Backup berhasil dihapus.'
      );

      await loadBackups();
    } catch (error) {
      console.error(
        'Hapus backup gagal:',
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat menghapus backup.';

      alert(
        `Gagal menghapus backup.\n\n${errorMessage}`
      );
    } finally {
      setDeletingId(null);
    }
  }

  function formatFileSize(
    bytes: number | null
  ) {
    if (!bytes || bytes === 0) {
      return '-';
    }

    if (bytes < 1024) {
      return `${bytes} Bytes`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
      return `${(
        bytes / 1024
      ).toFixed(2)} KB`;
    }

    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(2)} MB`;
  }

  function formatDate(
    dateString: string
  ) {
    return new Date(
      dateString
    ).toLocaleString(
      'id-ID',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    );
  }

  function getStatusClass(
    status: string
  ) {
    if (
      status ===
      'completed'
    ) {
      return 'bg-green-100 text-green-700';
    }

    if (
      status ===
      'restoring'
    ) {
      return 'bg-blue-100 text-blue-700';
    }

    if (
      status ===
      'restored'
    ) {
      return 'bg-purple-100 text-purple-700';
    }

    if (
      status ===
      'uploading'
    ) {
      return 'bg-blue-100 text-blue-700';
    }

    if (
      status ===
      'pending'
    ) {
      return 'bg-yellow-100 text-yellow-700';
    }

    if (
      status ===
      'failed'
    ) {
      return 'bg-red-100 text-red-700';
    }

    return 'bg-charcoal-100 text-charcoal-600';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-charcoal-800">
            Backup Sistem
          </h2>

          <p className="text-sm text-charcoal-400 mt-1">
            Buat, upload, download, restore, dan kelola file backup sistem Vixel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={
              loading ||
              uploading ||
              creatingBackup ||
              restoringId !== null
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingBackup ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}

            {creatingBackup
              ? 'Membuat Backup...'
              : 'Buat Backup'}
          </button>

          <button
            type="button"
            onClick={loadBackups}
            disabled={
              loading ||
              uploading ||
              creatingBackup ||
              restoringId !== null
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-charcoal-200 bg-white text-sm font-medium text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />

            Refresh
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="border-2 border-dashed border-charcoal-200 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-navy-50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-navy-700" />
          </div>

          <h3 className="font-semibold text-charcoal-800">
            Upload File Backup
          </h3>

          <p className="text-sm text-charcoal-400 mt-2">
            Pilih file backup dengan format ZIP.
          </p>

          <div className="mt-5">
            <label className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-navy-900 text-white text-sm font-medium cursor-pointer hover:bg-navy-800 transition-colors">
              <Upload className="w-4 h-4" />

              {uploading
                ? 'Uploading...'
                : 'Pilih File ZIP'}

              <input
                type="file"
                accept=".zip,application/zip"
                onChange={handleUpload}
                disabled={
                  uploading ||
                  creatingBackup ||
                  restoringId !== null
                }
                className="hidden"
              />
            </label>
          </div>

          {uploading && (
            <p className="text-sm text-charcoal-400 mt-4">
              Sedang mengupload dan menyimpan backup...
            </p>
          )}

          {creatingBackup && (
            <p className="text-sm text-charcoal-400 mt-4">
              Sedang mengambil data database dan membuat ZIP...
            </p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Archive className="w-5 h-5 text-navy-700" />

          <div>
            <h3 className="font-semibold text-charcoal-800">
              Riwayat Backup
            </h3>

            <p className="text-xs text-charcoal-400 mt-1">
              Daftar file backup yang tersimpan di sistem.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 mx-auto text-charcoal-300 animate-spin mb-3" />

            <p className="text-sm text-charcoal-400">
              Memuat data backup...
            </p>
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12">
            <Archive className="w-12 h-12 mx-auto text-charcoal-300 mb-4" />

            <p className="font-medium text-charcoal-700">
              Belum ada backup
            </p>

            <p className="text-sm text-charcoal-400 mt-1">
              File backup yang dibuat atau diupload akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map(
              (backup) => (
                <div
                  key={backup.id}
                  className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between p-4 rounded-xl border border-charcoal-100 hover:bg-charcoal-50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-navy-50 flex items-center justify-center">
                      <FileArchive className="w-5 h-5 text-navy-700" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-charcoal-800 truncate">
                        {backup.backup_name}
                      </p>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-charcoal-400">
                          {formatFileSize(
                            backup.file_size
                          )}
                        </span>

                        <span className="text-xs text-charcoal-400">
                          {backup.version}
                        </span>

                        <span className="text-xs text-charcoal-400">
                          {formatDate(
                            backup.created_at
                          )}
                        </span>
                      </div>

                      {!backup.storage_path && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />

                          <span className="text-xs text-yellow-600">
                            Backup lama tidak memiliki path Storage.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full font-medium ${getStatusClass(
                        backup.status
                      )}`}
                    >
                      <CheckCircle className="w-4 h-4" />

                      {backup.status}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          backup
                        )
                      }
                      disabled={
                        downloadingId ===
                          backup.id ||
                        !backup.storage_path ||
                        creatingBackup ||
                        restoringId !== null
                      }
                      title={
                        backup.storage_path
                          ? 'Download Backup'
                          : 'Path Storage tidak tersedia'
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-900 text-white text-xs font-medium hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingId ===
                      backup.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}

                      Download
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleRestore(
                          backup
                        )
                      }
                      disabled={
                        restoringId ===
                          backup.id ||
                        !backup.storage_path ||
                        deletingId ===
                          backup.id ||
                        creatingBackup ||
                        uploading ||
                        restoringId !== null
                      }
                      title={
                        backup.storage_path
                          ? 'Restore Backup'
                          : 'Path Storage tidak tersedia'
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-400 text-navy-900 text-xs font-medium hover:bg-gold-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {restoringId ===
                      backup.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}

                      {restoringId ===
                      backup.id
                        ? 'Restore...'
                        : 'Restore'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          backup
                        )
                      }
                      disabled={
                        deletingId ===
                          backup.id ||
                        restoringId !==
                          null ||
                        creatingBackup
                      }
                      title="Hapus Backup"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId ===
                      backup.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}

                      Hapus
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}