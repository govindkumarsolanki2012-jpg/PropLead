import { registerPlugin } from '@capacitor/core';

export interface CsvDownloadResult {
  success: boolean;
  canceled?: boolean;
  uri?: string;
  fileName?: string;
  error?: string;
}

export interface CsvDownloadPlugin {
  saveCsvFile(options: {
    fileName: string;
    content: string;
    mimeType?: string;
  }): Promise<CsvDownloadResult>;
}

export const CsvDownload = registerPlugin<CsvDownloadPlugin>('CsvDownload');
