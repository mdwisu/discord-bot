// Discord Bot for Invasion Attack Notifications with Multiple Schedule Management
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const cron = require("node-cron");
require("dotenv").config();

// You can also set up explicit reconnection options when initializing the client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  // Add reconnection options
  retryLimit: 10,
  restRequestTimeout: 30000, // Increase timeout to 30s
});

// Variable to store target channel ID
let targetChannelId = process.env.TARGET_CHANNEL_ID || "CHANNEL_ID_DEFAULT";

// Object to store active schedules
// Format: { "scheduleId": { pattern, job, description, created } }
let activeSchedules = {};

// Variable to store schedule history (limited to last 10)
let scheduleHistory = [];

// Event when bot is ready
client.once("ready", () => {
  console.log(`Bot ready! Logged in as ${client.user.tag}`);
  console.log(`Current target channel ID: ${targetChannelId}`);
  console.log(`Current UTC time: ${new Date().toUTCString()}`);

  // Setup default schedule if provided in .env
  const defaultPattern = process.env.SCHEDULE_PATTERN;
  if (defaultPattern) {
    try {
      addSchedule(defaultPattern, "Default schedule from .env");
    } catch (error) {
      console.error("Failed to create default schedule:", error);
    }
  }
});

// Function to handle countdown timer input and schedule invasion
function scheduleFromCountdown(countdownStr, note = "") {
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

    console.log(
      `Calculated invasion time from countdown ${countdownStr}: ${invasionTime.toUTCString()}`
    );

    // Use the existing invasion scheduling function
    return addInvasionSchedule(invasionTime.toISOString(), note);
  } catch (error) {
    console.error("Failed to schedule from countdown:", error);
    throw error;
  }
}

// Function to create a unique ID for schedules
function generateScheduleId() {
  return "sched_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

// Function to add a new schedule
function addSchedule(pattern, note = "") {
  try {
    // Validate the pattern
    cron.validate(pattern);

    // Generate unique ID for this schedule
    const scheduleId = generateScheduleId();

    // Create the cron job
    const job = cron.schedule(
      pattern,
      () => {
        console.log(
          `Schedule ${scheduleId} running at: ${new Date().toUTCString()}`
        );
        sendInvasionNotification(scheduleId);
      },
      {
        timezone: "UTC", // Important to set timezone to UTC
      }
    );

    // Create human-readable description
    const description = translateCronToHumanReadable(pattern);

    // Add to active schedules
    activeSchedules[scheduleId] = {
      pattern: pattern,
      job: job,
      description: description,
      created: new Date().toUTCString(),
      note: note,
    };

    console.log(`New schedule created with ID ${scheduleId}: ${pattern} (UTC)`);

    // Add to schedule history
    addToScheduleHistory(scheduleId, pattern, description, note);

    return {
      id: scheduleId,
      pattern: pattern,
      description: description,
    };
  } catch (error) {
    console.error("Failed to create schedule:", error);
    throw error;
  }
}

// Function to send a general reminder notification
function sendGeneralReminder(
  scheduleId = null,
  reminderTitle = "General Reminder",
  reminderMessage = "This is a general reminder."
) {
  console.log(
    `Attempting to send general reminder to channel ID: ${targetChannelId}`
  );

  const channel = client.channels.cache.get(targetChannelId);

  if (!channel) {
    console.error("Channel not found!");
    console.error("List of available channels:");
    client.channels.cache.forEach((ch) => {
      console.log(`- ${ch.name}: ${ch.id}`);
    });
    return;
  }

  // Get schedule info if available
  let scheduleInfo = "Manual reminder";
  if (scheduleId && activeSchedules[scheduleId]) {
    if (activeSchedules[scheduleId].type === "one-time") {
      scheduleInfo = `One-time Reminder ID: ${scheduleId}`;
    } else {
      scheduleInfo = `Reminder ID: ${scheduleId} (${activeSchedules[scheduleId].pattern})`;
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

  // Send embed to channel - no @everyone mention for general reminders
  channel
    .send({ embeds: [embed] })
    .then(() => console.log("General reminder sent!"))
    .catch((error) => console.error("Failed to send reminder:", error));
}

// Function to add a one-time general reminder
function addOneTimeReminder(dateTimeStr, title, message, note = "") {
  try {
    // Parse the date/time string to a Date object
    const scheduledTime = new Date(dateTimeStr);

    // Check if the date is valid and in the future
    const now = new Date();
    if (isNaN(scheduledTime.getTime())) {
      throw new Error("Invalid date/time format");
    }
    if (scheduledTime <= now) {
      throw new Error("Scheduled time must be in the future");
    }

    // Calculate milliseconds until the scheduled time
    const delay = scheduledTime.getTime() - now.getTime();

    // Generate unique ID for this schedule
    const scheduleId =
      "reminder_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    // Create human-readable description
    const description = `General reminder: ${title} at ${scheduledTime.toUTCString()}`;

    // Store the reminder title and message in the schedule
    const reminderData = {
      title: title,
      message: message,
    };

    // Set the timeout
    const timeoutId = setTimeout(() => {
      console.log(
        `One-time reminder ${scheduleId} running at: ${new Date().toUTCString()}`
      );
      sendGeneralReminder(scheduleId, reminderData.title, reminderData.message);

      // After running, remove it from active schedules
      delete activeSchedules[scheduleId];

      // Add to history as 'completed'
      addToScheduleHistory(
        scheduleId,
        `One-time reminder at ${scheduledTime.toUTCString()}`,
        description,
        note,
        true,
        "completed"
      );
    }, delay);

    // Add to active schedules with special type marker
    activeSchedules[scheduleId] = {
      type: "one-time-reminder",
      scheduledTime: scheduledTime, // Store as Date object, not string
      timeoutId: timeoutId,
      description: description,
      created: new Date().toUTCString(),
      note: note,
      reminderData: reminderData, // Store the reminder title and message
    };

    console.log(
      `New one-time reminder created with ID ${scheduleId}: ${scheduledTime.toUTCString()}`
    );

    // Add to schedule history
    addToScheduleHistory(
      scheduleId,
      `One-time reminder at ${scheduledTime.toUTCString()}`,
      description,
      note
    );

    return {
      id: scheduleId,
      scheduledTime: scheduledTime, // Return as Date object
      description: description,
    };
  } catch (error) {
    console.error("Failed to create one-time reminder:", error);
    throw error;
  }
}

// Function to remove a schedule
function removeSchedule(scheduleId) {
  if (activeSchedules[scheduleId]) {
    // Stop the cron job
    activeSchedules[scheduleId].job.stop();

    // Store information about the removed schedule
    const removedSchedule = {
      id: scheduleId,
      pattern: activeSchedules[scheduleId].pattern,
      description: activeSchedules[scheduleId].description,
      created: activeSchedules[scheduleId].created,
      removed: new Date().toUTCString(),
      note: activeSchedules[scheduleId].note,
    };

    // Remove from active schedules
    delete activeSchedules[scheduleId];

    console.log(`Schedule ${scheduleId} removed`);

    // Add to schedule history with removal info
    addToScheduleHistory(
      scheduleId,
      removedSchedule.pattern,
      removedSchedule.description,
      removedSchedule.note,
      true
    );

    return removedSchedule;
  } else {
    throw new Error(`Schedule with ID ${scheduleId} not found`);
  }
}

// Function to add to schedule history
function addToScheduleHistory(
  id,
  pattern,
  description,
  note = "",
  removed = false
) {
  const historyEntry = {
    id: id,
    pattern: pattern,
    description: description,
    timestamp: new Date().toUTCString(),
    action: removed ? "removed" : "created",
    note: note,
  };

  scheduleHistory.push(historyEntry);

  // Limit history to last 20 entries
  if (scheduleHistory.length > 20) {
    scheduleHistory.shift(); // Remove oldest entry
  }
}

// Function to translate cron pattern to human readable text
function translateCronToHumanReadable(pattern) {
  try {
    const parts = pattern.split(" ");
    if (parts.length !== 5) return "Invalid format";

    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];

    let description = "";

    // Translate days of week
    if (dayOfWeek !== "*") {
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      if (dayOfWeek.includes(",")) {
        // Format: 1,3,5
        const days = dayOfWeek.split(",").map((d) => parseInt(d));
        const dayNamesSelected = days.map((d) => dayNames[d]).join(", ");
        description += `every ${dayNamesSelected} `;
      } else if (dayOfWeek.includes("-")) {
        // Format: 1-5
        const [start, end] = dayOfWeek.split("-").map((d) => parseInt(d));
        description += `every day from ${dayNames[start]} to ${dayNames[end]} `;
      } else if (dayOfWeek.includes("/")) {
        // Format: */2
        const interval = dayOfWeek.split("/")[1];
        description += `every ${interval} days `;
      } else {
        // Format: 1
        description += `every ${dayNames[parseInt(dayOfWeek)]} `;
      }
    } else if (dayOfMonth.includes("*/")) {
      // Format: */2
      const interval = dayOfMonth.split("/")[1];
      description += `every ${interval} days `;
    } else if (dayOfMonth !== "*") {
      // Format: specific date
      description += `on day ${dayOfMonth} of each month `;
    } else {
      description += "every day ";
    }

    // Translate hours
    if (hour !== "*") {
      if (hour.includes(",")) {
        // Format: 9,15,21
        const hours = hour.split(",").join(", ");
        description += `at ${hours}:${minute} UTC`;
      } else if (hour.includes("-")) {
        // Format: 9-17
        const [start, end] = hour.split("-");
        description += `from ${start}:${minute} to ${end}:${minute} UTC`;
      } else if (hour.includes("/")) {
        // Format: */2
        const interval = hour.split("/")[1];
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
    console.error("Failed to translate cron pattern:", error);
    return "Complex format";
  }
}

// Function to add a one-time invasion schedule with multiple reminders
function addInvasionSchedule(invasionTimeStr, note = "") {
  try {
    // Parse the invasion time string to a Date object
    const invasionTime = new Date(invasionTimeStr);

    // Check if the date is valid and in the future
    const now = new Date();
    if (isNaN(invasionTime.getTime())) {
      throw new Error("Invalid date/time format");
    }
    if (invasionTime <= now) {
      throw new Error("Scheduled time must be in the future");
    }

    // Generate a unique invasion ID that will be shared by all related events
    const invasionId =
      "invasion_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    // Create human-readable description
    const description = `Invasion at ${invasionTime.toUTCString()}`;

    // Schedule the actual invasion alert
    const invasionDelay = invasionTime.getTime() - now.getTime();
    const invasionTimeoutId = setTimeout(() => {
      console.log(
        `Invasion ${invasionId} starting at: ${new Date().toUTCString()}`
      );
      sendInvasionStartNotification(invasionId, invasionTime);

      // After running, remove it from active schedules
      delete activeSchedules[invasionId];
      Object.keys(activeSchedules).forEach((id) => {
        if (id.startsWith(`${invasionId}_reminder_`)) {
          delete activeSchedules[id];
        }
      });

      // Add to history as 'completed'
      addToScheduleHistory(
        invasionId,
        `Invasion at ${invasionTime.toUTCString()}`,
        description,
        note,
        true,
        "completed"
      );
    }, invasionDelay);

    // Add main invasion to active schedules
    activeSchedules[invasionId] = {
      type: "invasion",
      scheduledTime: invasionTime,
      timeoutId: invasionTimeoutId,
      description: description,
      created: new Date().toUTCString(),
      note: note,
      remindersSent: [],
    };

    // Schedule reminder notifications at various times before the invasion
    const reminderTimes = [
      { minutes: 60, label: "1 hour" }, // 1 hour before
      { minutes: 30, label: "30 minutes" }, // 30 minutes before
      { minutes: 10, label: "10 minutes" }, // 10 minutes before
    ];

    reminderTimes.forEach((reminder) => {
      const reminderTime = new Date(
        invasionTime.getTime() - reminder.minutes * 60 * 1000
      );

      // Skip reminders that would occur in the past
      if (reminderTime <= now) {
        console.log(
          `Skipping ${reminder.label} reminder for invasion ${invasionId} - would occur in the past`
        );
        return;
      }

      const reminderId = `${invasionId}_reminder_${reminder.minutes}`;
      const reminderDelay = reminderTime.getTime() - now.getTime();

      console.log(
        `Scheduling ${
          reminder.label
        } reminder for invasion ${invasionId} at ${reminderTime.toUTCString()}`
      );

      const reminderTimeoutId = setTimeout(() => {
        console.log(
          `Sending ${reminder.label} reminder for invasion ${invasionId}`
        );
        sendInvasionReminderNotification(
          invasionId,
          reminder.label,
          reminderTime,
          invasionTime
        );

        // After running, remove just this reminder from active schedules
        delete activeSchedules[reminderId];

        // Add this reminder to the list of sent reminders for the main invasion
        if (activeSchedules[invasionId]) {
          activeSchedules[invasionId].remindersSent.push(reminder.label);
        }

        // Add to history as 'completed reminder'
        addToScheduleHistory(
          reminderId,
          `Invasion reminder (${reminder.label} before)`,
          `Reminder for invasion at ${invasionTime.toUTCString()}`,
          note,
          true,
          "completed reminder"
        );
      }, reminderDelay);

      // Add this reminder to active schedules
      activeSchedules[reminderId] = {
        type: "invasion-reminder",
        parentId: invasionId,
        reminderTime: reminderTime,
        invasionTime: invasionTime,
        timeUntilInvasion: reminder.label,
        timeoutId: reminderTimeoutId,
        description: `${
          reminder.label
        } reminder for invasion at ${invasionTime.toUTCString()}`,
        created: new Date().toUTCString(),
        note: note,
      };
    });

    console.log(
      `New invasion schedule created with ID ${invasionId}: ${invasionTime.toUTCString()} with ${
        reminderTimes.length
      } reminders`
    );

    // Add to schedule history
    addToScheduleHistory(
      invasionId,
      `Invasion at ${invasionTime.toUTCString()}`,
      description,
      note
    );

    return {
      id: invasionId,
      scheduledTime: invasionTime,
      description: description,
      reminders: reminderTimes.map((r) => r.label),
    };
  } catch (error) {
    console.error("Failed to create invasion schedule:", error);
    throw error;
  }
}

// Function to send an invasion reminder notification
function sendInvasionReminderNotification(
  invasionId,
  timeUntilInvasion,
  reminderTime,
  invasionTime
) {
  console.log(
    `Attempting to send invasion reminder to channel ID: ${targetChannelId}`
  );

  const channel = client.channels.cache.get(targetChannelId);

  if (!channel) {
    console.error("Channel not found!");
    return;
  }

  // Calculate remaining time in a human-readable format
  const remainingTime = formatTimeUntil(invasionTime);

  // Create attractive embed message for reminder
  const embed = new EmbedBuilder()
    .setTitle("⚠️ INVASION INCOMING ⚠️")
    .setDescription(
      `An invasion will start in **${timeUntilInvasion}**! Start preparing your attack!`
    )
    .setColor("#FFA500") // Orange for reminders
    .addFields(
      { name: "Invasion Start", value: invasionTime.toUTCString() },
      { name: "Time Remaining", value: remainingTime },
      {
        name: "Preparations",
        value: "Teleport closer and bring your troops back!",
      },
      { name: "Current Time (UTC)", value: new Date().toUTCString() },
      { name: "Invasion ID", value: invasionId }
    )
    .setTimestamp()
    .setFooter({ text: "Invasion Notification System" });

  // Send embed to channel - use @here for reminders rather than @everyone
  channel
    .send({ content: "@here Prepare for invasion!", embeds: [embed] })
    .then(() => console.log("Invasion reminder notification sent!"))
    .catch((error) =>
      console.error("Failed to send reminder notification:", error)
    );
}

// Function to send the actual invasion start notification
function sendInvasionStartNotification(invasionId, invasionTime) {
  console.log(
    `Attempting to send invasion start notification to channel ID: ${targetChannelId}`
  );

  const channel = client.channels.cache.get(targetChannelId);

  if (!channel) {
    console.error("Channel not found!");
    return;
  }

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

  // Send embed to channel with @everyone for the actual invasion
  channel
    .send({
      content: "@everyone INVASION HAS STARTED! ATTACK NOW!",
      embeds: [embed],
    })
    .then(() => console.log("Invasion start notification sent!"))
    .catch((error) =>
      console.error("Failed to send invasion notification:", error)
    );
}

// Helper function to format time until invasion in a human-readable way
function formatTimeUntil(targetTime) {
  const now = new Date();
  const timeUntil = targetTime.getTime() - now.getTime();

  if (timeUntil <= 0) {
    return "Happening now!";
  }

  // Calculate human-readable time difference
  const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

  let countdownText = "";
  if (days > 0) countdownText += `${days} days, `;
  if (hours > 0 || days > 0) countdownText += `${hours} hours, `;
  if (minutes > 0 || hours > 0 || days > 0)
    countdownText += `${minutes} minutes, `;
  countdownText += `${seconds} seconds`;

  return countdownText;
}

// Function to send invasion notification
function sendInvasionNotification(scheduleId = null) {
  console.log(
    `Attempting to send notification to channel ID: ${targetChannelId}`
  );

  const channel = client.channels.cache.get(targetChannelId);

  if (!channel) {
    console.error("Channel not found!");
    console.error("List of available channels:");
    client.channels.cache.forEach((ch) => {
      console.log(`- ${ch.name}: ${ch.id}`);
    });
    return;
  }

  // Get schedule info if available
  let scheduleInfo = "Automatic schedule";
  if (scheduleId && activeSchedules[scheduleId]) {
    scheduleInfo = `Schedule ID: ${scheduleId} (${activeSchedules[scheduleId].pattern})`;
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

  // Send embed to channel
  channel
    .send({
      content: "@everyone Attention! Invasion will begin soon!",
      embeds: [embed],
    })
    .then(() => console.log("Invasion notification sent!"))
    .catch((error) => console.error("Failed to send notification:", error));
}

// Command handler
client.on("messageCreate", (message) => {
  console.log(
    `Message received: "${message.content}" from ${message.author.tag}`
  );

  // Ignore messages from other bots
  if (message.author.bot) {
    console.log("Message ignored because it came from a bot");
    return;
  }

  // Admin permission check function
  const checkAdmin = () => {
    const hasAdminPerms =
      message.member &&
      message.member.permissions.has(PermissionFlagsBits.Administrator);
    console.log(`User has admin permissions: ${hasAdminPerms}`);

    if (!hasAdminPerms) {
      message
        .reply("You do not have permission to use this command!")
        .catch((err) =>
          console.error("Failed to reply to permission check:", err)
        );
      return false;
    }
    return true;
  };

  // Command: !setChannel
  if (message.content.startsWith("!setChannel")) {
    console.log("Command !setChannel detected");

    if (!checkAdmin()) return;

    // Set new channel
    targetChannelId = message.channel.id;
    console.log(`New channel ID set: ${targetChannelId}`);

    message
      .reply(
        `Notification channel set to: ${message.channel.name} (ID: ${targetChannelId})`
      )
      .catch((err) =>
        console.error(
          "Failed to reply to setChannel confirmation message:",
          err
        )
      );
  }

  // Command: !countdown HH:MM:SS [note]
  // Example: !countdown 19:38:49 "Boss invasion"
  if (message.content.startsWith("!countdown")) {
    console.log("Command !countdown detected");

    if (!checkAdmin()) return;

    const args = message.content.trim().split(" ");

    if (args.length < 2) {
      const helpEmbed = new EmbedBuilder()
        .setTitle("⏱️ Schedule from In-Game Countdown")
        .setColor("#FF0000")
        .setDescription(
          "Use this command when you see a countdown timer in the game and want to sync alerts with it."
        )
        .addFields(
          { name: "⌨️ Basic Command", value: "`!countdown HH:MM:SS [note]`" },
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

      message
        .reply({ embeds: [helpEmbed] })
        .catch((err) =>
          console.error("Failed to reply to countdown help message:", err)
        );
      return;
    }

    const countdownStr = args[1];

    // Get note if provided
    let note = "";

    // Check if there's a quoted note
    const noteMatch = message.content.match(/!countdown\s+\S+\s+"([^"]+)"/);
    if (noteMatch) {
      note = noteMatch[1];
    } else if (args.length > 2) {
      note = args.slice(2).join(" ");
    }

    try {
      // Schedule invasion based on countdown
      const invasionInfo = scheduleFromCountdown(countdownStr, note);

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

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to countdown confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to schedule from countdown:", error);
      message
        .reply(`❌ Failed to schedule from countdown: ${error.message}`)
        .catch((err) =>
          console.error("Failed to reply to countdown error message:", err)
        );
    }
  }

  // Command: !customcountdown HH:MM:SS R1:R2:R3 [note]
  // Example: !customcountdown 19:38:49 60:30:10 "Boss invasion with custom reminders"
  if (message.content.startsWith("!customcountdown")) {
    console.log("Command !customcountdown detected");

    if (!checkAdmin()) return;

    const args = message.content.trim().split(" ");

    if (args.length < 3) {
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

      message
        .reply({ embeds: [helpEmbed] })
        .catch((err) =>
          console.error("Failed to reply to customcountdown help message:", err)
        );
      return;
    }

    const countdownStr = args[1];
    const reminderStr = args[2];

    // Get note if provided
    let note = "";

    // Check if there's a quoted note
    const noteMatch = message.content.match(
      /!customcountdown\s+\S+\s+\S+\s+"([^"]+)"/
    );
    if (noteMatch) {
      note = noteMatch[1];
    } else if (args.length > 3) {
      note = args.slice(3).join(" ");
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
      const reminderMinutes = reminderStr.split(":").map((r) => parseInt(r));

      if (reminderMinutes.some(isNaN)) {
        throw new Error(
          "Invalid reminder format. Please use numbers separated by colons (e.g., 60:30:10)"
        );
      }

      // Sort reminders in descending order (largest/earliest first)
      reminderMinutes.sort((a, b) => b - a);

      console.log(
        `Calculated invasion time from countdown ${countdownStr}: ${invasionTime.toUTCString()}`
      );
      console.log(
        `Custom reminders (minutes before): ${reminderMinutes.join(", ")}`
      );

      // Generate a unique invasion ID
      const invasionId =
        "invasion_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

      // Create human-readable description
      const description = `Invasion at ${invasionTime.toUTCString()}`;

      // Schedule the actual invasion alert
      const invasionDelay = invasionTime.getTime() - now.getTime();
      const invasionTimeoutId = setTimeout(() => {
        console.log(
          `Invasion ${invasionId} starting at: ${new Date().toUTCString()}`
        );
        sendInvasionStartNotification(invasionId, invasionTime);

        // After running, remove it from active schedules
        delete activeSchedules[invasionId];
        Object.keys(activeSchedules).forEach((id) => {
          if (id.startsWith(`${invasionId}_reminder_`)) {
            delete activeSchedules[id];
          }
        });

        // Add to history as 'completed'
        addToScheduleHistory(
          invasionId,
          `Invasion at ${invasionTime.toUTCString()}`,
          description,
          note,
          true,
          "completed"
        );
      }, invasionDelay);

      // Add main invasion to active schedules
      activeSchedules[invasionId] = {
        type: "invasion",
        scheduledTime: invasionTime,
        timeoutId: invasionTimeoutId,
        description: description,
        created: new Date().toUTCString(),
        note: note,
        remindersSent: [],
        customReminders: true,
      };

      // Schedule custom reminder notifications
      const remindersScheduled = [];

      reminderMinutes.forEach((minutes) => {
        // Skip if reminder time is greater than the countdown
        if (minutes * 60 * 1000 >= invasionDelay) {
          console.log(
            `Skipping ${minutes} minute reminder - occurs before now`
          );
          return;
        }

        const reminderTime = new Date(
          invasionTime.getTime() - minutes * 60 * 1000
        );
        const label =
          minutes >= 60
            ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
            : `${minutes}m`;

        const reminderId = `${invasionId}_reminder_${minutes}`;
        const reminderDelay = reminderTime.getTime() - now.getTime();

        console.log(
          `Scheduling ${label} reminder for invasion ${invasionId} at ${reminderTime.toUTCString()}`
        );

        const reminderTimeoutId = setTimeout(() => {
          console.log(`Sending ${label} reminder for invasion ${invasionId}`);
          sendInvasionReminderNotification(
            invasionId,
            `${label}`,
            reminderTime,
            invasionTime
          );

          // After running, remove just this reminder from active schedules
          delete activeSchedules[reminderId];

          // Add this reminder to the list of sent reminders for the main invasion
          if (activeSchedules[invasionId]) {
            activeSchedules[invasionId].remindersSent.push(`${label}`);
          }

          // Add to history as 'completed reminder'
          addToScheduleHistory(
            reminderId,
            `Invasion reminder (${label} before)`,
            `Reminder for invasion at ${invasionTime.toUTCString()}`,
            note,
            true,
            "completed reminder"
          );
        }, reminderDelay);

        // Add this reminder to active schedules
        activeSchedules[reminderId] = {
          type: "invasion-reminder",
          parentId: invasionId,
          reminderTime: reminderTime,
          invasionTime: invasionTime,
          timeUntilInvasion: `${label}`,
          timeoutId: reminderTimeoutId,
          description: `${label} reminder for invasion at ${invasionTime.toUTCString()}`,
          created: new Date().toUTCString(),
          note: note,
        };

        remindersScheduled.push(`${label}`);
      });

      // Add to schedule history
      addToScheduleHistory(
        invasionId,
        `Invasion at ${invasionTime.toUTCString()}`,
        description,
        note
      );

      // Calculate and display the human-readable countdown
      const countdownHours = Math.floor(totalSeconds / 3600);
      const countdownMinutes = Math.floor((totalSeconds % 3600) / 60);
      const countdownSeconds = totalSeconds % 60;
      const formattedCountdown = `${countdownHours}h ${countdownMinutes}m ${countdownSeconds}s`;

      // Format the reminders list for the confirmation message
      const remindersText =
        remindersScheduled.length > 0
          ? remindersScheduled.map((r) => `• ${r} before`).join("\n")
          : "None (all reminders would occur in the past)";

      // Prepare confirmation message
      let confirmMessage = `✅ Custom invasion scheduled successfully!\n`;
      confirmMessage += `**Countdown entered:** ${countdownStr}\n`;
      confirmMessage += `**Time remaining:** ${formattedCountdown}\n`;
      confirmMessage += `**Invasion Time:** ${invasionTime.toUTCString()}\n`;
      confirmMessage += `**Reminders:**\n${remindersText}\n`;

      if (note) {
        confirmMessage += `**Note:** ${note}\n`;
      }

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to customcountdown confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to schedule custom countdown:", error);
      message
        .reply(`❌ Failed to schedule custom countdown: ${error.message}`)
        .catch((err) =>
          console.error(
            "Failed to reply to customcountdown error message:",
            err
          )
        );
    }
  }

  // Modified !invasionHelp command with split fields to avoid the 1024 character limit per field
  if (message.content === "!invasionHelp") {
    console.log("Command !invasionHelp detected");

    const helpEmbed = new EmbedBuilder()
      .setTitle("⚔️ Invasion Commands Help")
      .setColor("#FF0000")
      .setDescription("Commands for scheduling invasion alerts and reminders")
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

    message.reply({ embeds: [helpEmbed] }).catch((err) => {
      console.error("Failed to reply to invasionHelp message:", err);
      // If there's still an error, try sending a simpler version
      const simpleHelpEmbed = new EmbedBuilder()
        .setTitle("⚔️ Invasion Commands Help")
        .setColor("#FF0000")
        .setDescription("Commands for scheduling invasion alerts and reminders")
        .addFields(
          {
            name: "📝 Available Commands",
            value: [
              "• `!invasion [date] [time] [note]` - Schedule one-time attack",
              "• `!recurringInvasion [days] [time] [note]` - Schedule recurring invasions",
              "• `!countdown HH:MM:SS [note]` - Schedule from in-game timer",
              "• `!customcountdown HH:MM:SS R1:R2:R3 [note]` - Custom reminder times",
              "• `!testNotif` - Send test notification (Admin only)",
            ].join("\n"),
          },
          {
            name: "🔄 Recurring Invasion Options",
            value: [
              "**Day Options:** `daily`, `weekend`, `weekday`, `mon,wed,fri`, `every2days`",
              "**Time Format:** 24-hour (20:00 for 8:00 PM)",
              "",
              "**Examples:**",
              '• `!recurringInvasion daily 20:00 "Daily raid"`',
              '• `!recurringInvasion weekend 12:00 "Weekend raids"`',
            ].join("\n"),
          }
        )
        .setFooter({
          text: "For more details, please check the bot documentation",
        });

      message
        .reply({ embeds: [simpleHelpEmbed] })
        .catch((e) => console.error("Failed to send simple help embed:", e));
    });
  }

  // Command: !invasion [date] [time] [note]
  // Example: !invasion tomorrow 20:00 "Evening attack"
  if (
    message.content.startsWith("!invasion") &&
    !message.content.startsWith("!invasionHelp")
  ) {
    console.log("Command !invasion detected");

    if (!checkAdmin()) return;

    const args = message.content.trim().split(" ");

    if (args.length < 3) {
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

      message
        .reply({ embeds: [helpEmbed] })
        .catch((err) =>
          console.error("Failed to reply to invasion help message:", err)
        );
      return;
    }

    // Parse date and time using the same logic as !scheduleOnce
    let scheduledTime = new Date();
    let dateInput = args[1].toLowerCase();
    let timeInput = args[2];
    let noteStartIndex = 3;

    // Handle special date formats
    if (dateInput === "today") {
      // Use today's date, already set in scheduledTime
      scheduledTime.setUTCHours(0, 0, 0, 0);
    } else if (dateInput === "tomorrow") {
      // Use tomorrow's date
      scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
      scheduledTime.setUTCHours(0, 0, 0, 0);
    } else if (
      dateInput.startsWith("+") &&
      (dateInput.endsWith("hours") || dateInput.endsWith("hour"))
    ) {
      // Handle +Nhours format
      const hours = parseInt(
        dateInput.replace("+", "").replace("hours", "").replace("hour", "")
      );
      if (isNaN(hours)) {
        message
          .reply("❌ Invalid hour format. Use +Nhours (e.g., +2hours).")
          .catch((err) =>
            console.error(
              "Failed to reply to invalid hour format error message:",
              err
            )
          );
        return;
      }
      scheduledTime = new Date(Date.now() + hours * 60 * 60 * 1000);
      // Skip time input for this format
      timeInput = null;
      noteStartIndex = 2;
    } else if (
      dateInput.startsWith("+") &&
      (dateInput.endsWith("minutes") || dateInput.endsWith("minute"))
    ) {
      // Handle +Nminutes format
      const minutes = parseInt(
        dateInput.replace("+", "").replace("minutes", "").replace("minute", "")
      );
      if (isNaN(minutes)) {
        message
          .reply("❌ Invalid minute format. Use +Nminutes (e.g., +30minutes).")
          .catch((err) =>
            console.error(
              "Failed to reply to invalid minute format error message:",
              err
            )
          );
        return;
      }
      scheduledTime = new Date(Date.now() + minutes * 60 * 1000);
      // Skip time input for this format
      timeInput = null;
      noteStartIndex = 2;
    } else {
      // Handle YYYY-MM-DD format
      try {
        const dateParts = dateInput.split("-");
        if (dateParts.length !== 3) {
          throw new Error("Invalid date format");
        }

        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Months are 0-indexed
        const day = parseInt(dateParts[2]);

        scheduledTime = new Date(Date.UTC(year, month, day, 0, 0, 0));

        if (isNaN(scheduledTime.getTime())) {
          throw new Error("Invalid date");
        }
      } catch (error) {
        message
          .reply("❌ Invalid date format. Use YYYY-MM-DD (e.g., 2023-12-31).")
          .catch((err) =>
            console.error(
              "Failed to reply to invalid date format error message:",
              err
            )
          );
        return;
      }
    }

    // Set time if timeInput is provided
    if (timeInput) {
      const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);

      if (!timeMatch) {
        message
          .reply("❌ Invalid time format. Use hour:minute (e.g., 20:00).")
          .catch((err) =>
            console.error("Failed to reply to time format error message:", err)
          );
        return;
      }

      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        message
          .reply(
            "❌ Invalid time. Hours must be 0-23 and minutes must be 0-59."
          )
          .catch((err) =>
            console.error("Failed to reply to invalid time message:", err)
          );
        return;
      }

      scheduledTime.setUTCHours(hour, minute, 0, 0);
    }

    // Get note if provided
    let note = "";

    // Check if there's a quoted note
    const noteRegex = new RegExp(
      `!invasion\\s+\\S+\\s+${timeInput ? "\\S+\\s+" : ""}"([^"]+)"`,
      "i"
    );
    const noteMatch = message.content.match(noteRegex);

    if (noteMatch) {
      note = noteMatch[1];
    } else if (args.length > noteStartIndex) {
      note = args.slice(noteStartIndex).join(" ");
    }

    try {
      // Create invasion schedule with reminders
      const invasionInfo = addInvasionSchedule(
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

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to invasion confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to schedule invasion:", error);
      message
        .reply(`❌ Failed to schedule invasion: ${error.message}`)
        .catch((err) =>
          console.error("Failed to reply to invasion error message:", err)
        );
    }
  }

  // Update to the !schedules command to properly show recurring invasion schedules

  // Find this section in the existing code - it's the if/else block that handles different schedule types
  // in the !schedules or !countdownSchedules command

  if (
    message.content === "!countdownSchedules" ||
    message.content === "!schedule" ||
    message.content === "!schedules"
  ) {
    console.log(`Command ${message.content} detected`);

    const scheduleIds = Object.keys(activeSchedules);

    if (scheduleIds.length === 0) {
      message
        .reply(
          "No active schedules configured. Use !scheduleEasy, !scheduleOnce, or !reminder to create one."
        )
        .catch((err) =>
          console.error("Failed to reply to schedules empty message:", err)
        );
      return;
    }

    // Create embed for countdown listing
    const embed = new EmbedBuilder()
      .setTitle("📅 Upcoming Events & Notifications")
      .setColor("#FF9900")
      .setTimestamp()
      .setFooter({ text: "Notification Bot" });

    const now = new Date();

    // Filter schedules by type - THIS IS THE PART THAT NEEDS FIXING
    const oneTimeSchedules = scheduleIds.filter(
      (id) => activeSchedules[id].type === "one-time"
    );
    const oneTimeReminders = scheduleIds.filter(
      (id) => activeSchedules[id].type === "one-time-reminder"
    );
    // ADD THIS LINE to include recurring-invasion type
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
      // [existing invasion schedules code]
    }

    // ADD THIS SECTION - Process recurring invasion schedules
    if (recurringInvasions.length > 0) {
      // Add a field for recurring invasions
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
                  const [start, end] = d.split("-");
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
      // [existing one-time reminders code]
    }

    // Process recurring schedules
    if (recurringSchedules.length > 0) {
      // [existing recurring schedules code]
    }

    // Add current time information
    const utcTime = now.toUTCString();
    embed.addFields({ name: "🕒 Current Time (UTC)", value: utcTime });

    // Send embed to user
    message
      .reply({ embeds: [embed] })
      .catch((err) =>
        console.error("Failed to reply to schedules message:", err)
      );
  }

  // Command: !testNotif
  // Command: !testNotif
  if (message.content === "!testNotif") {
    console.log("Command !testNotif detected");

    if (!checkAdmin()) return;

    // Confirm to the user that we're sending a test notification
    message
      .reply("Sending a test notification...")
      .catch((err) =>
        console.error("Failed to reply to testNotif message:", err)
      );

    // Get the channel
    const channel = client.channels.cache.get(targetChannelId);

    if (!channel) {
      console.error("Channel not found!");
      message.reply(
        "❌ Error: Target channel not found. Use !setChannel to configure a valid channel."
      );
      return;
    }

    // Create an attractive welcome/test message embed
    const embed = new EmbedBuilder()
      .setTitle("👋 Hello Everyone!")
      .setDescription(
        "I'm your Invasion Notification Bot, ready to keep your team informed!"
      )
      .setColor("#8A2BE2") // Vibrant purple color
      .addFields(
        {
          name: "📢 What I Can Do For You",
          value:
            "I'll send alerts for upcoming invasions, battles, and important events so everyone stays coordinated.",
        },
        {
          name: "🕒 Current Server Time",
          value: new Date().toUTCString(),
        },
        {
          name: "🛡️ Stay Prepared",
          value:
            "When the real alerts come, they'll be much more noticeable than this test message.",
        }
      )
      .setTimestamp()
      .setFooter({
        text: "This is just a test notification • Your friendly bot assistant",
      });

    // Send embed to channel - no @everyone for test messages, just a friendly ping
    channel
      .send({ embeds: [embed] })
      .then(() => {
        console.log("Test notification sent!");
        message.reply("✅ Test notification sent successfully!");
      })
      .catch((error) => {
        console.error("Failed to send test notification:", error);
        message.reply(`❌ Failed to send test notification: ${error.message}`);
      });
  }

  // Command: !status
  if (message.content === "!status") {
    console.log("Command !status detected");

    const currentTime = new Date();
    const utcTime = currentTime.toUTCString();
    const activeScheduleCount = Object.keys(activeSchedules).length;

    // Count different types of schedules
    const invasionCount = Object.values(activeSchedules).filter(
      (s) => s.type === "invasion" || s.type === undefined
    ).length;
    const reminderCount = Object.values(activeSchedules).filter(
      (s) => s.type === "one-time-reminder"
    ).length;
    const invasionReminderCount = Object.values(activeSchedules).filter(
      (s) => s.type === "invasion-reminder"
    ).length;

    // Get target channel info
    const targetChannel = client.channels.cache.get(targetChannelId);
    const channelInfo = targetChannel
      ? `#${targetChannel.name}`
      : "Channel not found";

    // Create an attractive embed
    const statusEmbed = new EmbedBuilder()
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

    message
      .reply({ embeds: [statusEmbed] })
      .catch((err) => console.error("Failed to reply to status message:", err));
  }

  // Command: !addSchedule [pattern] [note]
  // Example: !addSchedule "0 20 * * 1,3,5" "Weekday evenings"
  if (message.content.startsWith("!addSchedule")) {
    console.log("Command !addSchedule detected");

    if (!checkAdmin()) return;

    // Extract the pattern - needs to handle quoted strings with spaces
    const fullCommand = message.content.trim();
    let pattern = "";
    let note = "";

    // Check if the pattern is in quotes
    const patternMatch = fullCommand.match(/!addSchedule\s+"([^"]+)"\s*(.*)/);

    if (patternMatch) {
      // Pattern was in quotes
      pattern = patternMatch[1];
      note = patternMatch[2] || "";
    } else {
      // No quotes, just space separated
      const args = fullCommand.split(" ");

      if (args.length < 2) {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📅 Schedule Creation Help")
          .setColor("#00AAFF")
          .setDescription("Add a new notification schedule using cron patterns")
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
              value: "For easier scheduling, try using !scheduleEasy command",
            }
          )
          .setTimestamp()
          .setFooter({ text: "Invasion Notification Bot" });

        message
          .reply({ embeds: [helpEmbed] })
          .catch((err) =>
            console.error("Failed to reply to addSchedule help message:", err)
          );
        return;
      }

      pattern = args[1];
      note = args.slice(2).join(" ");
    }

    try {
      // Validate pattern
      cron.validate(pattern);

      // Add schedule
      const scheduleInfo = addSchedule(pattern, note);

      // Prepare confirmation message
      let confirmMessage = `✅ Schedule added successfully!\n`;
      confirmMessage += `**ID:** ${scheduleInfo.id}\n`;
      confirmMessage += `**Pattern:** \`${scheduleInfo.pattern}\`\n`;
      confirmMessage += `**Description:** ${scheduleInfo.description}\n`;

      if (note) {
        confirmMessage += `**Note:** ${note}\n`;
      }

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to addSchedule confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to add schedule:", error);
      message
        .reply(`❌ Failed to add schedule: ${error.message}`)
        .catch((err) =>
          console.error("Failed to reply to addSchedule error message:", err)
        );
    }
  }

  // Command: !scheduleEasy [days] [hour:minute] [note]
  // Example: !scheduleEasy mon,wed,fri 20:00 "Weekday evenings"
  if (message.content.startsWith("!scheduleEasy")) {
    console.log("Command !scheduleEasy detected");

    if (!checkAdmin()) return;

    const args = message.content.trim().split(" ");

    if (args.length < 3) {
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
            value: "`hour:minute` in 24-hour format (e.g., 20:00 for 8:00 PM)",
          }
        )
        .setTimestamp()
        .setFooter({ text: "Invasion Notification Bot" });

      message
        .reply({ embeds: [helpEmbed] })
        .catch((err) =>
          console.error("Failed to reply to scheduleEasy help message:", err)
        );
      return;
    }

    // Parse days
    const dayInput = args[1].toLowerCase();
    let dayPattern = "";

    // Check for special keywords
    if (dayInput === "daily") {
      dayPattern = "*";
    } else if (dayInput === "weekend") {
      dayPattern = "0,6";
    } else if (dayInput === "weekday") {
      dayPattern = "1-5";
    } else if (dayInput.startsWith("every")) {
      // Handle 'every2days', 'every3days', etc.
      const dayInterval = dayInput.replace("every", "").replace("days", "");
      if (!isNaN(dayInterval) && parseInt(dayInterval) > 0) {
        dayPattern = `*/${dayInterval}`;
      } else {
        message
          .reply(
            '❌ Invalid day interval format. Use "every2days", "every3days", etc.'
          )
          .catch((err) =>
            console.error("Failed to reply to day interval error message:", err)
          );
        return;
      }
    } else {
      // Handle comma-separated days like "mon,wed,fri"
      const dayMap = {
        sun: 0,
        sunday: 0,
        mon: 1,
        monday: 1,
        tue: 2,
        tuesday: 2,
        wed: 3,
        wednesday: 3,
        thu: 4,
        thursday: 4,
        fri: 5,
        friday: 5,
        sat: 6,
        saturday: 6,
      };

      const daysList = dayInput.split(",");
      const daysNumbers = [];

      for (const day of daysList) {
        if (dayMap[day] !== undefined) {
          daysNumbers.push(dayMap[day]);
        } else {
          message
            .reply(
              `❌ Invalid day: "${day}". Use sun, mon, tue, wed, thu, fri, sat, or their full names.`
            )
            .catch((err) =>
              console.error("Failed to reply to invalid day message:", err)
            );
          return;
        }
      }

      if (daysNumbers.length > 0) {
        dayPattern = daysNumbers.join(",");
      } else {
        message
          .reply("❌ No valid days provided.")
          .catch((err) =>
            console.error("Failed to reply to no days message:", err)
          );
        return;
      }
    }

    // Parse time
    const timeInput = args[2];
    const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);

    if (!timeMatch) {
      message
        .reply(
          "❌ Invalid time format. Use hour:minute (e.g., 20:00 for 8:00 PM)."
        )
        .catch((err) =>
          console.error("Failed to reply to time format error message:", err)
        );
      return;
    }

    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      message
        .reply("❌ Invalid time. Hours must be 0-23 and minutes must be 0-59.")
        .catch((err) =>
          console.error("Failed to reply to invalid time message:", err)
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
    } else if (args.length > 3) {
      note = args.slice(3).join(" ");
    }

    // Create cron pattern: minute hour dayOfMonth month dayOfWeek
    let cronPattern;

    if (dayPattern.includes("/")) {
      // If using */n format, it belongs in the day-of-month field
      cronPattern = `${minute} ${hour} ${dayPattern} * *`;
    } else {
      // Otherwise it's a day-of-week pattern
      cronPattern = `${minute} ${hour} * * ${dayPattern}`;
    }

    try {
      // Validate pattern
      cron.validate(cronPattern);

      // Add schedule
      const scheduleInfo = addSchedule(cronPattern, note);

      // Prepare confirmation message
      let confirmMessage = `✅ Schedule added successfully!\n`;
      confirmMessage += `**ID:** ${scheduleInfo.id}\n`;
      confirmMessage += `**Pattern:** \`${scheduleInfo.pattern}\`\n`;
      confirmMessage += `**Description:** ${scheduleInfo.description}\n`;

      if (note) {
        confirmMessage += `**Note:** ${note}\n`;
      }

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to scheduleEasy confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to add schedule:", error);
      message
        .reply(`❌ Failed to add schedule: ${error.message}`)
        .catch((err) =>
          console.error("Failed to reply to scheduleEasy error message:", err)
        );
    }
  }

  // Command: !removeSchedule [id]
  if (message.content.startsWith("!removeSchedule")) {
    console.log("Command !removeSchedule detected");

    if (!checkAdmin()) return;

    const args = message.content.split(" ");

    if (args.length < 2) {
      message
        .reply(
          "Format: !removeSchedule [scheduleId]\nUse !listSchedules to see available schedule IDs"
        )
        .catch((err) =>
          console.error("Failed to reply to removeSchedule help message:", err)
        );
      return;
    }

    const scheduleId = args[1];

    try {
      // Remove schedule
      const removedSchedule = removeSchedule(scheduleId);

      // Prepare confirmation message
      let confirmMessage = `✅ Schedule removed successfully!\n`;
      confirmMessage += `**ID:** ${removedSchedule.id}\n`;
      confirmMessage += `**Pattern:** \`${removedSchedule.pattern}\`\n`;
      confirmMessage += `**Description:** ${removedSchedule.description}\n`;

      if (removedSchedule.note) {
        confirmMessage += `**Note:** ${removedSchedule.note}\n`;
      }

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to removeSchedule confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to remove schedule:", error);
      message
        .reply(`❌ Failed to remove schedule: ${error.message}`)
        .catch((err) =>
          console.error("Failed to reply to removeSchedule error message:", err)
        );
    }
  }

  // Command: !listSchedules
  if (message.content === "!listSchedules") {
    console.log("Command !listSchedules detected");

    const scheduleIds = Object.keys(activeSchedules);

    if (scheduleIds.length === 0) {
      message
        .reply(
          "No active schedules configured. Use !addSchedule to create one."
        )
        .catch((err) =>
          console.error("Failed to reply to listSchedules empty message:", err)
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
    scheduleIds.forEach((scheduleId, index) => {
      const schedule = activeSchedules[scheduleId];
      let fieldValue = `**Pattern:** \`${schedule.pattern}\`\n`;
      fieldValue += `**Description:** ${schedule.description}\n`;
      fieldValue += `**Created:** ${schedule.created}\n`;

      if (schedule.note) {
        fieldValue += `**Note:** ${schedule.note}\n`;
      }

      embed.addFields({ name: `ID: ${scheduleId}`, value: fieldValue });
    });

    // Add target channel information
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
    message
      .reply({ embeds: [embed] })
      .catch((err) =>
        console.error("Failed to reply to listSchedules message:", err)
      );
  }

  // Command: !reminder [date] [time] [title] [message] [note]
  // Example: !reminder tomorrow 15:00 "Team Meeting" "Don't forget our weekly team meeting" "Important"
  if (message.content.startsWith("!reminder")) {
    console.log("Command !reminder detected");

    if (!checkAdmin()) return;

    const args = message.content.trim().split(" ");

    if (args.length < 4) {
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

      message
        .reply({ embeds: [helpEmbed] })
        .catch((err) =>
          console.error("Failed to reply to reminder help message:", err)
        );
      return;
    }

    // Parse date and time
    let scheduledTime = new Date();
    let dateInput = args[1].toLowerCase();
    let timeInput = args[2];
    let argIndex = 3; // Starting index for title

    // Handle special date formats
    if (dateInput === "today") {
      // Use today's date, already set in scheduledTime
      scheduledTime.setUTCHours(0, 0, 0, 0);
    } else if (dateInput === "tomorrow") {
      // Use tomorrow's date
      scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
      scheduledTime.setUTCHours(0, 0, 0, 0);
    } else if (
      dateInput.startsWith("+") &&
      (dateInput.endsWith("hours") || dateInput.endsWith("hour"))
    ) {
      // Handle +Nhours format
      const hours = parseInt(
        dateInput.replace("+", "").replace("hours", "").replace("hour", "")
      );
      if (isNaN(hours)) {
        message
          .reply("❌ Invalid hour format. Use +Nhours (e.g., +2hours).")
          .catch((err) =>
            console.error(
              "Failed to reply to invalid hour format error message:",
              err
            )
          );
        return;
      }
      scheduledTime = new Date(Date.now() + hours * 60 * 60 * 1000);
      // Skip time input for this format
      timeInput = null;
      argIndex = 2; // Title starts earlier when no time
    } else if (
      dateInput.startsWith("+") &&
      (dateInput.endsWith("minutes") || dateInput.endsWith("minute"))
    ) {
      // Handle +Nminutes format
      const minutes = parseInt(
        dateInput.replace("+", "").replace("minutes", "").replace("minute", "")
      );
      if (isNaN(minutes)) {
        message
          .reply("❌ Invalid minute format. Use +Nminutes (e.g., +30minutes).")
          .catch((err) =>
            console.error(
              "Failed to reply to invalid minute format error message:",
              err
            )
          );
        return;
      }
      scheduledTime = new Date(Date.now() + minutes * 60 * 1000);
      // Skip time input for this format
      timeInput = null;
      argIndex = 2; // Title starts earlier when no time
    } else {
      // Handle YYYY-MM-DD format
      try {
        const dateParts = dateInput.split("-");
        if (dateParts.length !== 3) {
          throw new Error("Invalid date format");
        }

        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Months are 0-indexed
        const day = parseInt(dateParts[2]);

        scheduledTime = new Date(Date.UTC(year, month, day, 0, 0, 0));

        if (isNaN(scheduledTime.getTime())) {
          throw new Error("Invalid date");
        }
      } catch (error) {
        message
          .reply("❌ Invalid date format. Use YYYY-MM-DD (e.g., 2023-12-31).")
          .catch((err) =>
            console.error(
              "Failed to reply to invalid date format error message:",
              err
            )
          );
        return;
      }
    }

    // Set time if timeInput is provided
    if (timeInput) {
      const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);

      if (!timeMatch) {
        message
          .reply("❌ Invalid time format. Use hour:minute (e.g., 15:00).")
          .catch((err) =>
            console.error("Failed to reply to time format error message:", err)
          );
        return;
      }

      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        message
          .reply(
            "❌ Invalid time. Hours must be 0-23 and minutes must be 0-59."
          )
          .catch((err) =>
            console.error("Failed to reply to invalid time message:", err)
          );
        return;
      }

      scheduledTime.setUTCHours(hour, minute, 0, 0);
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
      const reminderInfo = addOneTimeReminder(
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

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to reminder confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to add reminder:", error);
      message
        .reply(`❌ Failed to add reminder: ${error.message}`)
        .catch((err) =>
          console.error("Failed to reply to reminder error message:", err)
        );
    }
  }

  // Update countdownSchedules to include reminders
  if (message.content === "!countdownSchedules") {
    console.log("Command !countdownSchedules detected");

    const scheduleIds = Object.keys(activeSchedules);

    if (scheduleIds.length === 0) {
      message
        .reply(
          "No active schedules configured. Use !scheduleEasy, !scheduleOnce, or !reminder to create one."
        )
        .catch((err) =>
          console.error(
            "Failed to reply to countdownSchedules empty message:",
            err
          )
        );
      return;
    }

    // Create embed for countdown listing
    const embed = new EmbedBuilder()
      .setTitle("⏱️ Time Until Next Notifications")
      .setColor("#FF9900")
      .setTimestamp()
      .setFooter({ text: "Notification Bot" });

    const now = new Date();

    // Filter schedules by type
    const oneTimeSchedules = scheduleIds.filter(
      (id) => activeSchedules[id].type === "one-time"
    );
    const oneTimeReminders = scheduleIds.filter(
      (id) => activeSchedules[id].type === "one-time-reminder"
    );
    const recurringSchedules = scheduleIds.filter(
      (id) => activeSchedules[id].type === "recurring"
    );

    // Process one-time invasion schedules
    if (oneTimeSchedules.length > 0) {
      // [existing code for one-time schedules]
    }

    // Process one-time reminders
    if (oneTimeReminders.length > 0) {
      // Sort one-time reminders by time
      const sortedOneTimeReminders = oneTimeReminders.sort((a, b) => {
        return (
          activeSchedules[a].scheduledTime.getTime() -
          activeSchedules[b].scheduledTime.getTime()
        );
      });

      // Add a field for one-time reminders
      embed.addFields({ name: "📝 One-Time Reminders", value: "\u200B" });

      sortedOneTimeReminders.forEach((scheduleId) => {
        const schedule = activeSchedules[scheduleId];
        const timeUntil = schedule.scheduledTime.getTime() - now.getTime();

        if (timeUntil <= 0) {
          // This should not happen but handle it
          embed.addFields({
            name: `ID: ${scheduleId}`,
            value: `**Status:** Overdue\n**Scheduled Time:** ${schedule.scheduledTime.toUTCString()}`,
          });
          return;
        }

        // Calculate human-readable time difference
        const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (timeUntil % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

        let countdownText = "";
        if (days > 0) countdownText += `${days} days, `;
        if (hours > 0 || days > 0) countdownText += `${hours} hours, `;
        if (minutes > 0 || hours > 0 || days > 0)
          countdownText += `${minutes} minutes, `;
        countdownText += `${seconds} seconds`;

        let fieldValue = `**Time Until:** ${countdownText}\n`;
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
      // [existing code for recurring schedules]
    }

    // Add current time information
    const utcTime = now.toUTCString();
    embed.addFields({ name: "🕒 Current Time (UTC)", value: utcTime });

    // Send embed to user
    message
      .reply({ embeds: [embed] })
      .catch((err) =>
        console.error("Failed to reply to countdownSchedules message:", err)
      );
  }

  // Command: !scheduleHistory
  if (message.content === "!scheduleHistory") {
    console.log("Command !scheduleHistory detected");

    if (scheduleHistory.length === 0) {
      message
        .reply("No schedule history available.")
        .catch((err) =>
          console.error(
            "Failed to reply to scheduleHistory empty message:",
            err
          )
        );
      return;
    }

    // Create embed for schedule history
    const embed = new EmbedBuilder()
      .setTitle("📜 Schedule History")
      .setColor("#9933FF")
      .setTimestamp()
      .setFooter({ text: "Invasion Notification Bot" });

    // Get the most recent entries (up to 10)
    const recentHistory = scheduleHistory.slice(-10).reverse();

    // Add each history entry to the embed
    recentHistory.forEach((entry, index) => {
      const actionEmoji = entry.action === "created" ? "➕" : "➖";
      const actionColor = entry.action === "created" ? "Created" : "Removed";

      let fieldValue = `**Pattern:** \`${entry.pattern}\`\n`;
      fieldValue += `**Description:** ${entry.description}\n`;
      fieldValue += `**${actionColor} At:** ${entry.timestamp}\n`;

      if (entry.note) {
        fieldValue += `**Note:** ${entry.note}\n`;
      }

      embed.addFields({
        name: `${actionEmoji} ${actionColor}: ${entry.id}`,
        value: fieldValue,
      });
    });

    // Send embed to user
    message
      .reply({ embeds: [embed] })
      .catch((err) =>
        console.error("Failed to reply to scheduleHistory message:", err)
      );
  }

  // Command !timeNow
  if (message.content === "!timeNow") {
    console.log("Command !timeNow detected");

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

    message
      .reply(
        `🕒 **Time Information**\n**UTC Time:** ${utcTime}\n**Day:** ${dayNames[day]} (${day})\n**Server Local Time:** ${localTime}`
      )
      .catch((err) =>
        console.error("Failed to reply to timeNow message:", err)
      );
  }

  // Also update the main help command to better highlight the recurring invasion feature
  if (message.content === "!help") {
    console.log("Command !help detected");

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
      .setFooter({ text: "Use specialized help commands for more details" });

    message
      .reply({ embeds: [helpEmbed] })
      .catch((err) => console.error("Failed to reply to help message:", err));
  }

  // Command !reminderHelp to show detailed reminder help
  if (message.content === "!reminderHelp") {
    console.log("Command !reminderHelp detected");

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
      .setFooter({ text: "General reminders use @here instead of @everyone" });

    message
      .reply({ embeds: [helpEmbed] })
      .catch((err) =>
        console.error("Failed to reply to reminderHelp message:", err)
      );
  }
  // Command: !recurringInvasion [days] [time] [note]
  // Example: !recurringInvasion every2days 20:00 "Bi-daily invasion"
  // Example: !recurringInvasion mon,wed,fri 18:30 "MWF alliance wars"
  if (message.content.startsWith("!recurringInvasion")) {
    console.log("Command !recurringInvasion detected");

    if (!checkAdmin()) return;

    const args = message.content.trim().split(" ");

    if (args.length < 3) {
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
            value: "`hour:minute` in 24-hour format (e.g., 20:00 for 8:00 PM)",
          }
        )
        .setTimestamp()
        .setFooter({ text: "All times are in UTC" });

      message
        .reply({ embeds: [helpEmbed] })
        .catch((err) =>
          console.error(
            "Failed to reply to recurringInvasion help message:",
            err
          )
        );
      return;
    }

    // Parse days
    const dayInput = args[1].toLowerCase();
    let dayPattern = "";

    // Check for special keywords
    if (dayInput === "daily") {
      dayPattern = "*";
    } else if (dayInput === "weekend") {
      dayPattern = "0,6";
    } else if (dayInput === "weekday") {
      dayPattern = "1-5";
    } else if (dayInput.startsWith("every")) {
      // Handle 'every2days', 'every3days', etc.
      const dayInterval = dayInput.replace("every", "").replace("days", "");
      if (!isNaN(dayInterval) && parseInt(dayInterval) > 0) {
        dayPattern = `*/${dayInterval}`;
      } else {
        message
          .reply(
            '❌ Invalid day interval format. Use "every2days", "every3days", etc.'
          )
          .catch((err) =>
            console.error("Failed to reply to day interval error message:", err)
          );
        return;
      }
    } else {
      // Handle comma-separated days like "mon,wed,fri"
      const dayMap = {
        sun: 0,
        sunday: 0,
        mon: 1,
        monday: 1,
        tue: 2,
        tuesday: 2,
        wed: 3,
        wednesday: 3,
        thu: 4,
        thursday: 4,
        fri: 5,
        friday: 5,
        sat: 6,
        saturday: 6,
      };

      const daysList = dayInput.split(",");
      const daysNumbers = [];

      for (const day of daysList) {
        if (dayMap[day] !== undefined) {
          daysNumbers.push(dayMap[day]);
        } else {
          message
            .reply(
              `❌ Invalid day: "${day}". Use sun, mon, tue, wed, thu, fri, sat, or their full names.`
            )
            .catch((err) =>
              console.error("Failed to reply to invalid day message:", err)
            );
          return;
        }
      }

      if (daysNumbers.length > 0) {
        dayPattern = daysNumbers.join(",");
      } else {
        message
          .reply("❌ No valid days provided.")
          .catch((err) =>
            console.error("Failed to reply to no days message:", err)
          );
        return;
      }
    }

    // Parse time
    const timeInput = args[2];
    const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);

    if (!timeMatch) {
      message
        .reply(
          "❌ Invalid time format. Use hour:minute (e.g., 20:00 for 8:00 PM)."
        )
        .catch((err) =>
          console.error("Failed to reply to time format error message:", err)
        );
      return;
    }

    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      message
        .reply("❌ Invalid time. Hours must be 0-23 and minutes must be 0-59.")
        .catch((err) =>
          console.error("Failed to reply to invalid time message:", err)
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
    } else if (args.length > 3) {
      note = args.slice(3).join(" ");
    }

    // Create cron pattern: minute hour dayOfMonth month dayOfWeek
    let cronPattern;

    if (dayPattern.includes("/")) {
      // If using */n format, it belongs in the day-of-month field
      cronPattern = `${minute} ${hour} ${dayPattern} * *`;
    } else {
      // Otherwise it's a day-of-week pattern
      cronPattern = `${minute} ${hour} * * ${dayPattern}`;
    }

    try {
      // Validate pattern
      cron.validate(cronPattern);

      // Generate unique ID for this schedule
      const scheduleId = "recurring_invasion_" + generateScheduleId();

      // Create the cron job
      const job = cron.schedule(
        cronPattern,
        () => {
          console.log(
            `Recurring invasion ${scheduleId} triggered at: ${new Date().toUTCString()}`
          );
          // Send the invasion notification
          sendInvasionNotification(scheduleId);
        },
        {
          timezone: "UTC", // Important to set timezone to UTC
        }
      );

      // Create human-readable description
      const description =
        "Recurring invasion: " + translateCronToHumanReadable(cronPattern);

      // Add to active schedules
      activeSchedules[scheduleId] = {
        type: "recurring-invasion",
        pattern: cronPattern,
        job: job,
        description: description,
        created: new Date().toUTCString(),
        note: note,
      };

      console.log(
        `New recurring invasion schedule created with ID ${scheduleId}: ${cronPattern} (UTC)`
      );

      // Add to schedule history
      addToScheduleHistory(scheduleId, cronPattern, description, note);

      // Prepare confirmation message
      let confirmMessage = `✅ Recurring invasion schedule created successfully!\n`;
      confirmMessage += `**ID:** ${scheduleId}\n`;
      confirmMessage += `**Pattern:** \`${cronPattern}\`\n`;
      confirmMessage += `**Description:** ${description}\n`;

      if (note) {
        confirmMessage += `**Note:** ${note}\n`;
      }

      message
        .reply(confirmMessage)
        .catch((err) =>
          console.error(
            "Failed to reply to recurringInvasion confirmation message:",
            err
          )
        );
    } catch (error) {
      console.error("Failed to create recurring invasion schedule:", error);
      message
        .reply(
          `❌ Failed to create recurring invasion schedule: ${error.message}`
        )
        .catch((err) =>
          console.error(
            "Failed to reply to recurringInvasion error message:",
            err
          )
        );
    }
  }
  // Command !scheduleHelp to show detailed scheduling help
  if (message.content === "!scheduleHelp") {
    console.log("Command !scheduleHelp detected");

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

    message
      .reply({ embeds: [helpEmbed] })
      .catch((err) =>
        console.error("Failed to reply to scheduleHelp message:", err)
      );
  }
});

// Add more robust error handling and reconnection logic
client.on("error", (error) => {
  console.error("Discord client error:", error);
  console.log("Attempting to reconnect in 5 seconds...");
});

client.on("disconnect", (event) => {
  console.log(`Bot disconnected with code ${event.code}`);
  console.log("Attempting to reconnect in 5 seconds...");
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Login to Discord with bot token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error(
    "Bot token not found! Make sure .env file contains DISCORD_TOKEN=your_bot_token"
  );
  process.exit(1);
}

console.log("Attempting to login with token...");
client.login(token).catch((error) => {
  console.error("Login failed:", error);
  process.exit(1);
});

/* 
# INVASION NOTIFICATION BOT - DOCUMENTATION

## SETUP INSTRUCTIONS:
1. Create a .env file with:
   ```
   DISCORD_TOKEN=your_bot_token
   TARGET_CHANNEL_ID=your_default_channel_id (optional)
   SCHEDULE_PATTERN=0 20 *\/2 * * (optional, cron format for default schedule)
   ```

2. Install dependencies:
   ```
   npm install discord.js@14 node-cron dotenv
   ```

3. Run the bot:
   ```
   node bot.js
   ```

## COMMAND CATEGORIES:

### 🔧 SETUP COMMANDS:
- `!setChannel` - Set current channel for notifications (Admin only)
- `!status` - Check bot status, target channel and active schedules
- `!timeNow` - Display current UTC and server time

### ⚔️ INVASION COMMANDS:
- `!invasion [date] [time] [note]` - Schedule attack with auto-reminders
  Examples:
  • `!invasion tomorrow 18:00 "Guild war"`
  • `!invasion 2023-12-25 20:00 "Holiday raid"`
  • `!invasion +2hours "Quick attack"`

- `!countdown HH:MM:SS [note]` - Schedule from in-game timer
  Example: `!countdown 19:38:49 "Boss invasion"`

- `!customcountdown HH:MM:SS R1:R2:R3 [note]` - Custom reminder times
  Example: `!customcountdown 19:38:49 60:30:15:5 "Custom reminders"`

- `!testNotif` - Send test invasion notification (Admin only)

### 📝 REGULAR REMINDER COMMANDS:
- `!reminder [date] [time] [title] [message] [note]` - Schedule general reminder
  Examples:
  • `!reminder tomorrow 15:00 "Team Meeting" "Don't forget our meeting"`
  • `!reminder +30minutes "Resource check" "Time to collect resources!"`

### 📅 RECURRING SCHEDULE COMMANDS:
- `!scheduleEasy [days] [hour:minute] [note]` - Simple recurring schedule
  Examples:
  • `!scheduleEasy daily 20:00 "Daily evening notification"`
  • `!scheduleEasy weekend 12:00 "Weekend event"`
  • `!scheduleEasy mon,wed,fri 19:00 "Tri-weekly event"`
  • `!scheduleEasy every2days 8:00 "Every other day"`

- `!addSchedule "pattern" [note]` - Advanced cron pattern scheduling
  Example: `!addSchedule "0 20 * * 1,3,5" "Weekday evenings"`

### 📊 MANAGEMENT COMMANDS:
- `!schedules` or `!countdownSchedules` - View all upcoming notifications
- `!removeSchedule [id]` - Delete a schedule by ID
- `!scheduleHistory` - View schedule creation/removal history
- `!help` - Display list of commands
- `!scheduleHelp` - Detailed scheduling guide

## SCHEDULING OPTIONS:

### Day Options:
- `daily` - Every day
- `weekend` - Saturday and Sunday
- `weekday` - Monday through Friday
- Day abbreviations: `sun`, `mon`, `tue`, `wed`, `thu`, `fri`, `sat`
- Separate multiple days with commas: `mon,wed,fri`
- Intervals: `every2days`, `every3days`, etc.

### Date Formats:
- `YYYY-MM-DD` - Specific date (e.g., 2023-12-31)
- `today` - Today's date
- `tomorrow` - Tomorrow's date
- `+Nhours` - N hours from now (e.g., +2hours)
- `+Nminutes` - N minutes from now (e.g., +30minutes)

### Time Format:
- 24-hour format: `hour:minute` (e.g., 20:00 for 8:00 PM)
- Time values are in UTC timezone

### Countdown Format (for !countdown command):
- `HH:MM:SS` - Hours:Minutes:Seconds as shown in game
- Examples:
  • 19:38:49 (19 hours, 38 minutes, 49 seconds)
  • 2:30:00 (2 hours, 30 minutes)
  • 0:45:30 (45 minutes, 30 seconds)

## ADVANCED: CRON PATTERN FORMAT
Format: `minute hour dayOfMonth month dayOfWeek`

### Common Patterns:
- `0 20 * * *` - Every day at 8:00 PM
- `0 *\/6 * * *` - Every 6 hours (at 00:00, 06:00, 12:00, 18:00)
- `0 8 *\/2 * *` - Every 2 days at 8:00 AM
- `0 20 * * 1,3,5` - Monday, Wednesday, Friday at 8:00 PM
- `30 20 1 * *` - 1st day of each month at 8:30 PM

### Values:
- Days of week: 0=Sunday, 1=Monday, 2=Tuesday, etc.
- Months: 1=January, 2=February, etc.
- Special characters:
  • `*` - any value
  • `,` - value list separator (e.g., 1,3,5)
  • `-` - range of values (e.g., 1-5)
  • `/` - step values (e.g., *\/2)
*/
