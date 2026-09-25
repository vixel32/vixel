import { useEffect, useState } from 'react';
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
  name: string;
  version: string;
  type: string;
  description?: string;
  minimum_version?: string;
  created_at?: string;
  author?: string;
  files: string[];
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
    if (aParts[i] > bParts[i]) return 1;
    if (aParts[i] < bParts[i]) return -1;
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
    case 'installing':
      return 'Menginstal';
    case 'installed':
      return 'Terinstal';
    case 'failed':
      return 'Gagal';
    case 'rolled_back':
      return 'Rollback';
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'uploaded':
    case 'validated':
    case 'installed':
      return 'bg-green-100 text-green-700';

    case 'validating':
    case 'installing':
      return 'bg-gold-100 text-gold-700';

    case 'failed':
    case 'rolled_back':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-charcoal-100 text-charcoal-600';
  }
}

function validateManifest(manifest: unknown): UpdateManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest.json tidak berisi object JSON yang valid.');
  }

  const data = manifest as Record<string, unknown>;

  if (typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('manifest.json tidak memiliki "name" yang valid.');
  }

  if (typeof data.version !== 'string' || !isValidVersion(data.version)) {
    throw new Error(
      'manifest.json memiliki "version" yang tidak valid. Gunakan format 1.2.0.'
    );
  }

  if (
    typeof data.type !== 'string' ||
    !VALID_UPDATE_TYPES.includes(data.type)
  ) {
    throw new Error(
      `Tipe update tidak valid. Gunakan: ${VALID_UPDATE_TYPES.join(', ')}.`
    );
  }

  if (!Array.isArray(data.files)) {
    throw new Error(
      'manifest.json harus memiliki daftar "files".'
    );
  }

  if (data.files.length === 0) {
    throw new Error(
      'Daftar "files" di manifest.json tidak boleh kosong.'
    );
  }

  if (data.files.length > MAX_ZIP_ENTRIES) {
    throw new Error(
      `Jumlah file terlalu banyak. Maksimal ${MAX_ZIP_ENTRIES} file.`
    );
  }

  const files = data.files.map((file) => {
    if (typeof file !== 'string' || !file.trim()) {
      throw new Error(
        'Semua item dalam "files" harus berupa nama/path file.'
      );
    }

    return file.trim();
  });

  return {
    name: data.name,
    version: data.version,
    type: data.type,
    description:
      typeof data.description === 'string'
        ? data.description
        : undefined,
    minimum_version:
      typeof data.minimum_version === 'string'
        ? data.minimum_version
        : undefined,
    created_at:
      typeof data.created_at === 'string'
        ? data.created_at
        : undefined,
    author:
      typeof data.author === 'string'
        ? data.author
        : undefined,
    files,
  };
}

function validateFilePath(path: string) {
  /*
   * Mencegah path traversal dan absolute path.
   */
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('../') ||
    path.includes('..\\') ||
    path.includes('\0')
  ) {
    throw new Error(
      `Path file tidak aman: ${path}`
    );
  }

  if (path.includes(':')) {
    throw new Error(
      `Path file tidak valid: ${path}`
    );
  }
}

export default function AdminSystemUpdate() {
  const [currentVersion, setCurrentVersion] =
    useState<SystemVersion | null>(null);

  const [updates, setUpdates] = useState<SystemUpdate[]>([]);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [updateType, setUpdateType] = useState('feature');

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [versionRes, updatesRes] =
      await Promise.all([
        supabase
          .from('system_versions')
          .select('*')
          .eq('status', 'active')
          .order('created_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('system_updates')
          .select('*')
          .order('created_at', {
            ascending: false,
          }),
      ]);

    if (versionRes.error) {
      setError(
        `Gagal membaca versi sistem: ${versionRes.error.message}`
      );
    }

    if (updatesRes.error) {
      setError(
        `Gagal membaca riwayat update: ${updatesRes.error.message}`
      );
    }

    setCurrentVersion(versionRes.data);

    setUpdates(
      (updatesRes.data as SystemUpdate[]) ?? []
    );

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (
    file: File | null
  ) => {
    setSelectedFile(file);
    setMessage('');
    setError('');

    if (!file) {
      setVersion('');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError(
        'File update harus berformat .zip.'
      );

      setSelectedFile(null);
      setVersion('');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        'Ukuran file terlalu besar. Maksimal 50 MB.'
      );

      setSelectedFile(null);
      setVersion('');
      return;
    }

    const detectedVersion =
      getVersionFromFilename(file.name);

    if (!detectedVersion) {
      setError(
        'Versi tidak dapat dibaca dari nama file. Gunakan format seperti vixel-update-1.2.0.zip.'
      );

      setSelectedFile(null);
      setVersion('');
      return;
    }

    setVersion(detectedVersion);
  };

  const validateZip = async (
    file: File,
    expectedVersion: string
  ) => {
    setValidating(true);

    try {
      if (!isValidVersion(expectedVersion)) {
        throw new Error(
          'Versi file tidak valid.'
        );
      }

      /*
       * Versi update harus lebih tinggi dari versi aktif.
       */
      if (currentVersion?.version) {
        const comparison = compareVersions(
          expectedVersion,
          currentVersion.version
        );

        if (comparison <= 0) {
          throw new Error(
            `Versi update ${expectedVersion} harus lebih tinggi dari versi aktif ${currentVersion.version}.`
          );
        }
      }

      /*
       * Baca ZIP.
       */
      const zip = await JSZip.loadAsync(file);

      const entries = Object.values(zip.files);

      if (entries.length === 0) {
        throw new Error(
          'Paket ZIP kosong.'
        );
      }

      if (entries.length > MAX_ZIP_ENTRIES) {
        throw new Error(
          `Paket memiliki terlalu banyak file. Maksimal ${MAX_ZIP_ENTRIES} file.`
        );
      }

      /*
       * Cari manifest.json tepat di root ZIP.
       */
      const manifestEntry = zip.files['manifest.json'];

      if (!manifestEntry || manifestEntry.dir) {
        throw new Error(
          'Paket update wajib memiliki manifest.json di root ZIP.'
        );
      }

      const manifestText =
        await manifestEntry.async('string');

      if (manifestText.length > 64 * 1024) {
        throw new Error(
          'Ukuran manifest.json terlalu besar.'
        );
      }

      let rawManifest: unknown;

      try {
        rawManifest =
          JSON.parse(manifestText);
      } catch {
        throw new Error(
          'manifest.json bukan JSON yang valid.'
        );
      }

      const manifest =
        validateManifest(rawManifest);

      /*
       * Versi manifest harus sama dengan versi filename.
       */
      if (
        manifest.version !== expectedVersion
      ) {
        throw new Error(
          `Versi manifest (${manifest.version}) berbeda dengan versi file (${expectedVersion}).`
        );
      }

      /*
       * Tipe manifest harus sama dengan pilihan admin.
       */
      if (manifest.type !== updateType) {
        throw new Error(
          `Tipe update manifest adalah "${manifest.type}", sedangkan pilihan admin adalah "${updateType}".`
        );
      }

      /*
       * Cek minimum_version.
       */
      if (
        manifest.minimum_version &&
        currentVersion?.version
      ) {
        if (
          !isValidVersion(
            manifest.minimum_version
          )
        ) {
          throw new Error(
            'minimum_version di manifest tidak valid.'
          );
        }

        const minimumComparison =
          compareVersions(
            currentVersion.version,
            manifest.minimum_version
          );

        if (minimumComparison < 0) {
          throw new Error(
            `Update membutuhkan minimal versi ${manifest.minimum_version}. Versi sistem saat ini ${currentVersion.version}.`
          );
        }
      }

      /*
       * Cek semua path dalam manifest.
       */
      const zipPaths = new Set(
        Object.keys(zip.files)
      );

      for (const path of manifest.files) {
        validateFilePath(path);

        if (!zipPaths.has(path)) {
          throw new Error(
            `File yang tercantum di manifest tidak ditemukan di ZIP: ${path}`
          );
        }
      }

      /*
       * Hitung ukuran uncompressed secara aman.
       */
      let totalUncompressedSize = 0;

      for (const entry of entries) {
        if (entry.dir) continue;

        if (
          entry.unsafeOriginalName &&
          entry.unsafeOriginalName !== entry.name
        ) {
          throw new Error(
            `ZIP memiliki path yang tidak aman: ${entry.unsafeOriginalName}`
          );
        }

        validateFilePath(entry.name);

        const data =
          await entry.async('uint8array');

        totalUncompressedSize += data.byteLength;

        if (
          totalUncompressedSize >
          MAX_UNCOMPRESSED_SIZE
        ) {
          throw new Error(
            'Ukuran hasil ekstraksi ZIP terlalu besar.'
          );
        }
      }

      return {
        manifest,
        entryCount: entries.length,
        totalUncompressedSize,
      };
    } finally {
      setValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(
        'Silakan pilih file ZIP terlebih dahulu.'
      );
      return;
    }

    if (!version) {
      setError(
        'Versi update belum valid.'
      );
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    let uploadedStoragePath = '';

    try {
      /*
       * ========================================================
       * STEP 1
       * Validasi ZIP sebelum upload.
       * ========================================================
       */

      const validation =
        await validateZip(
          selectedFile,
          version
        );

      const manifest =
        validation.manifest;

      /*
       * ========================================================
       * STEP 2
       * Bersihkan nama file.
       * ========================================================
       */

      const safeFileName =
        selectedFile.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '-'
          )
          .toLowerCase();

      const timestamp =
        Date.now();

      const storagePath =
        `updates/${version}/${timestamp}-${safeFileName}`;

      uploadedStoragePath =
        storagePath;

      /*
       * ========================================================
       * STEP 3
       * Upload ZIP ke Storage.
       * ========================================================
       */

      const {
        error: uploadError,
      } = await supabase.storage
        .from('system-updates')
        .upload(
          storagePath,
          selectedFile,
          {
            cacheControl: '3600',
            contentType: 'application/zip',
            upsert: false,
          }
        );

      if (uploadError) {
        throw new Error(
          `Upload file gagal: ${uploadError.message}`
        );
      }

      const packagePath =
        `system-updates/${storagePath}`;

      /*
       * ========================================================
       * STEP 4
       * Cek apakah versi sudah ada.
       * ========================================================
       */

      const {
        data: existingUpdate,
        error: existingError,
      } = await supabase
        .from('system_updates')
        .select('id')
        .eq('version', version)
        .maybeSingle();

      if (existingError) {
        throw new Error(
          `Gagal mengecek versi update: ${existingError.message}`
        );
      }

      /*
       * ========================================================
       * STEP 5
       * Simpan metadata + manifest.
       * ========================================================
       */

      let dbError = null;

      if (existingUpdate) {
        const result =
          await supabase
            .from('system_updates')
            .update({
              package_name:
                selectedFile.name,

              package_path:
                packagePath,

              description:
                description ||
                manifest.description ||
                null,

              update_type:
                updateType,

              manifest:
                manifest,

              status:
                'validated',

              error_message:
                null,
            })
            .eq(
              'id',
              existingUpdate.id
            );

        dbError = result.error;
      } else {
        const result =
          await supabase
            .from('system_updates')
            .insert({
              version,

              previous_version:
                currentVersion?.version ??
                null,

              update_type:
                updateType,

              description:
                description ||
                manifest.description ||
                null,

              package_name:
                selectedFile.name,

              package_path:
                packagePath,

              manifest:
                manifest,

              status:
                'validated',
            });

        dbError = result.error;
      }

      if (dbError) {
        throw new Error(
          `Gagal menyimpan data update: ${dbError.message}`
        );
      }

      /*
       * ========================================================
       * SUCCESS
       * ========================================================
       */

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
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat validasi update.';

      setError(errorMessage);

      /*
       * Jika file sudah masuk Storage tetapi database gagal,
       * hapus file tersebut agar tidak menjadi file yatim.
       */
      if (uploadedStoragePath) {
        await supabase.storage
          .from('system-updates')
          .remove([
            uploadedStoragePath,
          ]);
      }

      /*
       * Jika sudah tahu versi update, tandai database
       * sebagai failed bila record sudah ada.
       */
      if (version) {
        await supabase
          .from('system_updates')
          .update({
            status: 'failed',
            error_message:
              errorMessage,
          })
          .eq(
            'version',
            version
          );
      }

    } finally {
      setUploading(false);
      setValidating(false);
    }
  };

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
            <h2 className="font-serif text-2xl font-bold text-charcoal-800">
              System Update
            </h2>

            <p className="text-charcoal-400 text-sm mt-1">
              Kelola dan validasi paket pembaruan sistem Vixel
            </p>
          </div>

        </div>
      </div>


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
            {currentVersion?.version ??
              'Belum tersedia'}
          </p>

          {currentVersion?.description && (
            <p className="text-sm text-charcoal-500 mt-2">
              {currentVersion.description}
            </p>
          )}

          {currentVersion?.installed_at && (
            <p className="text-xs text-charcoal-400 mt-2">
              Aktif sejak{' '}
              {formatDate(
                currentVersion.installed_at
              )}
            </p>
          )}

        </div>
      </div>


      {/* SECURITY / VALIDATION INFO */}

      <div className="rounded-xl bg-green-50 border border-green-100 p-5">

        <div className="flex items-start gap-3">

          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />

          <div>

            <p className="font-semibold text-green-800 text-sm">
              Validasi Paket Aktif
            </p>

            <p className="text-sm text-green-700 mt-1">
              Setiap ZIP diperiksa terlebih dahulu sebelum
              disimpan sebagai paket tervalidasi. Sistem
              memeriksa manifest, versi, tipe update, daftar
              file, dan keamanan path.
            </p>

          </div>

        </div>

      </div>


      {/* UPLOAD */}

      <div className="card p-6">

        <div className="flex items-center gap-3 mb-6">

          <Upload className="w-5 h-5 text-navy-600" />

          <div>

            <h3 className="font-serif text-lg font-semibold text-charcoal-800">
              Upload Paket Update
            </h3>

            <p className="text-sm text-charcoal-400 mt-1">
              Paket akan divalidasi sebelum masuk ke riwayat update.
            </p>

          </div>

        </div>


        <div className="space-y-5">

          {/* FILE */}

          <div>

            <label className="block text-sm font-medium text-charcoal-700 mb-2">
              File Update
            </label>

            <label className="border-2 border-dashed border-charcoal-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-navy-300 hover:bg-navy-50/30 transition-colors">

              <FileArchive className="w-9 h-9 text-charcoal-300 mb-3" />

              {selectedFile ? (
                <>
                  <p className="font-medium text-charcoal-700 break-all">
                    {selectedFile.name}
                  </p>

                  <p className="text-xs text-charcoal-400 mt-1">
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}{' '}
                    MB
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-charcoal-600">
                    Pilih file ZIP
                  </p>

                  <p className="text-xs text-charcoal-400 mt-1">
                    Maksimal 50 MB
                  </p>
                </>
              )}

              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(e) =>
                  handleFileChange(
                    e.target.files?.[0] ??
                      null
                  )
                }
              />

            </label>

          </div>


          {/* VERSION */}

          <div>

            <label className="block text-sm font-medium text-charcoal-700 mb-2">
              Versi
            </label>

            <input
              type="text"
              value={version}
              readOnly
              placeholder="Contoh: 1.2.0"
              className="w-full px-4 py-3 rounded-xl border border-charcoal-200 bg-charcoal-50 text-charcoal-700"
            />

            <p className="text-xs text-charcoal-400 mt-1.5">
              Versi dibaca otomatis dari nama file.
            </p>

          </div>


          {/* TYPE */}

          <div>

            <label className="block text-sm font-medium text-charcoal-700 mb-2">
              Tipe Update
            </label>

            <select
              value={updateType}
              onChange={(e) =>
                setUpdateType(
                  e.target.value
                )
              }
              className="w-full px-4 py-3 rounded-xl border border-charcoal-200 bg-white text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
            >

              <option value="feature">
                Feature
              </option>

              <option value="bugfix">
                Bug Fix
              </option>

              <option value="security">
                Security
              </option>

              <option value="database">
                Database
              </option>

              <option value="maintenance">
                Maintenance
              </option>

            </select>

          </div>


          {/* DESCRIPTION */}

          <div>

            <label className="block text-sm font-medium text-charcoal-700 mb-2">
              Deskripsi Update
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              rows={4}
              placeholder="Contoh: Menambahkan fitur notifikasi pesanan..."
              className="w-full px-4 py-3 rounded-xl border border-charcoal-200 bg-white text-charcoal-700 resize-none focus:outline-none focus:ring-2 focus:ring-navy-200"
            />

          </div>


          {/* ERROR */}

          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-4">

              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />

              <p className="text-sm text-red-700">
                {error}
              </p>

            </div>
          )}


          {/* SUCCESS */}

          {message && (
            <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-100 p-4">

              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />

              <p className="text-sm text-green-700">
                {message}
              </p>

            </div>
          )}


          {/* BUTTON */}

          <button
            type="button"
            onClick={handleUpload}
            disabled={
              !selectedFile ||
              !version ||
              uploading ||
              validating
            }
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


      {/* HISTORY */}

      <div className="card p-6">

        <div className="flex items-center gap-3 mb-5">

          <Clock className="w-5 h-5 text-navy-600" />

          <h3 className="font-serif text-lg font-semibold text-charcoal-800">
            Riwayat Paket Update
          </h3>

        </div>


        {updates.length === 0 ? (
          <div className="text-center py-10">

            <Package className="w-10 h-10 text-charcoal-200 mx-auto mb-3" />

            <p className="text-sm text-charcoal-400">
              Belum ada paket update.
            </p>

          </div>
        ) : (
          <div className="space-y-3">

            {updates.map((update) => (

              <div
                key={update.id}
                className="rounded-xl border border-charcoal-100 p-4"
              >

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                  <div className="min-w-0">

                    <div className="flex items-center gap-2 flex-wrap">

                      <p className="font-semibold text-charcoal-800">
                        v{update.version}
                      </p>

                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusClass(
                          update.status
                        )}`}
                      >
                        {statusLabel(
                          update.status
                        )}
                      </span>

                    </div>


                    {update.package_name && (
                      <p className="text-sm text-charcoal-500 mt-1 break-all">
                        {update.package_name}
                      </p>
                    )}


                    {update.description && (
                      <p className="text-sm text-charcoal-400 mt-1">
                        {update.description}
                      </p>
                    )}


                    <p className="text-xs text-charcoal-400 mt-2">
                      {formatDate(
                        update.uploaded_at
                      )}
                    </p>

                  </div>


                  {update.status ===
                    'validated' && (
                    <div className="shrink-0">

                      <span className="inline-flex items-center gap-1.5 text-xs text-green-600">

                        <CheckCircle2 className="w-4 h-4" />

                        Paket valid

                      </span>

                    </div>
                  )}

                </div>


                {update.error_message && (
                  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {update.error_message}
                  </div>
                )}

              </div>

            ))}

          </div>
        )}

      </div>


      {/* STAGE INFO */}

      <div className="rounded-xl bg-gold-50 border border-gold-100 p-5">

        <p className="font-semibold text-charcoal-800 text-sm">
          Status Stage 4
        </p>

        <p className="text-sm text-charcoal-500 mt-1">
          Sistem sekarang memvalidasi manifest.json,
          versi, tipe update, daftar file, jumlah file,
          ukuran hasil ekstraksi, dan keamanan path.
          Paket yang lolos akan berstatus
          <strong> validated</strong>.
        </p>

      </div>

    </div>
  );
}