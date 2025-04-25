// src/config.js

/**
 * Bot configuration loaded from environment variables
 */
const config = {
  // Discord bot token (required)
  token: process.env.DISCORD_TOKEN,
  
  // Default target channel ID for notifications
  targetChannelId: process.env.TARGET_CHANNEL_ID || null,
  
  // Default schedule pattern in cron format
  defaultSchedulePattern: process.env.SCHEDULE_PATTERN || null,
  
  // Standard invasion reminder times (minutes before invasion)
  standardReminderTimes: [
    { minutes: 60, label: "1 hour" },
    { minutes: 30, label: "30 minutes" },
    { minutes: 10, label: "10 minutes" }
  ],
  
  // Maximum history entries to keep
  maxHistoryEntries: 20,
  
  // Command prefix
  commandPrefix: '!'
};

// Validate required configuration
if (!config.token) {
  console.error('Bot token not found! Make sure .env file contains DISCORD_TOKEN=your_bot_token');
  process.exit(1);
}

module.exports = { config };