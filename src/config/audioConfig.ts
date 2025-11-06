import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Logger } from 'winston';
import { createDirectoryIfAbsent } from '../util/util';

const AUDIO_CLIP_FOLDER_PATH = path.join(__dirname, '..', 'audioClips');
export const AUDIO_MANIFEST_FILE_NAME = 'userAudio.json';
const AUDIO_MANIFEST_FILE_PATH: string = path.join(AUDIO_CLIP_FOLDER_PATH, AUDIO_MANIFEST_FILE_NAME);
const INTRO_CLIPS_KEY = 'users';
const CLIPS_KEY = 'clips';

export function getAudioManifestFilePath(): string {
    createDirectoryIfAbsent(AUDIO_CLIP_FOLDER_PATH);
    return AUDIO_MANIFEST_FILE_PATH;
}

export function getAudioClipFilePath(fileName: string): string {  
    return path.join(AUDIO_CLIP_FOLDER_PATH, fileName);
}

export class AudioConfig {
    constructor(
        // Example: "124345926503499999": "124345926503499999-ahh.mp3"
        public readonly users: Map<string, string>,
        // Example: "hello": "hello.mp3"
        public readonly clips: Map<string, string>,
    ) {}

    static fromSerialized(serialized: string): AudioConfig {
        const jsonObject: AudioConfig = JSON.parse(serialized);

        if (!jsonObject.users) {
            throw new Error('`users` in audio config is a required field');
        }
        if (!jsonObject.users) {
            throw new Error('`clips` in audio config is a required field');
        }

        // JSON.parse does not properly parse into a Map object. Rebuild map.
        const usersMap = new Map<string, string>();
        const usersArray = Object.keys(jsonObject[INTRO_CLIPS_KEY]) as Array<keyof typeof jsonObject.users>;
        usersArray.forEach(userId => {
            usersMap.set(userId.toString(), jsonObject[INTRO_CLIPS_KEY][userId].toString());
        });

        const clipsMap = new Map<string, string>();
        const clipsArray = Object.keys(jsonObject[CLIPS_KEY]) as Array<keyof typeof jsonObject.clips>;
        clipsArray.forEach(clipName => {
            clipsMap.set(clipName.toString(), jsonObject[CLIPS_KEY][clipName].toString());
        });

        return new AudioConfig(
            usersMap,
            clipsMap,
        );
    }

    public getAudioClipNames(): string[] {
        return Array.from(this.clips.keys());
    }

    public getAudioClipFileNames(): string[] {
        return Array.from(this.clips.values());
    }

    public getIntroClipFileNames(): string[] {
        return Array.from(this.users.values());
    }
}

export function getAudioConfig(logger: Logger): AudioConfig {
    logger.info(`Reading audio config from: ${AUDIO_MANIFEST_FILE_PATH}`);
    if (existsSync(AUDIO_MANIFEST_FILE_PATH)) {
        const audioConfigJson: string = readFileSync(AUDIO_MANIFEST_FILE_PATH, {encoding:'utf8', flag:'r'}).toString();
        const audioConfig: AudioConfig = AudioConfig.fromSerialized(audioConfigJson);
        
        if (!audioConfig.clips) {
            throw Error('No audio clips found in audio config');
        }
        if (!audioConfig.users) {
            throw Error('No user intro clips found in audio config');
        }
        
        logger.info(`Intro Clips Found: ${audioConfig.getIntroClipFileNames().join(',')}  Audio Clips Found: ${audioConfig.getAudioClipFileNames().join(',')}`);
        return audioConfig;
    } else {
        throw Error(`AudioConfig doesn't exist at ${AUDIO_MANIFEST_FILE_PATH}`);
    }
}
