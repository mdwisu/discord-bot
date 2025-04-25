// src/bot.js
const {
  Client,
  GatewayIntentBits,
  Events,
  Collection
} = require('discord.js');
const { commands } = require('./commands');
const { config } = require('./config');
const { ScheduleManager } = require('./services/scheduleManager');

/**
 * Initialize and start the Discord bot
 */
async function startBot() {
  // Create a new Discord client with reconnection options
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    retryLimit: 10,
    restRequestTimeout: 30000, // Increase timeout to 30s
  });

  // Initialize services
  const scheduleManager = new ScheduleManager(client);
  
  // Store command handlers
  client.commands = new Collection();
  
  // Register all commands
  for (const command of commands) {
    const handler = command.create(client, scheduleManager);
    client.commands.set(command.name, handler);
  }

  // Register event handlers
  setupEventHandlers(client, scheduleManager);

  // Login to Discord
  console.log('Attempting to login with token...');
  await client.login(config.token);
  
  return client;
}

/**
 * Setup event handlers for the Discord client
 */
function setupEventHandlers(client, scheduleManager) {
  // When bot is ready
  client.once(Events.ClientReady, () => {
    console.log(`Bot ready! Logged in as ${client.user.tag}`);
    console.log(`Current target channel ID: ${config.targetChannelId}`);
    console.log(`Current UTC time: ${new Date().toUTCString()}`);

    // Setup default schedule if provided in config
    if (config.defaultSchedulePattern) {
      try {
        scheduleManager.addSchedule(
          config.defaultSchedulePattern, 
          "Default schedule from config"
        );
      } catch (error) {
        console.error('Failed to create default schedule:', error);
      }
    }
  });

  // Message handling
  client.on(Events.MessageCreate, async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;
    
    // Check if the message starts with a command prefix
    if (!message.content.startsWith('!')) return;
    
    // Extract command name and arguments
    const args = message.content.trim().split(/\s+/);
    const commandName = args[0].substring(1).toLowerCase();
    
    // Check if we have a handler for this command
    const command = client.commands.get(commandName);
    if (!command) return;
    
    // Execute the command
    try {
      await command.execute(message, args.slice(1));
    } catch (error) {
      console.error(`Error executing command "${commandName}":`, error);
      try {
        await message.reply('There was an error executing that command.');
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  });

  // Error handling
  client.on('error', (error) => {
    console.error('Discord client error:', error);
    console.log('Attempting to reconnect in 5 seconds...');
  });

  client.on('disconnect', (event) => {
    console.log(`Bot disconnected with code ${event.code}`);
    console.log('Attempting to reconnect in 5 seconds...');
  });

  // Process-level exception handler
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
  });
}

module.exports = { startBot };