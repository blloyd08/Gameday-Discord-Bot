import { existsSync, mkdirSync } from 'fs';

export function createDirectoryIfAbsent(directory: string) {
  if (!existsSync(directory)) {
    mkdirSync(directory);
  }
}