// src/services/notificationService.js
const { EmbedBuilder } = require('discord.js');
const { formatTimeUntil } = require('../utils/dateUtils');

/**
 * Handles all notification sending functionality
 */
class NotificationService {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get a channel by ID with error handling
   * @param {string} channelId Discord channel ID
   * @returns {Channel|null} Discord channel or null if not found
   */
  getChannel(channelId) {
    const channel = this.client.channels.cache.get(channelId);
    
    if (!channel) {
      console.error(`Channel not found with ID: ${channelId}`);
      console.error("List of available channels:");
      this.client.channels.cache.forEach((ch) => {
        console.log(`- ${ch.name}: ${ch.id}`);
      });
      return null;
    }
    
    return channel;
  }

  /**
   * Send a general reminder notification
   * @param {string} channelId Target channel ID
   * @param {string} scheduleId Schedule ID
   * @param {string} reminderTitle Reminder title
   * @param {string} reminderMessage Reminder message
   * @returns {Promise<Message|null>} Sent message or null if failed
   */
  async sendGeneralReminder(
    channelId,
    scheduleId = null,
    reminderTitle = "General Reminder",
    reminderMessage = "This is a general reminder."
  ) {
    console.log(`Attempting to send general reminder to channel ID: ${channelId}`);

    const channel = this.getChannel(channelId);
    if (!channel) return null;

    // Get schedule info if available
    let scheduleInfo = "Manual reminder";
    if (scheduleId && this.scheduleManager?.activeSchedules[scheduleId]) {
      const schedule = this.scheduleManager.activeSchedules[scheduleId];
      if (schedule.type === "one-time") {
        scheduleInfo = `One-time Reminder ID: ${scheduleId}`;
      } else {
        scheduleInfo = `Reminder ID: ${scheduleId} (${schedule.pattern})`;
      }
    }

    // Create attractive embed message
    const embed = new EmbedBuilder()
      .setTitle(`📢 ${reminderTitle}`)
      .setDescription(reminderMessage)
      .setColor("#3498DB") // Blue color for general reminders
      .addFields(
        { name: "Server Time (UTC)", value: new Date().toUTCString() },
        { name: "Trigger Source", value: scheduleInfo }
      )
      .setTimestamp()
      .setFooter({ text: "Reminder from Notification Bot" });

    try {
      // Send embed to channel - no @everyone mention for general reminders
      const sentMessage = await channel.send({ embeds: [embed] });
      console.log("General reminder sent!");
      return sentMessage;
    } catch (error) {
      console.error("Failed to send reminder:", error);
      return null;
    }
  }

  /**
   * Send an invasion notification
   * @param {string} channelId Target channel ID
   * @param {string} scheduleId Schedule ID
   * @param {object} scheduleData Schedule data for context
   * @returns {Promise<Message|null>} Sent message or null if failed
   */
  async sendInvasionNotification(channelId, scheduleId = null, scheduleData = null) {
    console.log(`Attempting to send notification to channel ID: ${channelId}`);

    const channel = this.getChannel(channelId);
    if (!channel) return null;

    // Get schedule info if available
    let scheduleInfo = "Automatic schedule";
    if (scheduleId && scheduleData) {
      scheduleInfo = `Schedule ID: ${scheduleId} (${scheduleData.pattern || 'One-time'})`;
    }

    // Create attractive embed message
    const embed = new EmbedBuilder()
      .setTitle("⚔️ INVASION ATTACK ⚔️")
      .setDescription("An invasion attack will occur soon! Prepare your troops!")
      .setColor("#FF0000")
      .addFields(
        { name: "Time", value: "Imminent" },
        { name: "Preparation", value: "Get your troops ready" },
        { name: "Server Time (UTC)", value: new Date().toUTCString() },
        { name: "Trigger Source", value: scheduleInfo }
      )
      .setTimestamp()
      .setFooter({ text: "Automatic message from Invasion Notification Bot" });

    try {
      // Send embed to channel
      const sentMessage = await channel.send({
        content: "@everyone Attention! Invasion will begin soon!",
        embeds: [embed],
      });
      console.log("Invasion notification sent!");
      return sentMessage;
    } catch (error) {
      console.error("Failed to send notification:", error);
      return null;
    }
  }

  /**
   * Send an invasion reminder notification
   * @param {string} channelId Target channel ID
   * @param {string} invasionId Invasion ID
   * @param {string} timeUntilInvasion Human-readable time until invasion
   * @param {Date} reminderTime Time of this reminder
   * @param {Date} invasionTime Time of the invasion
   * @returns {Promise<Message|null>} Sent message or null if failed
   */
  async sendInvasionReminderNotification(
    channelId,
    invasionId,
    timeUntilInvasion,
    reminderTime,
    invasionTime
  ) {
    console.log(`Attempting to send invasion reminder to channel ID: ${channelId}`);

    const channel = this.getChannel(channelId);
    if (!channel) return null;

    // Calculate remaining time in a human-readable format
    const remainingTime = formatTimeUntil(invasionTime);

    // Create attractive embed message for reminder
    const embed = new EmbedBuilder()
      .setTitle("⚠️ INVASION INCOMING ⚠️")
      .setDescription(`An invasion will start in **${timeUntilInvasion}**! Start preparing your attack!`)
      .setColor("#FFA500") // Orange for reminders
      .addFields(
        { name: "Invasion Start", value: invasionTime.toUTCString() },
        { name: "Time Remaining", value: remainingTime },
        { name: "Preparations", value: "Teleport closer and bring your troops back!" },
        { name: "Current Time (UTC)", value: new Date().toUTCString() },
        { name: "Invasion ID", value: invasionId }
      )
      .setTimestamp()
      .setFooter({ text: "Invasion Notification System" });

    try {
      // Send embed to channel - use @here for reminders rather than @everyone
      const sentMessage = await channel.send({ 
        content: "@here Prepare for invasion!", 
        embeds: [embed] 
      });
      console.log("Invasion reminder notification sent!");
      return sentMessage;
    } catch (error) {
      console.error("Failed to send reminder notification:", error);
      return null;
    }
  }

  /**
   * Send the actual invasion start notification
   * @param {string} channelId Target channel ID
   * @param {string} invasionId Invasion ID
   * @param {Date} invasionTime Time of the invasion
   * @returns {Promise<Message|null>} Sent message or null if failed
   */
  async sendInvasionStartNotification(
    channelId,
    invasionId,
    invasionTime
  ) {
    console.log(`Attempting to send invasion start notification to channel ID: ${channelId}`);

    const channel = this.getChannel(channelId);
    if (!channel) return null;

    // Create attractive embed message for the invasion start
    const embed = new EmbedBuilder()
      .setTitle("⚔️ INVASION ATTACK NOW ⚔️")
      .setDescription("**THE INVASION HAS STARTED!** Battle stations everyone!")
      .setColor("#FF0000") // Red for actual invasion
      .addFields(
        { name: "Status", value: "**ACTIVE NOW**" },
        { name: "Scheduled Time", value: invasionTime.toUTCString() },
        { name: "Current Time (UTC)", value: new Date().toUTCString() },
        { name: "Invasion ID", value: invasionId }
      )
      .setTimestamp()
      .setFooter({ text: "Invasion Notification System" });

    try {
      // Send embed to channel with @everyone for the actual invasion
      const sentMessage = await channel.send({
        content: "@everyone INVASION HAS STARTED! ATTACK NOW!",
        embeds: [embed],
      });
      console.log("Invasion start notification sent!");
      return sentMessage;
    } catch (error) {
      console.error("Failed to send invasion notification:", error);
      return null;
    }
  }

  /**
   * Send a test notification
   * @param {string} channelId Target channel ID
   * @returns {Promise<Message|null>} Sent message or null if failed
   */
  async sendTestNotification(channelId) {
    console.log(`Attempting to send test notification to channel ID: ${channelId}`);

    const channel = this.getChannel(channelId);
    if (!channel) return null;

    // Create an attractive welcome/test message embed
    const embed = new EmbedBuilder()
      .setTitle("👋 Hello Everyone!")
      .setDescription("I'm your Invasion Notification Bot, ready to keep your team informed!")
      .setColor("#8A2BE2") // Vibrant purple color
      .addFields(
        {
          name: "📢 What I Can Do For You",
          value: "I'll send alerts for upcoming invasions, battles, and important events so everyone stays coordinated.",
        },
        {
          name: "🕒 Current Server Time",
          value: new Date().toUTCString(),
        },
        {
          name: "🛡️ Stay Prepared",
          value: "When the real alerts come, they'll be much more noticeable than this test message.",
        }
      )
      .setTimestamp()
      .setFooter({
        text: "This is just a test notification • Your friendly bot assistant",
      });

    try {
      // Send embed to channel - no @everyone for test messages, just a friendly ping
      const sentMessage = await channel.send({ embeds: [embed] });
      console.log("Test notification sent!");
      return sentMessage;
    } catch (error) {
      console.error("Failed to send test notification:", error);
      return null;
    }
  }
}

module.exports = { NotificationService };