export function formatPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(price);
}

export function normalizePhone(phone: string): string {
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('0')) {
    p = '62' + p.slice(1);
  } else if (p.startsWith('8')) {
    p = '62' + p;
  } else if (!p.startsWith('62')) {
    p = '62' + p;
  }
  return p;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

const DRIVE_FILE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  /\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
];

export function extractGoogleDriveId(url: string): string | null {
  for (const pattern of DRIVE_FILE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

export function normalizeImageUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
  }
  return url;
}

export function isGoogleDriveVideo(url: string): boolean {
  return isGoogleDriveUrl(url) && (url.includes('/file/d/') || url.includes('?id=') || url.includes('/d/'));
}

export function getGoogleDriveEmbedUrl(url: string): string {
  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }
  return url;
}
