// Project structure:
// 
// index.js - Main entry point
// src/
//   bot.js - Discord bot setup
//   config.js - Configuration
//   commands/ - Command handlers
//     index.js - Command registry
//     setup.js - Setup commands
//     invasion.js - Invasion-related commands
//     reminder.js - Reminder commands
//     schedule.js - Schedule commands
//     help.js - Help commands
//   services/
//     scheduleManager.js - Schedule management
//     notificationService.js - Notification sending
//   utils/
//     dateUtils.js - Date/time utilities
//     cronUtils.js - Cron pattern utilities
//     embedBuilder.js - Discord embed building

// index.js
require('dotenv').config();
const { startBot } = require('./src/bot');

// Start the bot
startBot().catch(error => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});