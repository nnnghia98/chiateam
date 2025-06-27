# Telegram Team Splitter Bot

A Telegram bot for managing team members and randomly splitting them into groups.

## Features

- Add/remove team members
- Random team splitting
- Member list management
- Team switching functionality
- Vietnamese language support

## Setup

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Create environment file:**

   ```bash
   cp .env.example .env
   ```

3. **Configure your bot token:**
   - Get your bot token from [@BotFather](https://t.me/botfather) on Telegram
   - Edit `.env` file and replace `your_bot_token_here` with your actual bot token:

   ```
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

4. **Run the bot:**
   ```bash
   yarn start
   ```

## Commands

- `/start` - Welcome message
- `/addme` - Add yourself to the team list
- `/list` - Show current team members
- `/split` - Randomly split members into two teams
- `/unsplit` - Restore the list before the last split
- `/remove <name>` - Remove a member by name
- `/remove @<user_id>` - Remove a member by user ID
- `/reset` - Clear all members from the list
- `/addlist [name1, name2, name3]` - Add multiple members at once
- `/switch [name1, name2]` - Switch members between teams

## Security

⚠️ **Important:** Never commit your `.env` file to version control. The `.env` file is already included in `.gitignore` to prevent accidental commits.

## Development

- Format code: `yarn format`
- Check formatting: `yarn format:check`
- Lint code: `yarn lint`
- Fix linting issues: `yarn lint:fix`
