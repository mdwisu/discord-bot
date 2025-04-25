// src/commands/invasion.js
const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const {
  parseUserFriendlyDate,
  parseTimeString,
} = require("../utils/dateUtils");
const { createCronPattern } = require("../utils/cronUtils");
const embedBuilder = require("../utils/embedBuilder");

/**
 * Check if user has admin permissions
 * @param {Message} message Discord message
 * @returns {boolean} True if user has admin permissions
 */
async function checkAdmin(message) {
  const hasAdminPerms =
    message.member &&
    message.member.permissions.has(PermissionFlagsBits.Administrator);

  console.log(`User has admin permissions: ${hasAdminPerms}`);

  if (!hasAdminPerms) {
    await message.reply("You do not have permission to use this command!");
    return false;
  }
  return true;
}

/**
 * One-time invasion command
 */
const invasion = {
  name: "invasion",
  description: "Schedule a one-time invasion with reminders",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 2) {
          const helpEmbed = new EmbedBuilder()
            .setTitle("⚔️ Schedule Invasion with Reminders")
            .setColor("#FF0000")
            .setDescription(
              "This command schedules an invasion with automatic reminder alerts before it starts."
            )
            .addFields(
              {
                name: "⌨️ Basic Command",
                value: "`!invasion [date] [time] [note]`",
              },
              {
                name: "🔍 Examples",
                value: [
                  '`!invasion tomorrow 20:00 "Evening raid"`',
                  '`!invasion 2023-07-15 18:30 "Weekend invasion"`',
                  '`!invasion +2hours "Quick attack"`',
                ].join("\n"),
              },
              {
                name: "⏰ Reminders",
                value:
                  "The system will automatically send reminders:\n• 1 hour before\n• 30 minutes before\n• 10 minutes before",
              },
              {
                name: "📝 Date Formats",
                value: [
                  "• `today 18:00` - Today at 6:00 PM",
                  "• `tomorrow 9:30` - Tomorrow at 9:30 AM",
                  "• `2023-12-25 08:00` - December 25th, 2023 at 8:00 AM",
                  "• `+30minutes` - 30 minutes from now",
                  "• `+2hours` - 2 hours from now",
                ].join("\n"),
              }
            )
            .setTimestamp()
            .setFooter({ text: "All times are in UTC" });

          await message.reply({ embeds: [helpEmbed] });
          return;
        }

        // Parse date and time
        let dateInput = args[0];
        let timeInput = args[1];
        let noteStartIndex = 2;

        // Parse the date
        let scheduledTime = parseUserFriendlyDate(dateInput);
        if (!scheduledTime) {
          await message.reply(
            "❌ Invalid date format. Use YYYY-MM-DD, today, tomorrow, +Nhours, or +Nminutes."
          );
          return;
        }

        // If using +hours or +minutes format, we don't need the time parameter
        if (dateInput.startsWith("+")) {
          timeInput = null;
          noteStartIndex = 1;
        }

        // Set time if timeInput is provided
        if (timeInput) {
          scheduledTime = parseTimeString(timeInput, scheduledTime);
          if (!scheduledTime) {
            await message.reply(
              "❌ Invalid time format. Use hour:minute (e.g., 20:00)."
            );
            return;
          }
        }

        // Get note if provided
        let note = "";
        if (args.length > noteStartIndex) {
          // Check if there's a quoted note
          const fullCommand = message.content;
          const noteRegex = new RegExp(
            `!invasion\\s+\\S+\\s+${timeInput ? "\\S+\\s+" : ""}"([^"]+)"`,
            "i"
          );
          const noteMatch = fullCommand.match(noteRegex);

          if (noteMatch) {
            note = noteMatch[1];
          } else {
            note = args.slice(noteStartIndex).join(" ");
          }
        }

        try {
          // Create invasion schedule with reminders
          const invasionInfo = scheduleManager.addInvasionSchedule(
            scheduledTime.toISOString(),
            note
          );

          // Format the reminders list for the confirmation message
          const remindersText = invasionInfo.reminders
            .map((r) => `• ${r} before`)
            .join("\n");

          // Prepare confirmation message
          let confirmMessage = `✅ Invasion scheduled successfully!\n`;
          confirmMessage += `**ID:** ${invasionInfo.id}\n`;
          confirmMessage += `**Invasion Time:** ${invasionInfo.scheduledTime.toUTCString()}\n`;
          confirmMessage += `**Automatic Reminders:**\n${remindersText}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to schedule invasion:", error);
          await message.reply(
            `❌ Failed to schedule invasion: ${error.message}`
          );
        }
      },
    };
  },
};

/**
 * Countdown invasion command
 */
const countdown = {
  name: "countdown",
  description: "Schedule an invasion based on a countdown timer",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 1) {
          const helpEmbed = new EmbedBuilder()
            .setTitle("⏱️ Schedule from In-Game Countdown")
            .setColor("#FF0000")
            .setDescription(
              "Use this command when you see a countdown timer in the game and want to sync alerts with it."
            )
            .addFields(
              {
                name: "⌨️ Basic Command",
                value: "`!countdown HH:MM:SS [note]`",
              },
              {
                name: "🔍 Examples",
                value: [
                  '`!countdown 19:38:49 "Boss invasion"`',
                  '`!countdown 2:30:00 "Guild war"`',
                  '`!countdown 0:45:30 "Quick raid"`',
                ].join("\n"),
              },
              {
                name: "⏰ Countdown Format",
                value:
                  "Hours:Minutes:Seconds as shown in the game\nExamples:\n• 19:38:49 (19 hours, 38 minutes, 49 seconds)\n• 2:30:00 (2 hours, 30 minutes)\n• 0:45:30 (45 minutes, 30 seconds)",
              },
              {
                name: "📝 Reminders",
                value:
                  "The system will automatically create reminders before the invasion starts.",
              }
            )
            .setTimestamp()
            .setFooter({ text: "Use this for in-game countdowns" });

          await message.reply({ embeds: [helpEmbed] });
          return;
        }

        const countdownStr = args[0];

        // Get note if provided
        let note = "";

        // Check if there's a quoted note
        const noteMatch = message.content.match(/!countdown\s+\S+\s+"([^"]+)"/);
        if (noteMatch) {
          note = noteMatch[1];
        } else if (args.length > 1) {
          note = args.slice(1).join(" ");
        }

        try {
          // Schedule invasion based on countdown
          const invasionInfo = scheduleManager.scheduleFromCountdown(
            countdownStr,
            note
          );

          // Calculate and display the human-readable countdown
          const totalSeconds = Math.floor(
            (invasionInfo.scheduledTime - new Date()) / 1000
          );
          const countdownHours = Math.floor(totalSeconds / 3600);
          const countdownMinutes = Math.floor((totalSeconds % 3600) / 60);
          const countdownSeconds = totalSeconds % 60;
          const formattedCountdown = `${countdownHours}h ${countdownMinutes}m ${countdownSeconds}s`;

          // Format the reminders list for the confirmation message
          const remindersText = invasionInfo.reminders
            .map((r) => `• ${r} before`)
            .join("\n");

          // Prepare confirmation message
          let confirmMessage = `✅ Invasion scheduled from countdown successfully!\n`;
          confirmMessage += `**Countdown entered:** ${countdownStr}\n`;
          confirmMessage += `**Time remaining:** ${formattedCountdown}\n`;
          confirmMessage += `**Invasion Time:** ${invasionInfo.scheduledTime.toUTCString()}\n`;
          confirmMessage += `**Automatic Reminders:**\n${remindersText}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to schedule from countdown:", error);
          await message.reply(
            `❌ Failed to schedule from countdown: ${error.message}`
          );
        }
      },
    };
  },
};

/**
 * Custom countdown invasion command
 */
const customCountdown = {
  name: "customcountdown",
  description:
    "Schedule an invasion based on a countdown timer with custom reminders",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 2) {
          const helpEmbed = new EmbedBuilder()
            .setTitle("⏱️ Custom Countdown with Specific Reminders")
            .setColor("#FF0000")
            .setDescription(
              "Use this command to schedule an invasion with custom reminder times."
            )
            .addFields(
              {
                name: "⌨️ Basic Command",
                value: "`!customcountdown HH:MM:SS R1:R2:R3 [note]`",
              },
              {
                name: "🔍 Examples",
                value: [
                  '`!customcountdown 19:38:49 60:30:10 "Boss invasion"`',
                  '`!customcountdown 2:30:00 120:60:30:15:5 "Guild war with many reminders"`',
                  '`!customcountdown 1:00:00 30:15:5 "Quick raid"`',
                ].join("\n"),
              },
              {
                name: "⏰ Countdown Format",
                value:
                  "First parameter: Hours:Minutes:Seconds as shown in the game\nExample: 19:38:49 (19 hours, 38 minutes, 49 seconds)",
              },
              {
                name: "⚙️ Reminder Format",
                value:
                  "Second parameter: Minutes before invasion for each reminder, separated by colons\nExample: 60:30:10 (reminders at 60 mins, 30 mins, and 10 mins before)",
              }
            )
            .setTimestamp()
            .setFooter({ text: "For advanced scheduling needs" });

          await message.reply({ embeds: [helpEmbed] });
          return;
        }

        const countdownStr = args[0];
        const reminderStr = args[1];

        // Get note if provided
        let note = "";

        // Check if there's a quoted note
        const noteMatch = message.content.match(
          /!customcountdown\s+\S+\s+\S+\s+"([^"]+)"/
        );
        if (noteMatch) {
          note = noteMatch[1];
        } else if (args.length > 2) {
          note = args.slice(2).join(" ");
        }

        try {
          // Parse the countdown string (format: HH:MM:SS or H:MM:SS)
          const countdownMatch = countdownStr.match(
            /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/
          );

          if (!countdownMatch) {
            throw new Error(
              "Invalid countdown format. Please use HH:MM:SS format (e.g., 19:38:49)"
            );
          }

          const hours = parseInt(countdownMatch[1]);
          const minutes = parseInt(countdownMatch[2]);
          const seconds = parseInt(countdownMatch[3]);

          // Calculate total seconds in the countdown
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;

          if (totalSeconds <= 0) {
            throw new Error("Countdown must be greater than zero");
          }

          // Calculate the invasion time based on current time + countdown
          const now = new Date();
          const invasionTime = new Date(now.getTime() + totalSeconds * 1000);

          // Parse custom reminder times (in minutes before invasion)
          const reminderMinutes = reminderStr
            .split(":")
            .map((r) => parseInt(r));

          if (reminderMinutes.some(isNaN)) {
            throw new Error(
              "Invalid reminder format. Please use numbers separated by colons (e.g., 60:30:10)"
            );
          }

          // Create invasion schedule with custom reminders
          const invasionInfo = scheduleManager.addInvasionSchedule(
            invasionTime.toISOString(),
            note,
            reminderMinutes
          );

          // Calculate and display the human-readable countdown
          const countdownHours = Math.floor(totalSeconds / 3600);
          const countdownMinutes = Math.floor((totalSeconds % 3600) / 60);
          const countdownSeconds = totalSeconds % 60;
          const formattedCountdown = `${countdownHours}h ${countdownMinutes}m ${countdownSeconds}s`;

          // Format the reminders list for the confirmation message
          const remindersText =
            invasionInfo.reminders.length > 0
              ? invasionInfo.reminders.map((r) => `• ${r} before`).join("\n")
              : "None (all reminders would occur in the past)";

          // Prepare confirmation message
          let confirmMessage = `✅ Custom invasion scheduled successfully!\n`;
          confirmMessage += `**Countdown entered:** ${countdownStr}\n`;
          confirmMessage += `**Time remaining:** ${formattedCountdown}\n`;
          confirmMessage += `**Invasion Time:** ${invasionInfo.scheduledTime.toUTCString()}\n`;
          confirmMessage += `**Reminders:**\n${remindersText}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to schedule custom countdown:", error);
          await message.reply(
            `❌ Failed to schedule custom countdown: ${error.message}`
          );
        }
      },
    };
  },
};

/**
 * Test notification command
 */
const testNotif = {
  name: "testnotif",
  description: "Send a test notification",
  create(client, scheduleManager) {
    return {
      async execute(message) {
        if (!(await checkAdmin(message))) return;

        // Confirm to the user that we're sending a test notification
        await message.reply("Sending a test notification...");

        // Get the target channel ID
        const targetChannelId = scheduleManager.getTargetChannel();

        try {
          const notificationSent =
            await scheduleManager.notificationService.sendTestNotification(
              targetChannelId
            );

          if (notificationSent) {
            await message.reply("✅ Test notification sent successfully!");
          } else {
            await message.reply(
              "❌ Failed to send test notification. Check console for details."
            );
          }
        } catch (error) {
          console.error("Failed to send test notification:", error);
          await message.reply(
            `❌ Failed to send test notification: ${error.message}`
          );
        }
      },
    };
  },
};

/**
 * Recurring invasion command
 */
const recurringInvasion = {
  name: "recurringinvasion",
  description: "Schedule a recurring invasion",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 2) {
          const helpEmbed = new EmbedBuilder()
            .setTitle("🔄 Recurring Invasion Schedule")
            .setColor("#FF0000")
            .setDescription("Schedule invasions that repeat automatically")
            .addFields(
              {
                name: "⌨️ Basic Command",
                value: "`!recurringInvasion [days] [hour:minute] [note]`",
              },
              {
                name: "🔍 Examples",
                value: [
                  '`!recurringInvasion every2days 20:00 "Bi-daily invasion"`',
                  '`!recurringInvasion mon,wed,fri 18:30 "MWF alliance wars"`',
                  '`!recurringInvasion weekend 12:00 "Weekend raids"`',
                  '`!recurringInvasion daily 20:00 "Daily guild war"`',
                ].join("\n"),
              },
              {
                name: "📆 Day Options",
                value: [
                  "`daily` - Every day",
                  "`weekend` - Saturday and Sunday",
                  "`weekday` - Monday through Friday",
                  "`mon,tue,wed,thu,fri,sat,sun` - Specific days (use commas)",
                  "`every2days` - Every 2 days",
                  "`every3days` - Every 3 days",
                ].join("\n"),
              },
              {
                name: "⏰ Time Format",
                value:
                  "`hour:minute` in 24-hour format (e.g., 20:00 for 8:00 PM)",
              }
            )
            .setTimestamp()
            .setFooter({ text: "All times are in UTC" });

          await message.reply({ embeds: [helpEmbed] });
          return;
        }

        // Parse the day and time inputs
        const dayInput = args[0].toLowerCase();
        const timeInput = args[1];

        // Parse time
        const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);

        if (!timeMatch) {
          await message.reply(
            "❌ Invalid time format. Use hour:minute (e.g., 20:00 for 8:00 PM)."
          );
          return;
        }

        const hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          await message.reply(
            "❌ Invalid time. Hours must be 0-23 and minutes must be 0-59."
          );
          return;
        }

        // Get note if provided
        let note = "";

        // Check if there's a quoted note
        const noteMatch = message.content.match(
          /!recurringInvasion\s+\S+\s+\S+\s+"([^"]+)"/
        );
        if (noteMatch) {
          note = noteMatch[1];
        } else if (args.length > 2) {
          note = args.slice(2).join(" ");
        }

        try {
          // Create cron pattern from day and time inputs
          const cronPattern = createCronPattern(
            dayInput,
            hour.toString(),
            minute.toString()
          );

          // Add the recurring invasion schedule
          const scheduleInfo = scheduleManager.addSchedule(
            cronPattern,
            note,
            "recurring-invasion"
          );

          // Prepare confirmation message
          let confirmMessage = `✅ Recurring invasion schedule created successfully!\n`;
          confirmMessage += `**ID:** ${scheduleInfo.id}\n`;
          confirmMessage += `**Pattern:** \`${scheduleInfo.pattern}\`\n`;
          confirmMessage += `**Description:** ${scheduleInfo.description}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to create recurring invasion schedule:", error);
          await message.reply(
            `❌ Failed to create recurring invasion schedule: ${error.message}`
          );
        }
      },
    };
  },
};

module.exports = {
  invasion,
  countdown,
  customCountdown,
  testNotif,
  recurringInvasion,
};
