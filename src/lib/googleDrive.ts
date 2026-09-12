let pickerApiLoaded = false;
let gsiLoaded = false;
let accessToken: string | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureGapiLoaded(): Promise<void> {
  if (pickerApiLoaded && typeof window.gapi !== 'undefined' && window.gapi.picker) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => {
    window.gapi.load('picker', { callback: () => { pickerApiLoaded = true; resolve(); } });
  });
}

async function ensureGsiLoaded(): Promise<void> {
  if (gsiLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gsiLoaded = true;
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (accessToken) {
      resolve(accessToken);
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        accessToken = resp.access_token;
        resolve(accessToken);
      },
    });
    tokenClient.requestAccessToken();
  });
}

interface PickerConfig {
  apiKey: string;
  clientId: string;
  appId: string;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_GOOGLE_CLIENT_ID &&
    import.meta.env.VITE_GOOGLE_API_KEY &&
    import.meta.env.VITE_GOOGLE_APP_ID
  );
}

export interface DriveFile {
  id: string;
  url: string;
  name: string;
  isVideo: boolean;
}

export async function pickFromGoogleDrive(
  config: PickerConfig,
  multiple: boolean = true,
  allowVideo: boolean = false
): Promise<DriveFile[]> {
  await ensureGapiLoaded();
  await ensureGsiLoaded();
  const token = await getAccessToken(config.clientId);

  return new Promise((resolve, reject) => {
    const views: any[] = [
      new window.google.picker.View(window.google.picker.ViewId.DOCS_IMAGES),
    ];
    if (allowVideo) {
      views.push(new window.google.picker.View(window.google.picker.ViewId.VIDEOS));
    }

    let builder = new window.google.picker.PickerBuilder()
      .setAppId(config.appId)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const files: DriveFile[] = data.docs.map((doc: any) => {
            const isVideo = doc.type === 'video';
            return {
              id: doc.id,
              name: doc.name,
              url: isVideo
                ? `https://drive.google.com/file/d/${doc.id}/preview`
                : `https://drive.google.com/thumbnail?id=${doc.id}&sz=w1000`,
              isVideo,
            };
          });
          resolve(files);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([]);
        }
      });

    views.forEach((view) => { builder = builder.addView(view); });

    if (!multiple) {
      builder = builder.setMaxItems(1);
    }

    builder.build().setVisible(true);
  });
}
