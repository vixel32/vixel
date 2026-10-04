import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import {
  RefreshCw,
  Upload,
  Package,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileArchive,
  ShieldCheck,
  XCircle,
  Trash2,
  Download,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  GitBranch,
  Database,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SystemVersion {
  id: string;
  version: string;
  description: string | null;
  status: string;
  installed_at: string;
  created_at: string;
}

interface UpdateManifest {
  name?: string;
  format?: string;
  formatVersion?: string;
  version: string;
  previousVersion?: string;
  type: string;
  description?: string;
  minimum_version?: string;
  files?: string[];
  package?: {
    path: string;
    files: number;
  };
  requirements?: {
    minVersion?: string;
  };
  database?: {
    required?: boolean;
    migrations?: string[];
  };
}

interface SystemUpdate {
  id: string;
  version: string;
  previous_version: string | null;
  update_type: string;
  description: string | null;
  package_name: string | null;
  package_path: string | null;
  manifest: UpdateManifest | null;
  status: string;
  error_message: string | null;
  backup_id: string | null;
  uploaded_at: string;
  installed_at: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1000;
const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;

const VALID_UPDATE_TYPES = [
  'feature',
  'bugfix',
  'security',
  'database',
  'maintenance',
];

const SENSITIVE_FILE_PATTERNS = [
  /\.env$/i,
  /\.env\.local$/i,
  /credentials/i,
  /service-role/i,
  /secret/i,
  /password/i,
  /\.pem$/i,
  /\.key$/i,
];

const IN_PROGRESS_STATUSES = [
  'backing_up',
  'installing',
  'verifying',
  'rollback',
];

type InstallStage =
  | 'idle'
  | 'validating'
  | 'backing_up'
  | 'pending_deployment'
  | 'done'
  | 'error';

function getVersionFromFilename(filename: string) {
  const match = filename.match(
    /(?:vixel-update-|update-|v)?(\d+\.\d+\.\d+)\.zip$/i
  );
  return match?.[1] ?? '';
}

function isValidVersion(version: string) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function compareVersions(a: string, b: string) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((aParts[i] ?? 0) > (bParts[i] ?? 0)) return 1;
    if ((aParts[i] ?? 0) < (bParts[i] ?? 0)) return -1;
  }
  return 0;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusLabel(status: string) {
  switch (status) {
    case 'uploaded':
      return 'Diunggah';
    case 'validating':
      return 'Memvalidasi';
    case 'validated':
      return 'Tervalidasi';
    case 'backing_up':
      return 'Membuat Backup';
    case 'installing':
      return 'Menginstal';
    case 'verifying':
      return 'Memverifikasi';
    case 'installed':
      return 'Terinstal';
    case 'pending_deployment':
      return 'Menunggu Deployment';
    case 'failed':
      return 'Gagal';
    case 'rollback':
      return 'Rollback';
    case 'rolled_back':
      return 'Dipulihkan';
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'uploaded':
    case 'validated':
      return 'bg-blue-100 text-blue-700';
    case 'installed':
      return 'bg-green-100 text-green-700';
    case 'pending_deployment':
      return 'bg-gold-100 text-gold-700';
    case 'validating':
    case 'backing_up':
    case 'installing':
    case 'verifying':
    case 'rollback':
      return 'bg-gold-100 text-gold-700';
    case 'failed':
    case 'rolled_back':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-charcoal-100 text-charcoal-600';
  }
}

function isSensitiveFile(path: string) {
  return SENSITIVE_FILE_PATTERNS.some((p) => p.test(path));
}

function validateFilePath(path: string) {
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('../') ||
    path.includes('..\\') ||
    path.includes('\0')
  ) {
    throw new Error(`Path file tidak aman: ${path}`);
  }
  if (path.includes(':')) {
    throw new Error(`Path file tidak valid: ${path}`);
  }
  if (isSensitiveFile(path)) {
    throw new Error(`File sensitif terdeteksi: ${path}`);
  }
}

function validateManifest(manifest: unknown): UpdateManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest.json tidak berisi object JSON yang valid.');
  }

  const data = manifest as Record<string, unknown>;

  // Support both new format (vixel-update) and legacy format
  if (data.format === 'vixel-update') {
    if (
      typeof data.formatVersion !== 'string' ||
      !data.formatVersion.startsWith('1.')
    ) {
      throw new Error('formatVersion tidak didukung.');
    }
    if (typeof data.version !== 'string' || !isValidVersion(data.version)) {
      throw new Error('manifest.json memiliki "version" yang tidak valid. Gunakan format 1.2.0.');
    }
    if (typeof data.type !== 'string' || !VALID_UPDATE_TYPES.includes(data.type)) {
      throw new Error(`Tipe update tidak valid. Gunakan: ${VALID_UPDATE_TYPES.join(', ')}.`);
    }
    if (
      data.previousVersion !== undefined &&
      (typeof data.previousVersion !== 'string' || !isValidVersion(data.previousVersion))
    ) {
      throw new Error('previousVersion di manifest tidak valid.');
    }
    if (data.package !== undefined) {
      if (typeof data.package !== 'object') throw new Error('package di manifest harus berupa object.');
      const pkg = data.package as Record<string, unknown>;
      if (typeof pkg.path !== 'string' || !pkg.path.trim()) {
        throw new Error('package.path di manifest tidak valid.');
      }
    }
    return {
      format: data.format,
      formatVersion: data.formatVersion,
      version: data.version,
      previousVersion: typeof data.previousVersion === 'string' ? data.previousVersion : undefined,
      type: data.type,
      description: typeof data.description === 'string' ? data.description : undefined,
      package: data.package as UpdateManifest['package'],
      requirements: data.requirements as UpdateManifest['requirements'],
      database: data.database as UpdateManifest['database'],
    };
  }

  // Legacy format: name, version, type, files
  if (typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('manifest.json tidak memiliki "name" yang valid.');
  }
  if (typeof data.version !== 'string' || !isValidVersion(data.version)) {
    throw new Error('manifest.json memiliki "version" yang tidak valid. Gunakan format 1.2.0.');
  }
  if (typeof data.type !== 'string' || !VALID_UPDATE_TYPES.includes(data.type)) {
    throw new Error(`Tipe update tidak valid. Gunakan: ${VALID_UPDATE_TYPES.join(', ')}.`);
  }
  if (!Array.isArray(data.files) || data.files.length === 0) {
    throw new Error('manifest.json harus memiliki daftar "files" yang tidak kosong.');
  }
  if (data.files.length > MAX_ZIP_ENTRIES) {
    throw new Error(`Jumlah file terlalu banyak. Maksimal ${MAX_ZIP_ENTRIES} file.`);
  }
  const files = data.files.map((file) => {
    if (typeof file !== 'string' || !file.trim()) {
      throw new Error('Semua item dalam "files" harus berupa nama/path file.');
    }
    return file.trim();
  });
  return {
    name: data.name,
    version: data.version,
    type: data.type,
    description: typeof data.description === 'string' ? data.description : undefined,
    minimum_version: typeof data.minimum_version === 'string' ? data.minimum_version : undefined,
    files,
  };
}

const INSTALL_STAGES: { stage: InstallStage; label: string }[] = [
  { stage: 'validating', label: 'Validasi paket' },
  { stage: 'backing_up', label: 'Membuat backup Full Data' },
  { stage: 'pending_deployment', label: 'Menunggu Source Code Deployment' },
  { stage: 'done', label: 'Selesai' },
];

export default function AdminSystemUpdate() {
  const navigate = useNavigate();

  const [currentVersion, setCurrentVersion] = useState<SystemVersion | null>(null);
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [updateType, setUpdateType] = useState('feature');

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installStage, setInstallStage] = useState<InstallStage>('idle');
  const [installError, setInstallError] = useState('');
  const [installSuccess, setInstallSuccess] = useState('');
  const [showRollbackAlert, setShowRollbackAlert] = useState(false);

  const [confirmInstall, setConfirmInstall] = useState<SystemUpdate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [anyInProgress, setAnyInProgress] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const [versionRes, updatesRes] = await Promise.all([
      supabase
        .from('system_versions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('system_updates')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (versionRes.error) {
      setError(`Gagal membaca versi sistem: ${versionRes.error.message}`);
    }
    if (updatesRes.error) {
      setError(`Gagal membaca riwayat update: ${updatesRes.error.message}`);
    }

    setCurrentVersion(versionRes.data as SystemVersion | null);
    const updatesData = (updatesRes.data as SystemUpdate[]) ?? [];
    setUpdates(updatesData);

    const inProgress = updatesData.some((u) => IN_PROGRESS_STATUSES.includes(u.status));
    setAnyInProgress(inProgress);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setMessage('');
    setError('');

    if (!file) {
      setVersion('');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('File update harus berformat .zip.');
      setSelectedFile(null);
      setVersion('');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Ukuran file terlalu besar. Maksimal 50 MB.');
      setSelectedFile(null);
      setVersion('');
      return;
    }

    if (file.size === 0) {
      setError('File ZIP kosong.');
      setSelectedFile(null);
      setVersion('');
      return;
    }

    const detectedVersion = getVersionFromFilename(file.name);
    if (!detectedVersion) {
      setError('Versi tidak dapat dibaca dari nama file. Gunakan format seperti vixel-update-1.2.0.zip.');
      setSelectedFile(null);
      setVersion('');
      return;
    }

    setVersion(detectedVersion);
  };

  const validateZip = async (file: File, expectedVersion: string) => {
    if (!isValidVersion(expectedVersion)) {
      throw new Error('Versi file tidak valid.');
    }

    if (currentVersion?.version) {
      const comparison = compareVersions(expectedVersion, currentVersion.version);
      if (comparison <= 0) {
        throw new Error(
          `Versi update ${expectedVersion} harus lebih tinggi dari versi aktif ${currentVersion.version}.`
        );
      }
    }

    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);

    if (entries.length === 0) {
      throw new Error('Paket ZIP kosong.');
    }
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new Error(`Paket memiliki terlalu banyak file. Maksimal ${MAX_ZIP_ENTRIES} file.`);
    }

    const manifestEntry = zip.files['manifest.json'];
    if (!manifestEntry || manifestEntry.dir) {
      throw new Error('Paket update wajib memiliki manifest.json di root ZIP.');
    }

    const manifestText = await manifestEntry.async('string');
    if (manifestText.length > 64 * 1024) {
      throw new Error('Ukuran manifest.json terlalu besar.');
    }

    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(manifestText);
    } catch {
      throw new Error('manifest.json bukan JSON yang valid.');
    }

    const manifest = validateManifest(rawManifest);

    if (manifest.version !== expectedVersion) {
      throw new Error(
        `Versi manifest (${manifest.version}) berbeda dengan versi file (${expectedVersion}).`
      );
    }

    if (manifest.type !== updateType) {
      throw new Error(
        `Tipe update manifest adalah "${manifest.type}", sedangkan pilihan admin adalah "${updateType}".`
      );
    }

    if (manifest.minimum_version && currentVersion?.version) {
      if (!isValidVersion(manifest.minimum_version)) {
        throw new Error('minimum_version di manifest tidak valid.');
      }
      if (compareVersions(currentVersion.version, manifest.minimum_version) < 0) {
        throw new Error(
          `Update membutuhkan minimal versi ${manifest.minimum_version}. Versi sistem saat ini ${currentVersion.version}.`
        );
      }
    }

    const zipPaths = new Set(Object.keys(zip.files));

    if (manifest.files) {
      for (const path of manifest.files) {
        validateFilePath(path);
        if (!zipPaths.has(path)) {
          throw new Error(`File yang tercantum di manifest tidak ditemukan di ZIP: ${path}`);
        }
      }
    }

    let totalUncompressedSize = 0;
    for (const entry of entries) {
      if (entry.dir) continue;

      if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) {
        throw new Error(`ZIP memiliki path yang tidak aman: ${entry.unsafeOriginalName}`);
      }

      validateFilePath(entry.name);

      const data = await entry.async('uint8array');
      totalUncompressedSize += data.byteLength;

      if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
        throw new Error('Ukuran hasil ekstraksi ZIP terlalu besar.');
      }
    }

    return { manifest, entryCount: entries.length, totalUncompressedSize };
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Silakan pilih file ZIP terlebih dahulu.');
      return;
    }
    if (!version) {
      setError('Versi update belum valid.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    let uploadedStoragePath = '';

    try {
      const validation = await validateZip(selectedFile, version);
      const manifest = validation.manifest;

      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
      const timestamp = Date.now();
      const storagePath = `updates/${version}/${timestamp}-${safeFileName}`;
      uploadedStoragePath = storagePath;

      const { error: uploadError } = await supabase.storage
        .from('system-updates')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          contentType: 'application/zip',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload file gagal: ${uploadError.message}`);
      }

      const packagePath = `system-updates/${storagePath}`;

      const { data: existingUpdate, error: existingError } = await supabase
        .from('system_updates')
        .select('id')
        .eq('version', version)
        .maybeSingle();

      if (existingError) {
        throw new Error(`Gagal mengecek versi update: ${existingError.message}`);
      }

      let dbError = null;

      if (existingUpdate) {
        const result = await supabase
          .from('system_updates')
          .update({
            package_name: selectedFile.name,
            package_path: packagePath,
            description: description || manifest.description || null,
            update_type: updateType,
            manifest: manifest,
            status: 'validated',
            error_message: null,
          })
          .eq('id', existingUpdate.id);
        dbError = result.error;
      } else {
        const result = await supabase
          .from('system_updates')
          .insert({
            version,
            previous_version: currentVersion?.version ?? null,
            update_type: updateType,
            description: description || manifest.description || null,
            package_name: selectedFile.name,
            package_path: packagePath,
            manifest: manifest,
            status: 'validated',
          });
        dbError = result.error;
      }

      if (dbError) {
        throw new Error(`Gagal menyimpan data update: ${dbError.message}`);
      }

      setMessage(
        `Paket v${version} berhasil divalidasi dan disimpan. ${validation.entryCount} file ditemukan.`
      );

      setSelectedFile(null);
      setVersion('');
      setDescription('');
      setUpdateType('feature');

      await loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Terjadi kesalahan saat validasi update.';
      setError(errorMessage);

      if (uploadedStoragePath) {
        await supabase.storage.from('system-updates').remove([uploadedStoragePath]);
      }

      if (version) {
        await supabase
          .from('system_updates')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('version', version);
      }
    } finally {
      setUploading(false);
      setValidating(false);
    }
  };

  const handleInstall = async (update: SystemUpdate) => {
    setConfirmInstall(null);
    setInstallingId(update.id);
    setInstallStage('validating');
    setInstallError('');
    setInstallSuccess('');
    setShowRollbackAlert(false);

    try {
      const { data, error } = await supabase.functions.invoke('install-update', {
        body: { updateId: update.id },
      });

      if (error) {
        throw new Error(error.message || 'Gagal menjalankan install update.');
      }

      if (!data) {
        throw new Error('Respons tidak valid dari server.');
      }

      const status = data.status as string;

      // Map status to stage
      if (status === 'pending_deployment') {
        setInstallStage('done');
        setInstallSuccess(data.message || 'Paket tervalidasi dan backup telah dibuat. Menunggu source code deployment.');
      } else if (status === 'installed') {
        setInstallStage('done');
        setInstallSuccess(data.message || 'Update berhasil diinstall.');
      } else if (status === 'rolled_back') {
        setInstallStage('error');
        setInstallError(data.message || 'Update gagal. Sistem telah dipulihkan ke kondisi sebelum update.');
      } else if (status === 'rollback_failed') {
        setInstallStage('error');
        setInstallError(
          data.message ||
            'Update dan pemulihan otomatis gagal. Silakan lakukan Restore manual menggunakan backup sebelum update.'
        );
        setShowRollbackAlert(true);
      } else if (status === 'failed') {
        setInstallStage('error');
        setInstallError(data.message || 'Update gagal.');
      } else {
        setInstallStage('error');
        setInstallError(data.message || `Status tidak diketahui: ${status}`);
      }
    } catch (err) {
      setInstallStage('error');
      setInstallError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat install update.'
      );
    } finally {
      setInstallingId(null);
      await loadData();
    }
  };

  const handleDeleteUpdate = async (update: SystemUpdate) => {
    setDeletingId(update.id);

    try {
      if (update.package_path) {
        const bucketPath = update.package_path.startsWith('system-updates/')
          ? update.package_path.substring('system-updates/'.length)
          : update.package_path;

        await supabase.storage.from('system-updates').remove([bucketPath]);
      }

      const { error: dbError } = await supabase
        .from('system_updates')
        .delete()
        .eq('id', update.id);

      if (dbError) {
        throw new Error(`Gagal menghapus data update: ${dbError.message}`);
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus paket update.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPackage = async (update: SystemUpdate) => {
    if (!update.package_path) return;

    try {
      const bucketPath = update.package_path.startsWith('system-updates/')
        ? update.package_path.substring('system-updates/'.length)
        : update.package_path;

      const { data, error: dlError } = await supabase.storage
        .from('system-updates')
        .download(bucketPath);

      if (dlError || !data) {
        throw new Error('Gagal mengunduh paket update.');
      }

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = update.package_name || `update-${update.version}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh.');
    }
  };

  const isInstallInProgress = installingId !== null;
  const isUpdateLocked = (status: string) => IN_PROGRESS_STATUSES.includes(status);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-navy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-900 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-charcoal-800">System Update</h2>
            <p className="text-charcoal-400 text-sm mt-1">
              Kelola dan instal paket pembaruan sistem Vixel
            </p>
          </div>
        </div>
      </div>

      {/* CURRENT VERSION + UPDATE PACKAGE SIDE BY SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CURRENT VERSION */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Package className="w-5 h-5 text-navy-600" />
            <h3 className="font-serif text-lg font-semibold text-charcoal-800">
              Versi Sistem Saat Ini
            </h3>
          </div>
          <div className="rounded-xl bg-cream-100 p-5">
            <p className="text-3xl font-bold text-navy-900">
              v{currentVersion?.version ?? 'Belum tersedia'}
            </p>
            {currentVersion?.description && (
              <p className="text-sm text-charcoal-500 mt-2">{currentVersion.description}</p>
            )}
            {currentVersion?.installed_at && (
              <p className="text-xs text-charcoal-400 mt-2">
                Aktif sejak {formatDate(currentVersion.installed_at)}
              </p>
            )}
          </div>
        </div>

        {/* LATEST UPDATE PACKAGE */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-5 h-5 text-navy-600" />
            <h3 className="font-serif text-lg font-semibold text-charcoal-800">
              Paket Update Terbaru
            </h3>
          </div>
          <div className="rounded-xl bg-cream-100 p-5">
            {updates.length > 0 ? (
              <>
                <p className="text-3xl font-bold text-navy-900">v{updates[0].version}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusClass(updates[0].status)}`}
                  >
                    {statusLabel(updates[0].status)}
                  </span>
                  <span className="text-xs text-charcoal-400">
                    {updates[0].update_type}
                  </span>
                </div>
                {updates[0].description && (
                  <p className="text-sm text-charcoal-500 mt-2">{updates[0].description}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-charcoal-400">Belum ada paket update.</p>
            )}
          </div>
        </div>
      </div>

      {/* SECURITY INFO */}
      <div className="rounded-xl bg-green-50 border border-green-100 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Validasi Paket Aktif</p>
            <p className="text-sm text-green-700 mt-1">
              Setiap ZIP diperiksa di frontend dan server sebelum diinstall. Sistem memeriksa
              manifest, versi, tipe update, daftar file, keamanan path, dan mencegah downgrade.
              Backup Full Data (Database + Storage) dibuat otomatis sebelum setiap update.
            </p>
          </div>
        </div>
      </div>

      {/* SOURCE CODE STATUS */}
      <div className="rounded-xl bg-charcoal-50 border border-charcoal-100 p-4">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-charcoal-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-charcoal-700">Source Code Versioning</p>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Belum terhubung. Update dan backup saat ini mencakup Database + Storage. Source code versioning dapat diaktifkan di masa depan melalui integrasi repository yang aman.
            </p>
          </div>
        </div>
      </div>

      {/* UPLOAD */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Upload className="w-5 h-5 text-navy-600" />
          <div>
            <h3 className="font-serif text-lg font-semibold text-charcoal-800">Upload Paket Update</h3>
            <p className="text-sm text-charcoal-400 mt-1">
              Paket akan divalidasi sebelum masuk ke riwayat update.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* FILE */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">File Update</label>
            <label
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                anyInProgress
                  ? 'border-charcoal-200 opacity-50 cursor-not-allowed'
                  : 'border-charcoal-200 hover:border-navy-300 hover:bg-navy-50/30'
              }`}
            >
              <FileArchive className="w-9 h-9 text-charcoal-300 mb-3" />
              {selectedFile ? (
                <>
                  <p className="font-medium text-charcoal-700 break-all">{selectedFile.name}</p>
                  <p className="text-xs text-charcoal-400 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-charcoal-600">Pilih file ZIP</p>
                  <p className="text-xs text-charcoal-400 mt-1">Maksimal 50 MB</p>
                </>
              )}
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                disabled={anyInProgress || uploading}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* VERSION */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Versi</label>
            <input
              type="text"
              value={version}
              readOnly
              placeholder="Contoh: 1.2.0"
              className="w-full px-4 py-3 rounded-xl border border-charcoal-200 bg-charcoal-50 text-charcoal-700"
            />
            <p className="text-xs text-charcoal-400 mt-1.5">Versi dibaca otomatis dari nama file.</p>
          </div>

          {/* TYPE */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">Tipe Update</label>
            <select
              value={updateType}
              onChange={(e) => setUpdateType(e.target.value)}
              disabled={anyInProgress || uploading}
              className="w-full px-4 py-3 rounded-xl border border-charcoal-200 bg-white text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
            >
              <option value="feature">Feature</option>
              <option value="bugfix">Bug Fix</option>
              <option value="security">Security</option>
              <option value="database">Database</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-2">
              Deskripsi Update
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={anyInProgress || uploading}
              placeholder="Contoh: Menambahkan fitur notifikasi pesanan..."
              className="w-full px-4 py-3 rounded-xl border border-charcoal-200 bg-white text-charcoal-700 resize-none focus:outline-none focus:ring-2 focus:ring-navy-200"
            />
          </div>

          {/* ERROR */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-4">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* SUCCESS */}
          {message && (
            <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-100 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}

          {/* BUTTON */}
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || !version || uploading || validating || anyInProgress}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-navy-900 text-white font-medium hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {validating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Memvalidasi ZIP...
              </>
            ) : uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Mengupload...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Validasi & Upload
              </>
            )}
          </button>
        </div>
      </div>

      {/* INSTALL PROGRESS */}
      {isInstallInProgress && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <RefreshCw className="w-5 h-5 text-navy-600 animate-spin" />
            <h3 className="font-serif text-lg font-semibold text-charcoal-800">
              Sedang Menginstall Update
            </h3>
          </div>
          <div className="space-y-3">
            {INSTALL_STAGES.map((s, idx) => {
              const currentIdx = INSTALL_STAGES.findIndex((x) => x.stage === installStage);
              const isDone = idx < currentIdx;
              const isActive = idx === currentIdx;

              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-green-100 text-green-600'
                        : isActive
                          ? 'bg-navy-100 text-navy-600'
                          : 'bg-charcoal-100 text-charcoal-300'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isActive ? (
                      <div className="w-3 h-3 border-2 border-navy-400 border-t-navy-600 rounded-full animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-charcoal-300" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      isDone
                        ? 'text-green-700 font-medium'
                        : isActive
                          ? 'text-navy-700 font-medium'
                          : 'text-charcoal-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INSTALL RESULT — SUCCESS */}
      {installSuccess && !isInstallInProgress && (
        <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-100 p-5">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Paket Tervalidasi</p>
            <p className="text-sm text-green-700 mt-1">{installSuccess}</p>
            <p className="text-xs text-green-600 mt-2">
              Catatan: Source code website belum berubah. Deploy paket melalui repository/deployment system untuk menyelesaikan update.
            </p>
          </div>
        </div>
      )}

      {/* INSTALL RESULT — ERROR */}
      {installError && !isInstallInProgress && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800 text-sm">Update Gagal</p>
              <p className="text-sm text-red-700 mt-1">{installError}</p>
            </div>
          </div>

          {showRollbackAlert && (
            <div className="flex items-start gap-3 rounded-xl bg-gold-50 border border-gold-200 p-5">
              <AlertTriangle className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-gold-800 text-sm">Pemulihan Manual Diperlukan</p>
                <p className="text-sm text-gold-700 mt-1 mb-3">
                  Update dan rollback otomatis gagal. Silakan lakukan Restore manual menggunakan
                  backup yang dibuat sebelum update.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/admin/backup')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-400 text-navy-900 text-sm font-medium hover:bg-gold-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buka Backup & Restore
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Clock className="w-5 h-5 text-navy-600" />
          <h3 className="font-serif text-lg font-semibold text-charcoal-800">Riwayat Paket Update</h3>
        </div>

        {updates.length === 0 ? (
          <div className="text-center py-10">
            <Package className="w-10 h-10 text-charcoal-200 mx-auto mb-3" />
            <p className="text-sm text-charcoal-400">Belum ada paket update.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {updates.map((update) => {
              const locked = isUpdateLocked(update.status) || isInstallInProgress;
              const canInstall = update.status === 'validated' && !locked && !anyInProgress;
              const canDelete =
                !locked &&
                !anyInProgress &&
                update.status !== 'installed';
              const isPendingDeployment = update.status === 'pending_deployment';

              return (
                <div
                  key={update.id}
                  className="rounded-xl border border-charcoal-100 p-4 hover:bg-charcoal-50/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-charcoal-800">v{update.version}</p>
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusClass(update.status)}`}
                        >
                          {statusLabel(update.status)}
                        </span>
                        <span className="text-xs text-charcoal-400">
                          {update.update_type}
                        </span>
                      </div>

                      {update.package_name && (
                        <p className="text-sm text-charcoal-500 mt-1 break-all">
                          {update.package_name}
                        </p>
                      )}

                      {update.description && (
                        <p className="text-sm text-charcoal-400 mt-1">{update.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-charcoal-400">
                        <span>Upload: {formatDate(update.uploaded_at)}</span>
                        {update.installed_at && (
                          <span>Instal: {formatDate(update.installed_at)}</span>
                        )}
                        {update.previous_version && (
                          <span>Dari: v{update.previous_version}</span>
                        )}
                      </div>

                      {update.backup_id && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-navy-600">
                          <Database className="w-3.5 h-3.5" />
                          <span>Pre-Update Backup: {update.backup_id.substring(0, 8)}...</span>
                        </div>
                      )}

                      {isPendingDeployment && (
                        <div className="mt-2 rounded-lg bg-gold-50 border border-gold-100 px-3 py-2">
                          <div className="flex items-center gap-2 text-xs text-gold-700">
                            <GitBranch className="w-3.5 h-3.5 shrink-0" />
                            <span>Source Code Deployment belum terhubung. Source code website belum berubah. Deploy paket melalui repository/deployment system.</span>
                          </div>
                        </div>
                      )}

                      {update.error_message && (
                        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                          {update.error_message}
                        </div>
                      )}
                    </div>

                    {/* ACTIONS */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canInstall && (
                        <button
                          type="button"
                          onClick={() => setConfirmInstall(update)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-medium hover:bg-navy-800 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Install Update
                        </button>
                      )}

                      {update.status === 'installed' && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Terinstal
                        </span>
                      )}

                      {locked && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gold-600">
                          <div className="w-3 h-3 border-2 border-gold-400 border-t-gold-600 rounded-full animate-spin" />
                          Memproses...
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadPackage(update)}
                        disabled={!update.package_path || locked}
                        title="Download Paket"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-charcoal-50 text-charcoal-600 text-xs font-medium hover:bg-charcoal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus paket update v${update.version}?\nFile akan dihapus dari Storage dan database.`)) {
                              handleDeleteUpdate(update);
                            }
                          }}
                          disabled={deletingId === update.id}
                          title="Hapus Paket"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {deletingId === update.id ? (
                            <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIRM INSTALL MODAL */}
      {confirmInstall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50"
          onClick={() => setConfirmInstall(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-navy-600" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-charcoal-800">
                Validasi & Backup Update
              </h3>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-center py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Versi saat ini:</span>
                <span className="font-semibold text-charcoal-800">
                  v{currentVersion?.version ?? '1.0.0'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-charcoal-100">
                <span className="text-sm text-charcoal-500">Versi baru:</span>
                <span className="font-semibold text-navy-700">v{confirmInstall.version}</span>
              </div>
              <div className="rounded-xl bg-cream-100 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-charcoal-600">
                  <Database className="w-3.5 h-3.5 text-navy-500" />
                  Backup Full Data (Database + Storage) akan dibuat sebelum update.
                </div>
                <div className="flex items-center gap-2 text-xs text-charcoal-400">
                  <GitBranch className="w-3.5 h-3.5" />
                  Source Code Deployment belum terhubung. Source code website tidak akan berubah dari proses ini.
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmInstall(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-charcoal-200 text-charcoal-700 text-sm font-medium hover:bg-charcoal-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleInstall(confirmInstall)}
                className="flex-1 px-4 py-3 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 transition-colors"
              >
                Mulai Validasi & Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
