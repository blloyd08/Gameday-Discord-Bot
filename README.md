# Game Day Discord Bot

## Features

- Play a custom audio clip when a user joins a voice channel (Intro Clip)
- Command-based audio playback system
- AWS S3 integration for audio file management
- Personalized user intro clips
- General audio clip library

## Description

The Game Day Discord Bot is a Discord bot that enhances voice channel experiences by playing custom audio clips. When users join voice channels, they trigger personalized intro clips. Users can also play various audio clips using the `/audio` command.

## How It Works

1. **Auto-intro clips**: When any user joins a voice channel, the bot automatically plays their personalized intro clip
2. **Command system**: Users can play audio clips using the `/audio` command with options for:
   - `intro`: Play your personalized intro clip
   - Custom audio clips: Play pre-defined audio clips from the library

## Architecture

The bot uses a modular architecture with:
- Discord.js for Discord API integration
- @discordjs/voice for audio streaming capabilities
- AWS S3 integration for audio file management
- Winston logging system
- TypeScript for type safety

## Audio Management

Audio files are managed through:
- AWS S3 bucket (`gameday-audio`) containing audio clips
- `userAudio.json` manifest file that maps users to their intro clips and defines available audio clips
- Automatic download of audio files on bot startup
- Local storage of audio files in `src/audioClips` directory

## Periodic Jobs

The bot includes scheduled jobs for game day notifications:
- Sends reminders 24 hours before game day
- Sends notifications when game day starts
- Jobs are scheduled based on configurable time and day settings
- Notifications are sent to all configured guilds

## Installation

1. Clone the repository
2. Run `npm install` to install dependencies
3. Configure Discord bot token in environment variables
4. Start the bot with `npm start`

## Permissions

To install the bot on your Discord server, users need to:
1. Generate an OAuth2 URL with the required permissions
2. Invite the bot to their server using that URL

### Required Permissions
The bot requires the following permissions to function properly:
- **View Channels** - To see voice channels and text channels
- **Connect** - To join voice channels
- **Speak** - To play audio in voice channels
- **Read Message History** - To read messages in text channels (for command detection)
- **Send Messages** - To respond to commands
- **Use Slash Commands** - To use slash command functionality

### Permission Calculator
The bot requires a permission integer of `277028736` which includes:
- View Channels (1024)
- Connect (1024) 
- Speak (2048)
- Read Message History (32768)
- Send Messages (2048)
- Use Slash Commands (134217728)

### Installation Process
1. Get the bot's Client ID from the Discord Developer Portal
2. Visit the OAuth2 URL builder at https://discord.com/developers/docs/topics/oauth2#build-oauth2-url
3. Select the required permissions
4. Copy the generated URL
5. Visit the URL in your browser
6. Select your server from the dropdown
7. Click Authorize

## Commands

- `/audio clip:<clip_name>` - Play a specific audio clip
  - Use `intro` to play your personalized intro clip
  - Use other clip names to play general audio clips from the library

## Dependencies

- discord.js: Discord API integration
- @discordjs/voice: Audio streaming capabilities
- @aws-sdk/client-s3: AWS S3 integration
- Winston: Logging system
- node-schedule: Scheduled tasks
- ffmpeg-static: Audio processing

## Development

- Build with `npm run build`
- Lint with `npm run lint`
- Lint and fix with `npm run lint-fix`
- Deploy slash commands with `npm run deploy`
