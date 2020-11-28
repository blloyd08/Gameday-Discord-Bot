import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, 'audioClips', 'userAudio.json');

export const AudioConfigPath = jsonPath

export function getAudioConfig() {
  let userAudioConfig = JSON.parse(readFileSync(jsonPath));
  return userAudioConfig;
}

export function getAudioFilePath(fileName) {
  return path.join(__dirname, 'audioClips', fileName)
}

export function deleteMessage(message, timeoutMillis) {
  if (message.deletable){
    message.delete({ timeout: 5000 });
  }
}