import aws from 'aws-sdk'
import fs from 'fs'
import { Logger } from 'winston';

export const BUCKET = "gameday-audio";

export function downloadFile(logger: Logger, filePath: string, bucketName: string, key: string) {
  const params = {
    Bucket: bucketName,
    Key: key
  }
  const s3 = new aws.S3()
  return new Promise<void>((resolve, reject) => {
    logger.info(`Attempting to download ${bucketName}/${key} to ${filePath}`)
    var writeStream = fs.createWriteStream(filePath);
    s3.getObject(params, function (err, data) {
      if (err) {
        logger.error(err);
        reject(err);
      }
      writeStream.write(data.Body);
      logger.info(`${filePath} has been created!`);
      resolve();
    })
  })
}