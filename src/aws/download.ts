import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from 'fs';
import { Logger } from 'winston';

export enum DataType {
  Text,
  Data
}

export const BUCKET = "gameday-audio";

export async function downloadFile(logger: Logger, filePath: string, bucketName: string, key: string, dataType: DataType) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  const client = new S3Client({});
  logger.info(`Attempting to download ${bucketName}/${key} to ${filePath}`);
  const writeStream = fs.createWriteStream(filePath);
  try {
    const response = await client.send(command);
    if (!response.Body) {
      logger.error(`Unable to download ${bucketName}/${key} from S3. Body of response was empty`);
      return;
    }

    if (dataType === DataType.Text) {
      const data = await response.Body.transformToString();
      writeStream.write(data);
    } else {
      const data = await response.Body.transformToByteArray();
      writeStream.write(data);
    }
    logger.info(`${filePath} has been created!`);
  } catch (err) {
    logger.error(`Failed to write data to ${filePath}! Error: ${err}`);
  }
}