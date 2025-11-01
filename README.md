# wow-token-bot

A Discord bot that fetches current WoW Token prices from the Blizzard API.

## Setup

1. Install dependencies:

```bash
bun install
```

2. Create a `.env` file with the following variables:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
BLIZZARD_CLIENT_ID=your_blizzard_client_id
BLIZZARD_CLIENT_SECRET=your_blizzard_client_secret
POLL_INTERVAL_MINUTES=5
```

**Optional Environment Variables:**
- `POLL_INTERVAL_MINUTES` - How often to check for price alerts (default: 5 minutes)

3. Register slash commands with Discord:

```bash
bun run register-commands.ts
```

4. Run the bot:

```bash
bun run index.ts
```

## Data Storage

Alerts are persisted in a SQLite database (`alerts.db`) which is automatically created on first run. The database will survive bot restarts, so users won't lose their configured alerts.

## Commands

### Price Checking
- `/wowtoken price [region]` - Get the current WoW Token price for a specific region (US, EU, KR, TW)

### Price Alerts
- `/wowtoken alert set <price> [direction] [region]` - Set a price alert. Choose "Above" or "Below" to be notified when price crosses your threshold.
- `/wowtoken alert list` - View your active price alerts
- `/wowtoken alert remove <alert_id>` - Remove a specific price alert

**Examples:**
- `/wowtoken alert set price:200000` - Alert when US price goes above 200k gold (defaults)
- `/wowtoken alert set price:200000 direction:Above` - Same as above (explicit)
- `/wowtoken alert set price:150000 direction:Below region:EU` - Alert when EU price drops below 150k gold

**Note:** 
- Alerts are checked based on the `POLL_INTERVAL_MINUTES` setting (default: 5 minutes)
- Once triggered, an alert is automatically removed
- You can set multiple alerts (e.g., one for "above" and one for "below") to get notified in both directions

## Getting API Credentials

### Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to "Bot" section
4. Copy the token

### Blizzard API Credentials
1. Go to [Blizzard Developer Portal](https://develop.battle.net/)
2. Create a new client
3. Copy the Client ID and Client Secret

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
