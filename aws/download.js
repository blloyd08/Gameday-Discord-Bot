import aws from 'aws-sdk'
import fs from 'fs'

export const BUCKET = "gameday-audio";

export function downloadFile(filePath, bucketName, key) {
  const params = {
    Bucket: bucketName,
    Key: key
  }
  const s3 = new aws.S3()
  return new Promise((resolve, reject) => {
    console.log(`Attempting to download ${bucketName}/${key} to ${filePath}`)
    s3.getObject(params, (err, data) =>{
      if (err) {
        console.error(err);
        reject(err);
      }
      fs.writeFileSync(filePath, data.Body.toString(), { flag: 'w+'});
      console.log(`${filePath} has been created!`);
      resolve();
    })
  })
}