/// <reference types="vite/client" />

interface GooglePickerOptions {
  apiKey: string;
  clientId: string;
  appId: string;
}

interface GooglePickerFile {
  url: string;
  name: string;
  isVideo: boolean;
}

declare global {
  interface Window {
    google?: any;
    gapi?: any;
    googleDrivePicker?: (options: GooglePickerOptions, multiple: boolean, allowVideo: boolean) => Promise<GooglePickerFile[]>;
  }
}

export {};

