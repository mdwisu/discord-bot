// Discord Bot for Invasion Attack Notifications with Schedule Checking Feature
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// Initialize Discord client with all required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Important! Required to read message content
    GatewayIntentBits.GuildMembers
  ]
});

// Variable to store target channel ID
let targetChannelId = process.env.TARGET_CHANNEL_ID || 'CHANNEL_ID_DEFAULT';

// Variable to store schedule (default: every 2 days at 8:00 PM)
// Cron format: minute hour dayOfMonth month dayOfWeek
// Example: '0 20 */2 * *' means every 2 days at 20:00
let schedulePattern = process.env.SCHEDULE_PATTERN || '0 20 */2 * *';

// Variable to store list of configured schedules
let scheduleList = [];

// Event when bot is ready
client.once('ready', () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);
  console.log(`Current target channel ID: ${targetChannelId}`);
  console.log(`Current schedule: ${schedulePattern}`);
  console.log(`Current UTC time: ${new Date().toUTCString()}`);
  
  // Schedule notifications according to pattern
  setupSchedule();
});

// Function to set up schedule
function setupSchedule() {
  try {
    // Stop previous schedule if exists
    if (global.cronJob) {
      global.cronJob.stop();
      console.log('Previous schedule stopped');
    }
    
    // Create new schedule
    global.cronJob = cron.schedule(schedulePattern, () => {
      console.log(`Schedule running at: ${new Date().toUTCString()}`);
      sendInvasionNotification();
    }, {
      timezone: "UTC" // Important to set timezone to UTC
    });
    
    console.log(`New schedule created: ${schedulePattern} (UTC)`);
    
    // Add to schedule list
    addToScheduleList(schedulePattern);
  } catch (error) {
    console.error('Failed to create schedule:', error);
  }
}

// Function to add schedule to list (prevent duplicates)
function addToScheduleList(pattern) {
  // Check if schedule already exists in the list
  const found = scheduleList.find(item => item.pattern === pattern);
  
  if (!found) {
    // If not found, add to list
    const scheduleInfo = {
      pattern: pattern,
      created: new Date().toUTCString(),
      description: translateCronToHumanReadable(pattern)
    };
    
    scheduleList.push(scheduleInfo);
    
    // Limit schedule list to 10 most recent schedules
    if (scheduleList.length > 10) {
      scheduleList.shift(); // Remove oldest schedule
    }
  }
}

// Function to translate cron pattern to human readable text
function translateCronToHumanReadable(pattern) {
  try {
    const parts = pattern.split(' ');
    if (parts.length !== 5) return "Invalid format";
    
    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];
    
    let description = "";
    
    // Translate days of week
    if (dayOfWeek !== '*') {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (dayOfWeek.includes(',')) {
        // Format: 1,3,5
        const days = dayOfWeek.split(',').map(d => parseInt(d));
        const dayNamesSelected = days.map(d => dayNames[d]).join(', ');
        description += `every ${dayNamesSelected} `;
      } else if (dayOfWeek.includes('-')) {
        // Format: 1-5
        const [start, end] = dayOfWeek.split('-').map(d => parseInt(d));
        description += `every day from ${dayNames[start]} to ${dayNames[end]} `;
      } else if (dayOfWeek.includes('/')) {
        // Format: */2
        const interval = dayOfWeek.split('/')[1];
        description += `every ${interval} days `;
      } else {
        // Format: 1
        description += `every ${dayNames[parseInt(dayOfWeek)]} `;
      }
    } else if (dayOfMonth.includes('*/')) {
      // Format: */2
      const interval = dayOfMonth.split('/')[1];
      description += `every ${interval} days `;
    } else if (dayOfMonth !== '*') {
      // Format: specific date
      description += `on day ${dayOfMonth} of each month `;
    } else {
      description += "every day ";
    }
    
    // Translate hours
    if (hour !== '*') {
      if (hour.includes(',')) {
        // Format: 9,15,21
        const hours = hour.split(',').join(', ');
        description += `at ${hours}:${minute} UTC`;
      } else if (hour.includes('-')) {
        // Format: 9-17
        const [start, end] = hour.split('-');
        description += `from ${start}:${minute} to ${end}:${minute} UTC`;
      } else if (hour.includes('/')) {
        // Format: */2
        const interval = hour.split('/')[1];
        description += `every ${interval} hours at minute ${minute} UTC`;
      } else {
        // Format: specific hour
        description += `at ${hour}:${minute} UTC`;
      }
    } else {
      description += `every hour at minute ${minute} UTC`;
    }
    
    return description;
  } catch (error) {
    console.error('Failed to translate cron pattern:', error);
    return "Complex format";
  }
}

// Function to send invasion notification
function sendInvasionNotification() {
  console.log(`Attempting to send notification to channel ID: ${targetChannelId}`);
  
  const channel = client.channels.cache.get(targetChannelId);
  
  if (!channel) {
    console.error('Channel not found!');
    console.error('List of available channels:');
    client.channels.cache.forEach(ch => {
      console.log(`- ${ch.name}: ${ch.id}`);
    });
    return;
  }
  
  // Create attractive embed message
  const embed = new EmbedBuilder()
    .setTitle('⚔️ INVASION ATTACK WARNING ⚔️')
    .setDescription('An invasion attack will occur soon! Prepare your troops!')
    .setColor('#FF0000')
    .addFields(
      { name: 'Time', value: 'Imminent' },
      { name: 'Preparation', value: 'Get your troops and resources ready' },
      { name: 'Server Time (UTC)', value: new Date().toUTCString() }
    )
    .setTimestamp()
    .setFooter({ text: 'Automatic message from Invasion Notification Bot' });
  
  // Send embed to channel
  channel.send({ content: '@everyone Attention! Invasion will begin soon!', embeds: [embed] })
    .then(() => console.log('Invasion notification sent!'))
    .catch(error => console.error('Failed to send notification:', error));
}

// Command handler
client.on('messageCreate', message => {
  console.log(`Message received: "${message.content}" from ${message.author.tag}`);
  
  // Ignore messages from other bots
  if (message.author.bot) {
    console.log('Message ignored because it came from a bot');
    return;
  }
  
  // Command: !setChannel
  if (message.content.startsWith('!setChannel')) {
    console.log('Command !setChannel detected');
    
    // Check administrator permissions
    const hasAdminPerms = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
    console.log(`User has admin permissions: ${hasAdminPerms}`);
    
    if (!hasAdminPerms) {
      message.reply('You do not have permission to use this command!')
        .catch(err => console.error('Failed to reply to setChannel message:', err));
      return;
    }
    
    // Set new channel
    targetChannelId = message.channel.id;
    console.log(`New channel ID set: ${targetChannelId}`);
    
    message.reply(`Notification channel set to: ${message.channel.name} (ID: ${targetChannelId})`)
      .catch(err => console.error('Failed to reply to setChannel confirmation message:', err));
  }
  
  // Command: !testNotif
  if (message.content === '!testNotif') {
    console.log('Command !testNotif detected');
    
    // Check administrator permissions
    const hasAdminPerms = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
    console.log(`User has admin permissions: ${hasAdminPerms}`);
    
    if (!hasAdminPerms) {
      message.reply('You do not have permission to use this command!')
        .catch(err => console.error('Failed to reply to testNotif message:', err));
      return;
    }
    
    message.reply('Sending test notification...')
      .catch(err => console.error('Failed to reply to testNotif message:', err));
    
    sendInvasionNotification();
  }
  
  // Command: !status
  if (message.content === '!status') {
    console.log('Command !status detected');
    
    const currentTime = new Date().toUTCString();
    message.reply(`Bot active! Target channel ID: ${targetChannelId}\nCurrent schedule: ${schedulePattern}\nCurrent UTC time: ${currentTime}`)
      .catch(err => console.error('Failed to reply to status message:', err));
  }
  
  // Command: !setSchedule [days] [hour]
  // Example: !setSchedule 1,3,5 20
  // Means: Monday (1), Wednesday (3), Friday (5) at 20:00 UTC
  if (message.content.startsWith('!setSchedule')) {
    console.log('Command !setSchedule detected');
    
    // Check administrator permissions
    const hasAdminPerms = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
    console.log(`User has admin permissions: ${hasAdminPerms}`);
    
    if (!hasAdminPerms) {
      message.reply('You do not have permission to use this command!')
        .catch(err => console.error('Failed to reply to setSchedule message:', err));
      return;
    }
    
    const args = message.content.split(' ');
    
    if (args.length < 3) {
      message.reply('Format: !setSchedule [days] [hour]\nExample: !setSchedule 1,3,5 20\nDays: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday')
        .catch(err => console.error('Failed to reply to setSchedule help message:', err));
      return;
    }
    
    const days = args[1]; // Days in format 1,3,5 (Monday, Wednesday, Friday)
    const hour = parseInt(args[2]); // Hour in 24-hour format
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
      message.reply('Hour must be a number between 0-23')
        .catch(err => console.error('Failed to reply to hour error message:', err));
      return;
    }
    
    // Create new cron pattern: minute hour dayOfMonth month dayOfWeek
    // 0 [hour] * * [days]
    schedulePattern = `0 ${hour} * * ${days}`;
    
    try {
      // Validate pattern
      cron.validate(schedulePattern);
      
      // Set up new schedule
      setupSchedule();
      
      message.reply(`Schedule successfully changed to: ${schedulePattern}\nNotifications will be sent on days ${days} at ${hour}:00 UTC\nDescription: ${translateCronToHumanReadable(schedulePattern)}`)
        .catch(err => console.error('Failed to reply to setSchedule confirmation message:', err));
    } catch (error) {
      console.error('Invalid cron pattern:', error);
      message.reply(`Failed to change schedule. Invalid format: ${error.message}`)
        .catch(err => console.error('Failed to reply to setSchedule error message:', err));
    }
  }
  
  // Command: !timeNow
  if (message.content === '!timeNow') {
    console.log('Command !timeNow detected');
    
    const currentTime = new Date();
    const utcTime = currentTime.toUTCString();
    const localTime = currentTime.toString();
    const day = currentTime.getUTCDay(); // 0=Sunday, 1=Monday, etc.
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    message.reply(`🕒 **Time Information**\n**UTC Time:** ${utcTime}\n**Day:** ${dayNames[day]} (${day})\n**Server Local Time:** ${localTime}`)
      .catch(err => console.error('Failed to reply to timeNow message:', err));
  }
  
  // NEW FEATURE: Command !checkSchedule to view configured schedules
  if (message.content === '!checkSchedule') {
    console.log('Command !checkSchedule detected');
    
    const currentSchedule = {
      pattern: schedulePattern,
      description: translateCronToHumanReadable(schedulePattern)
    };
    
    // Create embed for schedule information
    const embed = new EmbedBuilder()
      .setTitle('📅 Notification Schedule Information')
      .setColor('#00AAFF')
      .setTimestamp()
      .setFooter({ text: 'Invasion Notification Bot' });
    
    // Add current schedule information
    embed.addFields(
      { name: '⏰ Currently Active Schedule', value: `Pattern: \`${currentSchedule.pattern}\`\nDescription: ${currentSchedule.description}` }
    );
    
    // Add target channel information
    const targetChannel = client.channels.cache.get(targetChannelId);
    const channelInfo = targetChannel ? `#${targetChannel.name}` : 'Channel not found';
    embed.addFields(
      { name: '📢 Target Channel', value: `${channelInfo} (ID: ${targetChannelId})` }
    );
    
    // Add schedule history if available
    if (scheduleList.length > 0) {
      let historyText = '';
      
      // Display up to 5 most recent schedules
      const recentSchedules = scheduleList.slice(-5).reverse();
      
      recentSchedules.forEach((schedule, index) => {
        historyText += `**${index + 1}.** Pattern: \`${schedule.pattern}\`\n`;
        historyText += `    Description: ${schedule.description}\n`;
        historyText += `    Created: ${schedule.created}\n\n`;
      });
      
      embed.addFields(
        { name: '📜 Schedule History (Last 5)', value: historyText || 'No schedule history' }
      );
    }
    
    // Add time information
    const currentTime = new Date();
    const utcTime = currentTime.toUTCString();
    const day = currentTime.getUTCDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    embed.addFields(
      { name: '🕒 Current Time (UTC)', value: `${utcTime}\nDay: ${dayNames[day]} (${day})` }
    );
    
    // Send embed to user
    message.reply({ embeds: [embed] })
      .catch(err => console.error('Failed to reply to checkSchedule message:', err));
  }
  
  // Command !help to view list of commands
  if (message.content === '!help') {
    console.log('Command !help detected');
    
    const helpEmbed = new EmbedBuilder()
      .setTitle('🤖 Invasion Notification Bot Help')
      .setColor('#00FF00')
      .setDescription('Here is a list of available commands:')
      .addFields(
        { name: '!setChannel', value: 'Set current channel as notification target (Admin)' },
        { name: '!testNotif', value: 'Send a test notification (Admin)' },
        { name: '!setSchedule [days] [hour]', value: 'Set notification schedule (Admin)\nExample: !setSchedule 1,3,5 20\nDays: 0=Sunday, 1=Monday, 2=Tuesday, ...' },
        { name: '!checkSchedule', value: 'View current notification schedule and history' },
        { name: '!timeNow', value: 'Display current UTC and local time' },
        { name: '!status', value: 'Check bot status' },
        { name: '!help', value: 'Display this help message' }
      )
      .setTimestamp()
      .setFooter({ text: 'Invasion Notification Bot' });
    
    message.reply({ embeds: [helpEmbed] })
      .catch(err => console.error('Failed to reply to help message:', err));
  }
});

// Error handler
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord with bot token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Bot token not found! Make sure .env file contains DISCORD_TOKEN=your_bot_token');
  process.exit(1);
}

console.log('Attempting to login with token...');
client.login(token).catch(error => {
  console.error('Login failed:', error);
  process.exit(1);
});

/* 
HOW TO USE:
1. Create a .env file with:
   DISCORD_TOKEN=your_bot_token
   TARGET_CHANNEL_ID=your_default_channel_id (optional)
   SCHEDULE_PATTERN=0 20 *\/2 * * (optional, cron format for schedule)

2. Install dependencies with command:
   npm install discord.js@14 node-cron dotenv

3. Run the bot with command:
   node bot.js

4. Available commands:
   - !setChannel - Set current channel as notification target (Admin)
   - !testNotif - Send a test notification (Admin)
   - !status - Check bot status and target channel ID
   - !timeNow - Display current UTC and local time
   - !setSchedule [days] [hour] - Set notification schedule (Admin)
     Example: !setSchedule 1,3,5 20 (Monday, Wednesday, Friday at 20:00 UTC)
   - !checkSchedule - View current notification schedule and history
   - !help - Display list of commands
*/