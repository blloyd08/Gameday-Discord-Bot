import fs from 'fs';
import { downloadFile, BUCKET, DataType } from './download';
import { Logger } from 'winston';
import { AudioConfig, AUDIO_MANIFEST_FILE_NAME, getAudioClipFilePath, getAudioConfig, getAudioManifestFilePath } from '../config/audioConfig';

export async function initialize_audio_files(logger: Logger): Promise<AudioConfig> {
  // download json file
  return downloadFile(logger, getAudioManifestFilePath(), BUCKET, AUDIO_MANIFEST_FILE_NAME, DataType.Text).then(() =>{
    const audioConfig: AudioConfig = getAudioConfig(logger);
    return audioConfig
  }).then((audioConfig) =>{
    downloadMissingFiles(logger, audioConfig.getIntroClipFileNames());
    return audioConfig;
  }).then((audioConfig) => {
    downloadMissingFiles(logger, audioConfig.getAudioClipFileNames());
    return Promise.resolve(audioConfig);
  }).catch(e =>{
    logger.error("Error downloading audio files", e);
    return Promise.reject(e);
  })
}

function downloadMissingFiles(logger: Logger, fileNames: string[]){
  fileNames.forEach(fileName => {
    const filePath = getAudioClipFilePath(fileName);
    if (!fs.existsSync(filePath)){
      const s3Key = `clips/${fileName}`;
      downloadFile(logger, filePath, BUCKET, s3Key, DataType.Data);
    }

  })

}