import fs from 'fs'
import { downloadFile, BUCKET } from './download.js'
import { getAudioConfig, getAudioFilePath, AudioConfigPath } from '../util.js'


export function initialize_audio_files(){
  // download json file
  downloadFile(AudioConfigPath, BUCKET, 'userAudio.json').then(() =>{
    let audioConfig = getAudioConfig();
    console.log(audioConfig);
    return audioConfig
  }).then((audioConfig) =>{
    downloadMissingFiles(audioConfig, "users");
    return audioConfig;
  }).then((audioConfig) => {
    downloadMissingFiles(audioConfig, "clips");
  }).catch(e =>{
    console.error("Error downloading audio files", e);
  })
  
}


function downloadMissingFiles(audioConfig, configKey){
  let keys = Object.keys(audioConfig[configKey]);
  keys.forEach(key => {
    let fileName = audioConfig[configKey][key];
    let filePath = getAudioFilePath(fileName);
    if (!fs.existsSync(filePath)){
      // download missing file
      let s3Key = `clips/${fileName}`
      downloadFile(filePath, BUCKET, s3Key)
    }

  })

}