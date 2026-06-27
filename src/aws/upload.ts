import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import type { Logger } from 'winston';

export async function uploadFile(logger: Logger, filePath: string, bucket: string, key: string): Promise<void> {
    const client = new S3Client({});
    const content = readFileSync(filePath);

    logger.info(`Attempting to upload ${filePath} to ${bucket}/${key}`);

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: content,
        }));
        logger.info(`Successfully uploaded ${filePath} to ${bucket}/${key}`);
    } catch (err) {
        logger.error(`Failed to upload ${filePath} to ${bucket}/${key}: ${err}`);
        throw err;
    }
}
