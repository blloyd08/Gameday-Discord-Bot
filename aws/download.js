import aws from 'aws-sdk'
import fs, { write } from 'fs'

export const BUCKET = "gameday-audio";

export function downloadFile(filePath, bucketName, key) {
  const params = {
    Bucket: bucketName,
    Key: key
  }
  const s3 = new aws.S3()
  return new Promise((resolve, reject) => {
    console.log(`Attempting to download ${bucketName}/${key} to ${filePath}`)
    var writeStream = fs.createWriteStream(filePath);
    s3.getObject(params, function (err, data) {
      if (err) {
        console.error(err);
        reject(err);
      }
      writeStream.write(data.Body);
      console.log(`${filePath} has been created!`);
      resolve();
    })
  })
}