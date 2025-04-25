// src/commands/help.js
const { EmbedBuilder } = require("discord.js");

/**
 * Main help command
 */
const help = {
  name: "help",
  description: "Display help information",
  create(client) {
    return {
      async execute(message) {
        const helpEmbed = new EmbedBuilder()
          .setTitle("🤖 Invasion Notification Bot Help")
          .setColor("#00FF00")
          .setDescription(
            "Commands are organized by category. Use the specialized help commands for more details."
          )
          .addFields(
            {
              name: "🔧 Setup Commands",
              value: [
                "• `!setChannel` - Set current channel for notifications (Admin)",
                "• `!status` - Check bot status and active schedules",
                "• `!timeNow` - Display current UTC and server time",
              ].join("\n"),
            },
            {
              name: "⚔️ Invasion Commands",
              value: [
                "• `!invasion [date] [time] [note]` - Schedule one-time attack with auto-reminders",
                "• `!recurringInvasion [days] [time] [note]` - Schedule recurring invasions (e.g., daily, weekly)",
                "• `!countdown HH:MM:SS [note]` - Schedule from in-game timer",
                "• `!customcountdown HH:MM:SS R1:R2:R3 [note]` - Custom reminder times",
                "• `!testNotif` - Send test invasion notification (Admin)",
                "",
                "For invasion command details, use `!invasionHelp`",
              ].join("\n"),
            },
            {
              name: "📝 Reminder Commands",
              value: [
                "• `!reminder [date] [time] [title] [message] [note]` - General reminder",
              ].join("\n"),
            },
            {
              name: "📅 Schedule Commands",
              value: [
                "• `!scheduleEasy [days] [time] [note]` - Simple recurring schedule",
                '• `!addSchedule "pattern" [note]` - Advanced cron pattern scheduling',
                "• `!removeSchedule [id]` - Delete a schedule by ID",
              ].join("\n"),
            },
            {
              name: "📊 Management Commands",
              value: [
                "• `!schedules` - View all upcoming notifications",
                "• `!scheduleHistory` - View schedule creation/removal history",
              ].join("\n"),
            },
            {
              name: "❓ Help Commands",
              value: [
                "• `!invasionHelp` - Help with invasion-related commands",
                "• `!reminderHelp` - Help with reminder commands",
                "• `!scheduleHelp` - Help with scheduling commands",
              ].join("\n"),
            }
          )
          .setTimestamp()
          .setFooter({
            text: "Use specialized help commands for more details",
          });

        await message.reply({ embeds: [helpEmbed] });
      },
    };
  },
};

/**
 * Invasion help command
 */
const invasionHelp = {
  name: "invasionhelp",
  description: "Display invasion-related command help",
  create(client) {
    return {
      async execute(message) {
        const helpEmbed = new EmbedBuilder()
          .setTitle("⚔️ Invasion Commands Help")
          .setColor("#FF0000")
          .setDescription(
            "Commands for scheduling invasion alerts and reminders"
          )
          .addFields(
            {
              name: "🗓️ Schedule One-Time Invasion",
              value: [
                "**Command:** `!invasion [date] [time] [note]`",
                "",
                "**Examples:**",
                '• `!invasion tomorrow 18:00 "Guild war"`',
                '• `!invasion 2023-12-25 20:00 "Holiday raid"`',
                '• `!invasion +2hours "Quick attack"`',
                "",
                "**Date Formats:**",
                "• `YYYY-MM-DD` - Specific date (e.g., 2023-12-31)",
                "• `today` - Today's date",
                "• `tomorrow` - Tomorrow's date",
                "• `+Nhours` - N hours from now (e.g., +2hours)",
                "• `+Nminutes` - N minutes from now (e.g., +30minutes)",
                "",
                "This command automatically creates reminders at 1 hour, 30 minutes, and 10 minutes before the invasion time.",
              ].join("\n"),
            },
            // Split recurring invasion into multiple fields to avoid the 1024 character limit
            {
              name: "🔄 Recurring Invasions - Basic Usage",
              value: [
                "**Command:** `!recurringInvasion [days] [time] [note]`",
                "",
                "**Examples:**",
                '• `!recurringInvasion every2days 20:00 "Bi-daily invasion"`',
                '• `!recurringInvasion mon,wed,fri 18:30 "MWF alliance wars"`',
                '• `!recurringInvasion weekend 12:00 "Weekend raids"`',
                '• `!recurringInvasion daily 20:00 "Daily guild war"`',
                '• `!recurringInvasion tue,thu 19:00 "Bi-weekly territory wars"`',
              ].join("\n"),
            },
            {
              name: "🔄 Recurring Invasions - Options",
              value: [
                "**Day Options:**",
                "• `daily` - Every day",
                "• `weekend` - Saturday and Sunday",
                "• `weekday` - Monday through Friday",
                "• `mon,tue,wed,thu,fri,sat,sun` - Specific days (use commas)",
                "• `every2days` - Every 2 days",
                "• `every3days` - Every 3 days",
                "",
                "**Time Format:**",
                "• 24-hour format (e.g., 20:00 for 8:00 PM, 09:30 for 9:30 AM)",
                "• All times are in UTC",
              ].join("\n"),
            },
            {
              name: "🔄 Recurring Invasions - Benefits",
              value: [
                "This command schedules invasions that will trigger automatically on a recurring basis.",
                "",
                "**Benefits:**",
                "• Set once and forget - no need to schedule each invasion manually",
                "• Consistent timing for better coordination with your team",
                "• Full @everyone notifications on each occurrence",
                "",
                "To view all your recurring invasion schedules, use `!schedules`",
                "To remove a specific recurring invasion, use `!removeSchedule [id]`",
              ].join("\n"),
            },
            {
              name: "⏱️ Schedule from In-Game Countdown",
              value: [
                "**Command:** `!countdown HH:MM:SS [note]`",
                "",
                "**Examples:**",
                '• `!countdown 19:38:49 "Boss invasion"`',
                '• `!countdown 2:30:00 "Guild war"`',
                '• `!countdown 0:45:30 "Quick raid"`',
                "",
                "**Format:** Hours:Minutes:Seconds as shown in the game",
                "• 19:38:49 (19 hours, 38 minutes, 49 seconds)",
                "• 2:30:00 (2 hours, 30 minutes)",
                "",
                "This command automatically creates reminders at 1 hour, 30 minutes, and 10 minutes before the invasion time.",
              ].join("\n"),
            },
            {
              name: "⚙️ Custom Countdown with Specific Reminders",
              value: [
                "**Command:** `!customcountdown HH:MM:SS R1:R2:R3 [note]`",
                "",
                "**Examples:**",
                '• `!customcountdown 19:38:49 60:30:10 "Boss invasion"`',
                '• `!customcountdown 2:30:00 120:60:30:15:5 "Guild war with many reminders"`',
                "",
                "**First parameter:** Hours:Minutes:Seconds countdown from game",
                "**Second parameter:** Minutes before invasion for each reminder, separated by colons",
                "• 60:30:10 (reminders at 60 mins, 30 mins, and 10 mins before)",
              ].join("\n"),
            },
            {
              name: "🧪 Test Command",
              value:
                "• `!testNotif` - Send a test invasion notification (Admin only)",
            }
          )
          .setTimestamp()
          .setFooter({
            text: "All invasion notifications will @everyone in the target channel",
          });

        await message.reply({ embeds: [helpEmbed] });
      },
    };
  },
};

/**
 * Reminder help command
 */
const reminderHelp = {
  name: "reminderhelp",
  description: "Display reminder-related command help",
  create(client) {
    return {
      async execute(message) {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📝 Reminder Command Help")
          .setColor("#3498DB")
          .setDescription("Learn how to create one-time general reminders")
          .addFields(
            {
              name: "📌 One-Time Reminder Creation",
              value: [
                "**Command:** `!reminder [date] [time] [title] [message] [note]`",
                "",
                "**Examples:**",
                '• `!reminder tomorrow 15:00 "Team Meeting" "Don\'t forget our weekly team meeting" "Important"`',
                '• `!reminder +2hours "Gather Resources" "Time to collect resources!"`',
                '• `!reminder 2023-12-25 08:00 "Christmas" "Merry Christmas everyone!"`',
                "",
                "**Date Formats:**",
                "• `YYYY-MM-DD` - Specific date (e.g., 2023-12-31)",
                "• `today` - Today's date",
                "• `tomorrow` - Tomorrow's date",
                "• `+Nhours` - N hours from now (e.g., +2hours)",
                "• `+Nminutes` - N minutes from now (e.g., +30minutes)",
                "",
                "**Time Format:**",
                "• `hour:minute` in 24-hour format (e.g., 15:00 for 3:00 PM)",
                "• Not needed when using +hours or +minutes format",
                "",
                "**Title & Message:**",
                'Use quotes for multi-word title and message: "Your Title" "Your detailed message"',
                "",
                "**Note:**",
                "Optional additional information (use quotes for multi-word notes)",
              ].join("\n"),
            },
            {
              name: "📊 Managing Reminders",
              value: [
                "• `!schedules` - View upcoming reminders",
                "• `!removeSchedule [id]` - Delete a reminder by ID",
                "• `!scheduleHistory` - View reminder history",
              ].join("\n"),
            }
          )
          .setTimestamp()
          .setFooter({
            text: "General reminders use @here instead of @everyone",
          });

        await message.reply({ embeds: [helpEmbed] });
      },
    };
  },
};

/**
 * Schedule help command
 */
const scheduleHelp = {
  name: "schedulehelp",
  description: "Display schedule-related command help",
  create(client) {
    return {
      async execute(message) {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📅 Scheduling Help Guide")
          .setColor("#33CCFF")
          .setDescription(
            "Learn how to create and manage recurring notification schedules"
          )
          .addFields(
            {
              name: "📝 Easy Scheduling",
              value: [
                "**Command:** `!scheduleEasy [days] [hour:minute] [note]`",
                "",
                "**Day Options:**",
                "• `daily` - Every day",
                "• `weekend` - Saturday and Sunday",
                "• `weekday` - Monday through Friday",
                "• `mon,wed,fri` - Specific days (use commas)",
                "• `every2days` - Every 2 days",
                "• `every3days` - Every 3 days",
                "",
                "**Examples:**",
                '• `!scheduleEasy daily 20:00 "Daily at 8PM"`',
                '• `!scheduleEasy weekend 12:00 "Weekend noon"`',
                '• `!scheduleEasy mon,wed,fri 20:00 "MWF evenings"`',
              ].join("\n"),
            },
            {
              name: "⚙️ Advanced Scheduling (Cron Patterns)",
              value: [
                '**Command:** `!addSchedule "pattern" [note]`',
                "",
                "**Pattern Format:** `minute hour dayOfMonth month dayOfWeek`",
                "",
                "**Common Patterns:**",
                "• `0 20 * * *` - Every day at 8:00 PM",
                "• `0 */6 * * *` - Every 6 hours",
                "• `0 8 */2 * *` - Every 2 days at 8:00 AM",
                "• `0 20 * * 1,3,5` - Mon, Wed, Fri at 8:00 PM",
                "• `30 20 1 * *` - 1st day of each month at 8:30 PM",
              ].join("\n"),
            },
            {
              name: "🔄 Managing Schedules",
              value: [
                "• `!schedules` - View all upcoming schedules",
                "• `!removeSchedule [id]` - Delete a schedule by ID",
                "• `!scheduleHistory` - View schedule history",
              ].join("\n"),
            },
            {
              name: "⏰ Time Reference",
              value: [
                "• Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat",
                "• Time is in 24-hour format (UTC timezone)",
                "• Use `!timeNow` to check current server time",
              ].join("\n"),
            }
          )
          .setTimestamp()
          .setFooter({ text: "All times are in UTC" });

        await message.reply({ embeds: [helpEmbed] });
      },
    };
  },
};

module.exports = {
  help,
  invasionHelp,
  reminderHelp,
  scheduleHelp,
};
