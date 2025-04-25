// src/utils/embedBuilder.js
const { EmbedBuilder } = require("discord.js");
const { formatTimeUntil } = require("./dateUtils");

/**
 * Create a status embed showing bot information
 * @param {Client} client Discord client
 * @param {string} targetChannelId Current target channel ID
 * @param {object} schedules Active schedules
 * @returns {EmbedBuilder} Status embed
 */
function createStatusEmbed(client, targetChannelId, schedules) {
  const currentTime = new Date();
  const utcTime = currentTime.toUTCString();
  const activeScheduleCount = Object.keys(schedules).length;

  // Count different types of schedules
  const invasionCount = Object.values(schedules).filter(
    (s) =>
      s.type === "invasion" ||
      s.type === "recurring-invasion" ||
      s.type === undefined
  ).length;
  const reminderCount = Object.values(schedules).filter(
    (s) => s.type === "one-time-reminder"
  ).length;
  const invasionReminderCount = Object.values(schedules).filter(
    (s) => s.type === "invasion-reminder"
  ).length;

  // Get target channel info
  const targetChannel = client.channels.cache.get(targetChannelId);
  const channelInfo = targetChannel
    ? `#${targetChannel.name}`
    : "Channel not found";

  // Create an attractive embed
  return new EmbedBuilder()
    .setTitle("🤖 Bot Status Overview")
    .setColor("#4CAF50")
    .setDescription("The invasion notification bot is active and ready!")
    .addFields(
      {
        name: "📡 Connection Status",
        value: `✅ Connected as **${client.user.tag}**`,
      },
      {
        name: "🔔 Notification Channel",
        value: `${channelInfo} (ID: ${targetChannelId})`,
      },
      {
        name: "⏰ Active Schedules",
        value: [
          `• **Total Schedules:** ${activeScheduleCount}`,
          `• **Invasion Events:** ${invasionCount}`,
          `• **Invasion Reminders:** ${invasionReminderCount}`,
          `• **General Reminders:** ${reminderCount}`,
        ].join("\n"),
      },
      {
        name: "🕒 Time Information",
        value: [
          `• **Current UTC Time:** ${utcTime}`,
          `• **Day of Week:** ${
            [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ][currentTime.getUTCDay()]
          }`,
        ].join("\n"),
      },
      {
        name: "📋 Quick Commands",
        value: [
          "• `!schedules` - View upcoming events",
          "• `!help` - View all commands",
          "• `!setChannel` - Change notification channel",
        ].join("\n"),
      }
    )
    .setTimestamp()
    .setFooter({ text: "Use !help for a list of all available commands" });
}

/**
 * Create an embed displaying all active schedules
 * @param {object} activeSchedules All active schedules
 * @returns {EmbedBuilder} Schedules embed
 */
function createSchedulesEmbed(activeSchedules) {
  const embed = new EmbedBuilder()
    .setTitle("📅 Upcoming Events & Notifications")
    .setColor("#FF9900")
    .setTimestamp()
    .setFooter({ text: "Notification Bot" });

  const now = new Date();
  const scheduleIds = Object.keys(activeSchedules);

  // Group schedules by type
  const oneTimeSchedules = scheduleIds.filter(
    (id) => activeSchedules[id].type === "one-time"
  );
  const oneTimeReminders = scheduleIds.filter(
    (id) => activeSchedules[id].type === "one-time-reminder"
  );
  const recurringInvasions = scheduleIds.filter(
    (id) => activeSchedules[id].type === "recurring-invasion"
  );
  const recurringSchedules = scheduleIds.filter(
    (id) =>
      !activeSchedules[id].type || activeSchedules[id].type === "recurring"
  );
  const invasionSchedules = scheduleIds.filter(
    (id) => activeSchedules[id].type === "invasion"
  );
  const invasionReminders = scheduleIds.filter(
    (id) => activeSchedules[id].type === "invasion-reminder"
  );

  // Process invasion schedules
  if (invasionSchedules.length > 0) {
    embed.addFields({ name: "⚔️ Upcoming Invasions", value: "\u200B" });

    const sortedInvasions = invasionSchedules
      .map((id) => ({
        id,
        time: activeSchedules[id].scheduledTime.getTime(),
      }))
      .sort((a, b) => a.time - b.time)
      .map((item) => item.id);

    sortedInvasions.forEach((scheduleId) => {
      const schedule = activeSchedules[scheduleId];
      const timeUntil = schedule.scheduledTime.getTime() - now.getTime();

      if (timeUntil <= 0) {
        embed.addFields({
          name: `ID: ${scheduleId}`,
          value: `**Status:** Imminent/Overdue\n**Scheduled Time:** ${schedule.scheduledTime.toUTCString()}`,
        });
        return;
      }

      const remainingTime = formatTimeUntil(schedule.scheduledTime);

      let fieldValue = `**Time Until:** ${remainingTime}\n`;
      fieldValue += `**Scheduled Time:** ${schedule.scheduledTime.toUTCString()}\n`;

      if (schedule.note) {
        fieldValue += `**Note:** ${schedule.note}\n`;
      }

      if (schedule.remindersSent && schedule.remindersSent.length > 0) {
        fieldValue += `**Reminders Sent:** ${schedule.remindersSent.join(
          ", "
        )}\n`;
      }

      embed.addFields({ name: `ID: ${scheduleId}`, value: fieldValue });
    });
  }

  // Process recurring invasion schedules
  if (recurringInvasions.length > 0) {
    embed.addFields({ name: "🔄 Recurring Invasions", value: "\u200B" });

    recurringInvasions.forEach((scheduleId) => {
      const schedule = activeSchedules[scheduleId];

      let fieldValue = `**Pattern:** \`${schedule.pattern}\`\n`;
      fieldValue += `**Description:** ${schedule.description}\n`;

      // Show next occurrence time (approximate)
      try {
        // Parse the pattern to estimate next occurrence
        const parts = schedule.pattern.split(" ");
        const minute = parseInt(parts[0]);
        const hour = parseInt(parts[1]);

        // Create basic next occurrence info
        let nextOccurrence = "Next: ";

        if (schedule.pattern.includes("*/2")) {
          nextOccurrence += "Every 2 days";
        } else if (schedule.pattern.includes("*/3")) {
          nextOccurrence += "Every 3 days";
        } else if (parts[4] !== "*") {
          // Day of week pattern
          const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const days = parts[4]
            .split(",")
            .map((d) => {
              if (d.includes("-")) {
                const [start, end] = d.split("-").map((d) => parseInt(d));
                return `${dayMap[start]}-${dayMap[end]}`;
              }
              return dayMap[d];
            })
            .join(", ");
          nextOccurrence += `${days}`;
        } else {
          nextOccurrence += "Daily";
        }

        nextOccurrence += ` at ${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")} UTC`;
        fieldValue += `**Schedule:** ${nextOccurrence}\n`;
      } catch (error) {
        console.error("Error parsing next occurrence:", error);
        fieldValue += "**Schedule:** See pattern above\n";
      }

      if (schedule.note) {
        fieldValue += `**Note:** ${schedule.note}\n`;
      }

      embed.addFields({ name: `ID: ${scheduleId}`, value: fieldValue });
    });
  }

  // Process one-time reminders
  if (oneTimeReminders.length > 0) {
    embed.addFields({ name: "📝 One-Time Reminders", value: "\u200B" });

    const sortedReminders = oneTimeReminders
      .map((id) => ({
        id,
        time: activeSchedules[id].scheduledTime.getTime(),
      }))
      .sort((a, b) => a.time - b.time)
      .map((item) => item.id);

    sortedReminders.forEach((scheduleId) => {
      const schedule = activeSchedules[scheduleId];
      const timeUntil = schedule.scheduledTime.getTime() - now.getTime();

      if (timeUntil <= 0) {
        embed.addFields({
          name: `ID: ${scheduleId}`,
          value: `**Status:** Overdue\n**Scheduled Time:** ${schedule.scheduledTime.toUTCString()}`,
        });
        return;
      }

      const remainingTime = formatTimeUntil(schedule.scheduledTime);

      let fieldValue = `**Time Until:** ${remainingTime}\n`;
      fieldValue += `**Scheduled Time:** ${schedule.scheduledTime.toUTCString()}\n`;

      if (schedule.reminderData) {
        fieldValue += `**Title:** ${schedule.reminderData.title}\n`;
      }

      if (schedule.note) {
        fieldValue += `**Note:** ${schedule.note}\n`;
      }

      embed.addFields({ name: `ID: ${scheduleId}`, value: fieldValue });
    });
  }

  // Process recurring schedules
  if (recurringSchedules.length > 0) {
    embed.addFields({ name: "🔁 Recurring Schedules", value: "\u200B" });

    recurringSchedules.forEach((scheduleId) => {
      const schedule = activeSchedules[scheduleId];

      let fieldValue = `**Pattern:** \`${schedule.pattern}\`\n`;
      fieldValue += `**Description:** ${schedule.description}\n`;
      fieldValue += `**Created:** ${schedule.created}\n`;

      if (schedule.note) {
        fieldValue += `**Note:** ${schedule.note}\n`;
      }

      embed.addFields({ name: `ID: ${scheduleId}`, value: fieldValue });
    });
  }

  // Add current time information
  embed.addFields({ name: "🕒 Current Time (UTC)", value: now.toUTCString() });

  return embed;
}

/**
 * Create a help embed for a specific command
 * @param {string} command Command name
 * @param {string} title Help title
 * @param {string} description Help description
 * @param {Array} fields Array of fields {name, value}
 * @param {string} color Embed color (hex code)
 * @returns {EmbedBuilder} Help embed
 */
function createHelpEmbed(
  command,
  title,
  description,
  fields,
  color = "#00AAFF"
) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: `Command: !${command}` });

  // Add all fields
  fields.forEach((field) => {
    embed.addFields(field);
  });

  return embed;
}

/**
 * Create a simple response embed
 * @param {string} title Embed title
 * @param {string} message Main message
 * @param {string} color Embed color (hex code)
 * @param {boolean} success Whether this is a success message
 * @returns {EmbedBuilder} Response embed
 */
function createResponseEmbed(
  title,
  message,
  color = "#00AAFF",
  success = true
) {
  const emoji = success ? "✅" : "❌";

  return new EmbedBuilder()
    .setTitle(`${emoji} ${title}`)
    .setColor(color)
    .setDescription(message)
    .setTimestamp();
}

/**
 * Create an embed showing schedule history
 * @param {Array} history Schedule history entries
 * @returns {EmbedBuilder} History embed
 */
function createHistoryEmbed(history) {
  const embed = new EmbedBuilder()
    .setTitle("📜 Schedule History")
    .setColor("#9933FF")
    .setTimestamp()
    .setFooter({ text: "Invasion Notification Bot" });

  // Get the most recent entries (up to 10)
  const recentHistory = history.slice(-10).reverse();

  // Add each history entry to the embed
  recentHistory.forEach((entry) => {
    const actionEmoji = entry.action === "created" ? "➕" : "➖";
    const actionColor = entry.action === "created" ? "Created" : "Removed";

    let fieldValue = `**Pattern:** \`${entry.pattern}\`\n`;
    fieldValue += `**Description:** ${entry.description}\n`;
    fieldValue += `**${actionColor} At:** ${entry.timestamp}\n`;

    if (entry.note) {
      fieldValue += `**Note:** ${entry.note}\n`;
    }

    if (entry.status) {
      fieldValue += `**Status:** ${entry.status}\n`;
    }

    embed.addFields({
      name: `${actionEmoji} ${actionColor}: ${entry.id}`,
      value: fieldValue,
    });
  });

  return embed;
}

// Export the functions directly
module.exports = {
  createStatusEmbed,
  createSchedulesEmbed,
  createHelpEmbed,
  createResponseEmbed,
  createHistoryEmbed,
};
