import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import type { Logger } from 'winston';

export enum DataType {
  Text,
  Data
}

export const BUCKET = 'gameday-audio';

export async function downloadFile(logger: Logger, filePath: string, bucketName: string, key: string, dataType: DataType): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const client = new S3Client({});
  logger.info(`Attempting to download ${bucketName}/${key} to ${filePath}`);

  try {
    const response = await client.send(command);
    if (!response.Body) {
      logger.error(`Unable to download ${bucketName}/${key} from S3. Body of response was empty`);
      return;
    }

    const writeStream = fs.createWriteStream(filePath);
    await new Promise<void>((resolve, reject) => {
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);

      if (dataType === DataType.Text) {
        response.Body!.transformToString().then(data => {
          writeStream.end(data);
        }).catch(reject);
      } else {
        response.Body!.transformToByteArray().then(data => {
          writeStream.end(data);
        }).catch(reject);
      }
    });

    logger.info(`${filePath} has been created!`);
  } catch (err) {
    logger.error(`Failed to write data to ${filePath}! Error: ${err}`);
    throw err;
  }
}