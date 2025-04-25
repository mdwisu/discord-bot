// src/commands/reminder.js
const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const {
  parseUserFriendlyDate,
  parseTimeString,
} = require("../utils/dateUtils");

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
 * Reminder command
 */
const reminder = {
  name: "reminder",
  description: "Schedule a one-time general reminder",
  create(client, scheduleManager) {
    return {
      async execute(message, args) {
        if (!(await checkAdmin(message))) return;

        if (args.length < 3) {
          const helpEmbed = new EmbedBuilder()
            .setTitle("📝 One-Time Reminder Creation")
            .setColor("#3498DB")
            .setDescription("Schedule a one-time general reminder")
            .addFields(
              {
                name: "Format",
                value: "!reminder [date] [time] [title] [message] [note]",
              },
              {
                name: "Examples",
                value: [
                  '`!reminder tomorrow 15:00 "Team Meeting" "Don\'t forget our weekly team meeting" "Important"`',
                  '`!reminder +2hours "Gather Resources" "Time to collect resources!"`',
                  '`!reminder 2023-12-25 08:00 "Christmas" "Merry Christmas everyone!"`',
                ].join("\n"),
              },
              {
                name: "Date Formats",
                value: [
                  "`YYYY-MM-DD` - Specific date (e.g., 2023-12-31)",
                  "`today` - Today's date",
                  "`tomorrow` - Tomorrow's date",
                  "`+NUMhours` - Num hours from now (e.g., +2hours)",
                  "`+NUMminutes` - Num minutes from now (e.g., +30minutes)",
                ].join("\n"),
              },
              {
                name: "Time Format",
                value:
                  "`hour:minute` in 24-hour format (e.g., 15:00 for 3:00 PM)\nNot needed when using +hours or +minutes format",
              },
              {
                name: "Title & Message",
                value:
                  'Use quotes for multi-word title and message: "Your Title" "Your detailed message"',
              },
              {
                name: "Note",
                value:
                  "Optional additional information (use quotes for multi-word notes)",
              }
            )
            .setTimestamp()
            .setFooter({ text: "Notification Bot" });

          await message.reply({ embeds: [helpEmbed] });
          return;
        }

        // Parse date and time
        let dateInput = args[0];
        let timeInput = args[1];
        let argIndex = 2; // Starting index for title

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
          argIndex = 1; // Title starts earlier when no time
        } else if (timeInput) {
          // Set time if timeInput is provided
          scheduledTime = parseTimeString(timeInput, scheduledTime);
          if (!scheduledTime) {
            await message.reply(
              "❌ Invalid time format. Use hour:minute (e.g., 15:00)."
            );
            return;
          }
        }

        // Parse title, message, and note from the remaining text
        const fullText = message.content.substring(
          message.content.indexOf(args[argIndex])
        );

        // Try to extract quoted title and message
        let title = "General Reminder";
        let reminderMessage = "This is a reminder.";
        let note = "";

        // Match pattern for: "title" "message" "note"
        const quotedPartsRegex = /"([^"]+)"\s*"([^"]+)"(?:\s*"([^"]+)")?/;
        const quotedMatch = fullText.match(quotedPartsRegex);

        if (quotedMatch) {
          title = quotedMatch[1];
          reminderMessage = quotedMatch[2];
          note = quotedMatch[3] || "";
        } else {
          // If not in quotes, use the next argument as title and the rest as message
          title = args[argIndex];
          if (args.length > argIndex + 1) {
            reminderMessage = args.slice(argIndex + 1).join(" ");
          }
        }

        try {
          // Create one-time reminder
          const reminderInfo = scheduleManager.addOneTimeReminder(
            scheduledTime.toISOString(),
            title,
            reminderMessage,
            note
          );

          // Prepare confirmation message
          let confirmMessage = `✅ Reminder scheduled successfully!\n`;
          confirmMessage += `**ID:** ${reminderInfo.id}\n`;
          confirmMessage += `**Date/Time:** ${reminderInfo.scheduledTime.toUTCString()}\n`;
          confirmMessage += `**Title:** ${title}\n`;
          confirmMessage += `**Message:** ${reminderMessage}\n`;

          if (note) {
            confirmMessage += `**Note:** ${note}\n`;
          }

          await message.reply(confirmMessage);
        } catch (error) {
          console.error("Failed to add reminder:", error);
          await message.reply(`❌ Failed to add reminder: ${error.message}`);
        }
      },
    };
  },
};

module.exports = {
  reminder,
};
