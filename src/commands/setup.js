// src/commands/setup.js
const { PermissionFlagsBits } = require("discord.js");
const embedBuilder = require("../utils/embedBuilder");

/**
 * Set the notification channel command
 */
const setChannel = {
  name: "setchannel",
  description: "Set the current channel as the notification target",
  create(client, scheduleManager) {
    return {
      async execute(message) {
        // Check if the user has admin permissions
        if (
          !message.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          await message.reply(
            "You do not have permission to use this command!"
          );
          return;
        }

        // Set new channel
        const newChannelId = message.channel.id;
        scheduleManager.setTargetChannel(newChannelId);
        console.log(`New channel ID set: ${newChannelId}`);

        await message.reply(
          `Notification channel set to: ${message.channel.name} (ID: ${newChannelId})`
        );
      },
    };
  },
};

/**
 * Display bot status command
 */
const status = {
  name: "status",
  description: "Display the current status of the bot",
  create(client, scheduleManager) {
    return {
      async execute(message) {
        const targetChannelId = scheduleManager.getTargetChannel();
        const activeSchedules = scheduleManager.getAllSchedules();

        // Create status embed
        const statusEmbed = embedBuilder.createStatusEmbed(
          client,
          targetChannelId,
          activeSchedules
        );

        await message.reply({ embeds: [statusEmbed] });
      },
    };
  },
};

/**
 * Display current time command
 */
const timeNow = {
  name: "timenow",
  description: "Display the current server time",
  create(client) {
    return {
      async execute(message) {
        const currentTime = new Date();
        const utcTime = currentTime.toUTCString();
        const localTime = currentTime.toString();
        const day = currentTime.getUTCDay(); // 0=Sunday, 1=Monday, etc.
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        await message.reply(
          `🕒 **Time Information**\n**UTC Time:** ${utcTime}\n**Day:** ${dayNames[day]} (${day})\n**Server Local Time:** ${localTime}`
        );
      },
    };
  },
};

module.exports = {
  setChannel,
  status,
  timeNow,
};
