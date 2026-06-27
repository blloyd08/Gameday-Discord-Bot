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

Each guild can configure independent scheduled jobs via `/guild_admin configure_message_job` or `/guild_admin configure_audio_job`. All job changes require bot owner approval before taking effect. Jobs are stored in `appConfig.json` in S3 and reloaded after each approved change.

## Configuration

### Prerequisites

Enable **Developer Mode** in Discord before collecting IDs: Settings → Advanced → Developer Mode. Once enabled, right-clicking any user, server, channel, or role reveals a "Copy ID" option.

### `appConfig.json`

Create this file and upload it to your S3 bucket before starting the bot. The bot downloads it on startup.

```json
{
  "logLevel": "info",
  "clientId": "<discord-bot-client-id>",
  "ownerId": "<your-discord-user-id>",
  "auth": {
    "discord": "<discord-bot-token>"
  },
  "guilds": {
    "<guild-id>": {
      "botAdminRoleId": "<role-id>",
      "jobs": {
        "<job-name>": {
          "type": "message",
          "dayOfWeek": 3,
          "hour": 19,
          "minute": 0,
          "channelId": "<text-channel-id>",
          "message": "Your message here"
        },
        "<job-name>": {
          "type": "audio",
          "dayOfWeek": 3,
          "hour": 19,
          "minute": 0,
          "voiceChannelId": "<voice-channel-id>",
          "clipFileName": "<filename.mp3>"
        }
      }
    }
  }
}
```

**Field reference:**

| Field | Where to find it |
|---|---|
| `logLevel` | One of: `error`, `warn`, `info`, `debug` |
| `clientId` | Discord Developer Portal → Your Application → General Information → Application ID |
| `ownerId` | Right-click your username in Discord → Copy User ID |
| `auth.discord` | Discord Developer Portal → Your Application → Bot → Token |
| `guilds` key | Right-click a server name in Discord → Copy Server ID |
| `botAdminRoleId` | Optional. Server Settings → Roles → right-click the role → Copy Role ID |
| `jobs` key | A name you choose to identify the job (e.g. `"gameday"`, `"pre-gameday"`) |
| `type` | `message` to send a text message, `audio` to play an audio clip |
| `dayOfWeek` | 0 = Sunday, 1 = Monday … 6 = Saturday |
| `hour` | Hour in 24h format (e.g. `19` = 7 PM) |
| `minute` | Minute (0–59) |
| `channelId` | Message jobs only — right-click a text channel → Copy Channel ID |
| `message` | Message jobs only — text to send (supports Discord markdown and role mentions) |
| `voiceChannelId` | Audio jobs only — right-click a voice channel → Copy Channel ID |
| `clipFileName` | Audio jobs only — file name of the clip in S3 (e.g. `intro.mp3`) |

> **Never commit `appConfig.json` to version control.** It contains your Discord bot token.

### `userAudio.json`

Create this file and upload it to your S3 bucket. It defines available audio clips and global user intro clip assignments.

```json
{
  "clips": {
    "<clip-name>": "<filename.mp3>"
  },
  "users": {
    "<discord-user-id>": "<filename.mp3>"
  }
}
```

Audio clip files (`.mp3`) must also be uploaded to the same S3 bucket.

### S3 Bucket Setup

1. Create an S3 bucket (the bot uses `gameday-audio` by default)
2. Upload `appConfig.json` and `userAudio.json` to the bucket root
3. Upload all audio clip `.mp3` files to the bucket root
4. Configure AWS credentials on the host machine so the bot can access the bucket (`~/.aws/credentials` or environment variables)

---

## Installation

1. Clone the repository
2. Run `npm install` to install dependencies
3. Complete the Configuration steps above
4. Build with `npm run build`
5. Deploy slash commands with `npm run deploy`
6. Start the bot with `npm start`

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
- **Move Members** - To move members between voice channels (required for `/shuffle move`)

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

## Approval Workflows

Several actions require bot owner approval before taking effect. When an action is submitted, the bot sends the owner a DM with **Approve** and **Deny** buttons. The requesting guild admin receives a DM notification of the outcome either way.

### First-time job setup (after install)

After the bot is running for the first time, jobs must be added via slash commands — not by editing `appConfig.json` directly. The initial config should have `"jobs": {}` for each guild.

For each job, a guild admin runs the appropriate command, the bot owner approves via DM, and the bot writes the updated config to S3 and reloads automatically.

Example sequence to set up a weekly gameday notification and audio clip:

```
/guild_admin configure_message_job
  name: pre-gameday
  day: Tuesday
  hour: 19
  minute: 0
  channel: #announcements
  message: Gameday is tomorrow! 🔥🔥🔥

/guild_admin configure_message_job
  name: gameday
  day: Wednesday
  hour: 19
  minute: 0
  channel: #announcements
  message: <@&role-id> It's GameDay time! Lets go!!!

/guild_admin configure_audio_job
  name: gameday-audio
  day: Wednesday
  hour: 19
  minute: 0
  clip: bromance
```

Approve each DM before submitting the next. After all three are approved, the jobs table in the bot logs will confirm the schedule.

---

### Adding a new guild

1. Guild owner invites the bot via Discord's OAuth2 URL
2. Bot receives the `GuildCreate` event and checks the allowlist
3. Bot DMs the bot owner with guild name, owner, member count, and Approve/Deny buttons
4. **Approve** → bot adds the guild to `appConfig.json`, uploads to S3, reloads config, registers slash commands, and DMs the guild owner with setup instructions
5. **Deny** → bot leaves the guild and DMs the guild owner that they were not approved

After approval the guild owner should:
- Run `/guild_admin set_admin_role` to designate a bot admin role
- Follow the **First-time job setup** steps below to configure scheduled jobs

### Configuring a job (`configure_message_job` / `configure_audio_job`)

1. Guild admin runs the command with the job details
2. Bot DMs the bot owner with full job details and Approve/Deny buttons
3. Guild admin receives ephemeral: "Request sent to bot owner for approval"
4. **Approve** → bot writes updated `appConfig.json` locally, uploads to S3, downloads the canonical version from S3, reloads in-memory config and reschedules jobs, DMs guild admin "approved"
5. **Deny** → bot DMs guild admin "denied", no config change

### Removing a job (`remove_job`)

Same flow as configuring a job. The DM shows the existing job details so the owner can see what is being removed before deciding.

### All approval DMs

- Only the bot owner can click the buttons — anyone else receives an ephemeral error
- If the bot cannot reach the owner via DM (privacy settings), the request fails immediately and the guild admin is told to contact the owner directly
- Pending requests are stored in memory. If the bot restarts before a decision is made, the request is lost and must be re-submitted

---

## Commands

- `/audio clip:<clip_name>` - Play a specific audio clip
  - Use `intro` to play your personalized intro clip
  - Use other clip names to play general audio clips from the library
- `/shuffle <subcommand>` - Split voice channel members into 2 teams (requires Move Members permission)
  - `generate` - Randomly shuffle members and display the teams
  - `move` - Move shuffled members into separate voice channels
  - `reset` - Move all shuffled members back to the first voice channel
- `/admin <subcommand>` - Bot owner only (identity check against `ownerId`)
  - `logs [lines] [level]` - Tail the combined bot log (default 20 lines; optionally filter by `info`, `warn`, or `error`)
- `/guild_admin <subcommand>` - Guild administration commands
  - `set_admin_role <role>` - Designate a role as bot admin for this guild (guild owner only)
  - `list` - List all member usernames and IDs
  - `update` - Hot-reload audio configuration from S3
  - `configure_message_job <name> <day> <hour> [minute] <channel> <message>` - Submit a request to add or update a scheduled message job (requires bot owner approval)
  - `configure_audio_job <name> <day> <hour> [minute] [channel] <clip>` - Submit a request to add or update a scheduled audio clip job; omit channel to use the most populated voice channel (requires bot owner approval)
  - `remove_job <name>` - Submit a request to remove a scheduled job (requires bot owner approval)

## Dependencies

- discord.js: Discord API integration
- @discordjs/voice: Audio streaming capabilities
- @discordjs/opus: Opus codec for voice encoding
- @aws-sdk/client-s3: AWS S3 integration
- libsodium-wrappers: Voice channel encryption
- Winston: Logging system
- winston-daily-rotate-file: Log rotation
- node-schedule: Scheduled tasks
- ffmpeg-static: Audio processing

## Development

- Build with `npm run build`
- Lint with `npm run lint`
- Lint and fix with `npm run lint-fix`
- Deploy slash commands with `npm run deploy`
