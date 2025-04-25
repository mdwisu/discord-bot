// src/commands/schedule.js
const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
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
 * Easy schedule creation command
 */
const scheduleEasy = {
  name: "scheduleeasy",
  description: "Create a schedule using simple format",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 2) {
          const helpEmbed = new EmbedBuilder()
            .setTitle("📅 Easy Schedule Creation")
            .setColor("#00AAFF")
            .setDescription("Add a schedule using a simple format")
            .addFields(
              {
                name: "Format",
                value: "!scheduleEasy [days] [hour:minute] [note]",
              },
              {
                name: "Examples",
                value: [
                  '`!scheduleEasy daily 20:00 "Daily evening notification"`',
                  '`!scheduleEasy mon,wed,fri 20:00 "Weekday evenings"`',
                  '`!scheduleEasy weekend 12:00 "Weekend noon"`',
                  '`!scheduleEasy every2days 8:00 "Every 2 days morning"`',
                ].join("\n"),
              },
              {
                name: "Day Options",
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
                name: "Time Format",
                value:
                  "`hour:minute` in 24-hour format (e.g., 20:00 for 8:00 PM)",
              }
            )
            .setTimestamp()
            .setFooter({ text: "Invasion Notification Bot" });

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
          /!scheduleEasy\s+\S+\s+\S+\s+"([^"]+)"/
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

          // Add the schedule
          const scheduleInfo = scheduleManager.addSchedule(cronPattern, note);

          // Prepare confirmation message
          let confirmMessage = `✅ Schedule added successfully!\n`;
          confirmMessage += `**ID:** ${scheduleInfo.id}\n`;
          confirmMessage += `**Pattern:** \`${scheduleInfo.pattern}\`\n`;
          confirmMessage += `**Description:** ${scheduleInfo.description}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to add schedule:", error);
          await message.reply(`❌ Failed to add schedule: ${error.message}`);
        }
      },
    };
  },
};

/**
 * Advanced schedule creation command
 */
const addSchedule = {
  name: "addschedule",
  description: "Add a schedule using cron pattern",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        // Extract the pattern - needs to handle quoted strings with spaces
        const fullCommand = message.content.trim();
        let pattern = "";
        let note = "";

        // Check if the pattern is in quotes
        const patternMatch = fullCommand.match(
          /!addSchedule\s+"([^"]+)"\s*(.*)/
        );

        if (patternMatch) {
          // Pattern was in quotes
          pattern = patternMatch[1];
          note = patternMatch[2] || "";
        } else {
          // No quotes, just space separated
          if (args.length < 1) {
            const helpEmbed = new EmbedBuilder()
              .setTitle("📅 Schedule Creation Help")
              .setColor("#00AAFF")
              .setDescription(
                "Add a new notification schedule using cron patterns"
              )
              .addFields(
                { name: "Format", value: '!addSchedule "pattern" [note]' },
                {
                  name: "Example",
                  value: '!addSchedule "0 20 * * 1,3,5" "Weekday evenings"',
                },
                {
                  name: "Common Patterns",
                  value: [
                    "`0 20 * * *` - Every day at 8:00 PM",
                    "`0 20 * * 1,3,5` - Monday, Wednesday, Friday at 8:00 PM",
                    "`0 */6 * * *` - Every 6 hours (at 00:00, 06:00, 12:00, 18:00)",
                    "`0 8 */2 * *` - Every 2 days at 8:00 AM",
                    "`0 20 * * 0,6` - Weekends (Saturday and Sunday) at 8:00 PM",
                  ].join("\n"),
                },
                {
                  name: "Pattern Format",
                  value:
                    '`minute hour dayOfMonth month dayOfWeek`\nUse * for "any" and */n for "every n"',
                },
                {
                  name: "Days of Week",
                  value:
                    "0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday",
                },
                {
                  name: "Tip",
                  value:
                    "For easier scheduling, try using !scheduleEasy command",
                }
              )
              .setTimestamp()
              .setFooter({ text: "Invasion Notification Bot" });

            await message.reply({ embeds: [helpEmbed] });
            return;
          }

          pattern = args[0];
          note = args.slice(1).join(" ");
        }

        try {
          // Add schedule
          const scheduleInfo = scheduleManager.addSchedule(pattern, note);

          // Prepare confirmation message
          let confirmMessage = `✅ Schedule added successfully!\n`;
          confirmMessage += `**ID:** ${scheduleInfo.id}\n`;
          confirmMessage += `**Pattern:** \`${scheduleInfo.pattern}\`\n`;
          confirmMessage += `**Description:** ${scheduleInfo.description}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to add schedule:", error);
          await message.reply(`❌ Failed to add schedule: ${error.message}`);
        }
      },
    };
  },
};

/**
 * Remove schedule command
 */
const removeSchedule = {
  name: "removeschedule",
  description: "Remove a schedule by ID",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 1) {
          await message.reply(
            "Format: !removeSchedule [scheduleId]\nUse !listSchedules to see available schedule IDs"
          );
          return;
        }

        const scheduleId = args[0];

        try {
          // Remove schedule
          const removedSchedule = scheduleManager.removeSchedule(scheduleId);

          // Prepare confirmation message
          let confirmMessage = `✅ Schedule removed successfully!\n`;
          confirmMessage += `**ID:** ${removedSchedule.id}\n`;
          confirmMessage += `**Pattern:** \`${removedSchedule.pattern}\`\n`;
          confirmMessage += `**Description:** ${removedSchedule.description}\n`;

          if (removedSchedule.note) {
            confirmMessage += `**Note:** ${removedSchedule.note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to remove schedule:", error);
          await message.reply(`❌ Failed to remove schedule: ${error.message}`);
        }
      },
    };
  },
};

/**
 * List schedules command
 */
const listSchedules = {
  name: "listschedules",
  description: "List all active schedules",
  create(client, scheduleManager) {
    return {
      async execute(message) {
        const activeSchedules = scheduleManager.getAllSchedules();
        const scheduleIds = Object.keys(activeSchedules);

        if (scheduleIds.length === 0) {
          await message.reply(
            "No active schedules configured. Use !addSchedule to create one."
          );
          return;
        }

        // Create embed for schedule listing
        const embed = new EmbedBuilder()
          .setTitle("📅 Active Notification Schedules")
          .setColor("#00AAFF")
          .setTimestamp()
          .setFooter({ text: "Invasion Notification Bot" });

        // Add each schedule to the embed
        scheduleIds.forEach((scheduleId) => {
          const schedule = activeSchedules[scheduleId];
          let fieldValue = `**Type:** ${schedule.type || "recurring"}\n`;

          if (schedule.pattern) {
            fieldValue += `**Pattern:** \`${schedule.pattern}\`\n`;
          }

          fieldValue += `**Description:** ${schedule.description}\n`;
          fieldValue += `**Created:** ${schedule.created}\n`;

          if (schedule.scheduledTime) {
            fieldValue += `**Scheduled Time:** ${schedule.scheduledTime.toUTCString()}\n`;
          }

          if (schedule.note) {
            fieldValue += `**Note:** ${schedule.note}\n`;
          }

          embed.addFields({ name: `ID: ${scheduleId}`, value: fieldValue });
        });

        // Add target channel information
        const targetChannelId = scheduleManager.getTargetChannel();
        const targetChannel = client.channels.cache.get(targetChannelId);
        const channelInfo = targetChannel
          ? `#${targetChannel.name}`
          : "Channel not found";
        embed.addFields({
          name: "📢 Target Channel",
          value: `${channelInfo} (ID: ${targetChannelId})`,
        });

        // Add current time information
        const currentTime = new Date();
        const utcTime = currentTime.toUTCString();
        const day = currentTime.getUTCDay();
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        embed.addFields({
          name: "🕒 Current Time (UTC)",
          value: `${utcTime}\nDay: ${dayNames[day]} (${day})`,
        });

        // Send embed to user
        await message.reply({ embeds: [embed] });
      },
    };
  },
};

/**
 * View upcoming schedules/countdowns
 */
const schedules = {
  name: "schedules",
  description: "View all upcoming schedules with countdowns",
  aliases: ["countdownschedules", "schedule"],
  create(client, scheduleManager) {
    return {
      async execute(message) {
        const activeSchedules = scheduleManager.getAllSchedules();
        const scheduleIds = Object.keys(activeSchedules);

        if (scheduleIds.length === 0) {
          await message.reply(
            "No active schedules configured. Use !scheduleEasy, !scheduleOnce, or !reminder to create one."
          );
          return;
        }

        // Create schedules embed
        const schedulesEmbed =
          embedBuilder.createSchedulesEmbed(activeSchedules);

        // Send embed to user
        await message.reply({ embeds: [schedulesEmbed] });
      },
    };
  },
};

/**
 * View schedule history
 */
const scheduleHistory = {
  name: "schedulehistory",
  description: "View schedule creation/removal history",
  create(client, scheduleManager) {
    return {
      async execute(message) {
        const history = scheduleManager.getScheduleHistory();

        if (history.length === 0) {
          await message.reply("No schedule history available.");
          return;
        }

        // Create history embed
        const historyEmbed = embedBuilder.createHistoryEmbed(history);

        // Send embed to user
        await message.reply({ embeds: [historyEmbed] });
      },
    };
  },
};

module.exports = {
  scheduleEasy,
  addSchedule,
  removeSchedule,
  listSchedules,
  schedules,
  scheduleHistory,
};
