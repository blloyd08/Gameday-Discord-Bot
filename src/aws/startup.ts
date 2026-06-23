import fs from 'fs';
import { downloadFile, BUCKET, DataType } from './download';
import type { Logger } from 'winston';
import type { AudioConfig} from '../config/audioConfig';
import { AUDIO_MANIFEST_FILE_NAME, getAudioClipFilePath, getAudioConfig, getAudioManifestFilePath } from '../config/audioConfig';

export async function initialize_audio_files(logger: Logger): Promise<AudioConfig> {
  await downloadFile(logger, getAudioManifestFilePath(), BUCKET, AUDIO_MANIFEST_FILE_NAME, DataType.Text);
  const audioConfig: AudioConfig = getAudioConfig(logger);
  await downloadMissingFiles(logger, audioConfig.getIntroClipFileNames());
  await downloadMissingFiles(logger, audioConfig.getAudioClipFileNames());
  return audioConfig;
}

async function downloadMissingFiles(logger: Logger, fileNames: string[]): Promise<void> {
  await Promise.all(fileNames.map(async fileName => {
    const filePath = getAudioClipFilePath(fileName);
    if (!fs.existsSync(filePath)) {
      const s3Key = `clips/${fileName}`;
      try {
        await downloadFile(logger, filePath, BUCKET, s3Key, DataType.Data);
      } catch {
        logger.warn(`Skipping missing audio clip: ${fileName}`);
      }
    }
  }));
}