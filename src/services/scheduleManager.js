// src/services/scheduleManager.js
const cron = require("node-cron");
const { config } = require("../config");
const {
  translateCronToHumanReadable,
  formatTimeUntil,
} = require("../utils/cronUtils");
const { NotificationService } = require("./notificationService");

/**
 * Manages all schedule-related functionality
 */
class ScheduleManager {
  constructor(client) {
    this.client = client;
    this.notificationService = new NotificationService(client);

    // Object to store active schedules
    // Format: { "scheduleId": { pattern, job, description, created, ... } }
    this.activeSchedules = {};

    // Variable to store schedule history (limited to last X)
    this.scheduleHistory = [];

    // Default target channel
    this.targetChannelId = config.targetChannelId;
  }

  /**
   * Set target channel for notifications
   * @param {string} channelId Discord channel ID
   */
  setTargetChannel(channelId) {
    this.targetChannelId = channelId;
    return this.targetChannelId;
  }

  /**
   * Get current target channel
   * @returns {string} Current target channel ID
   */
  getTargetChannel() {
    return this.targetChannelId;
  }

  /**
   * Generate a unique ID for schedules
   * @param {string} prefix Optional prefix for the ID
   * @returns {string} Unique schedule ID
   */
  generateScheduleId(prefix = "sched") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * Add a schedule entry to history
   * @param {string} id Schedule ID
   * @param {string} pattern Schedule pattern
   * @param {string} description Human-readable description
   * @param {string} note Optional note
   * @param {boolean} removed Whether the schedule was removed
   * @param {string} status Optional status information
   */
  addToScheduleHistory(
    id,
    pattern,
    description,
    note = "",
    removed = false,
    status = ""
  ) {
    const historyEntry = {
      id: id,
      pattern: pattern,
      description: description,
      timestamp: new Date().toUTCString(),
      action: removed ? "removed" : "created",
      note: note,
      status: status,
    };

    this.scheduleHistory.push(historyEntry);

    // Limit history to configured maximum entries
    if (this.scheduleHistory.length > config.maxHistoryEntries) {
      this.scheduleHistory.shift(); // Remove oldest entry
    }
  }

  /**
   * Add a new recurring schedule
   * @param {string} pattern Cron pattern
   * @param {string} note Optional note
   * @param {string} type Optional schedule type
   * @returns {object} Information about the created schedule
   */
  addSchedule(pattern, note = "", type = "recurring") {
    try {
      // Validate the pattern
      cron.validate(pattern);

      // Generate unique ID for this schedule
      const scheduleId = this.generateScheduleId();

      // Create the cron job
      const job = cron.schedule(
        pattern,
        () => {
          console.log(
            `Schedule ${scheduleId} running at: ${new Date().toUTCString()}`
          );

          if (type === "recurring-invasion") {
            this.notificationService.sendInvasionNotification(
              this.targetChannelId,
              scheduleId,
              this.activeSchedules[scheduleId]
            );
          } else {
            this.notificationService.sendGeneralReminder(
              this.targetChannelId,
              scheduleId,
              "Scheduled Reminder",
              "This is a scheduled reminder."
            );
          }
        },
        {
          timezone: "UTC", // Important to set timezone to UTC
        }
      );

      // Create human-readable description
      const description = translateCronToHumanReadable(pattern);

      // Add to active schedules
      this.activeSchedules[scheduleId] = {
        type: type,
        pattern: pattern,
        job: job,
        description: description,
        created: new Date().toUTCString(),
        note: note,
      };

      console.log(
        `New ${type} schedule created with ID ${scheduleId}: ${pattern} (UTC)`
      );

      // Add to schedule history
      this.addToScheduleHistory(scheduleId, pattern, description, note);

      return {
        id: scheduleId,
        pattern: pattern,
        description: description,
        type: type,
      };
    } catch (error) {
      console.error(`Failed to create ${type} schedule:`, error);
      throw error;
    }
  }

  /**
   * Remove a schedule by ID
   * @param {string} scheduleId ID of the schedule to remove
   * @returns {object} Information about the removed schedule
   */
  removeSchedule(scheduleId) {
    if (this.activeSchedules[scheduleId]) {
      const schedule = this.activeSchedules[scheduleId];

      // Handle different schedule types
      if (schedule.type === "invasion" || schedule.type === "one-time") {
        // If this is a one-time schedule with a timeout, clear it
        if (schedule.timeoutId) {
          clearTimeout(schedule.timeoutId);
        }

        // Also remove any associated reminders
        if (schedule.type === "invasion") {
          Object.keys(this.activeSchedules).forEach((id) => {
            if (id.startsWith(`${scheduleId}_reminder_`)) {
              const reminder = this.activeSchedules[id];
              if (reminder.timeoutId) {
                clearTimeout(reminder.timeoutId);
              }
              delete this.activeSchedules[id];
            }
          });
        }
      } else if (schedule.job) {
        // For cron job schedules, stop the job
        schedule.job.stop();
      }

      // Store information about the removed schedule
      const removedSchedule = {
        id: scheduleId,
        pattern: schedule.pattern || "one-time",
        description: schedule.description,
        created: schedule.created,
        removed: new Date().toUTCString(),
        note: schedule.note,
        type: schedule.type,
      };

      // Remove from active schedules
      delete this.activeSchedules[scheduleId];

      console.log(`Schedule ${scheduleId} removed`);

      // Add to schedule history with removal info
      this.addToScheduleHistory(
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

  /**
   * Schedule an invasion from a countdown timer
   * @param {string} countdownStr Countdown in HH:MM:SS format
   * @param {string} note Optional note
   * @returns {object} Information about the created invasion schedule
   */
  scheduleFromCountdown(countdownStr, note = "") {
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
      return this.addInvasionSchedule(invasionTime.toISOString(), note);
    } catch (error) {
      console.error("Failed to schedule from countdown:", error);
      throw error;
    }
  }

  /**
   * Add a one-time invasion schedule with multiple reminders
   * @param {string} invasionTimeStr ISO string for invasion time
   * @param {string} note Optional note
   * @param {Array} customReminderTimes Optional custom reminder times in minutes
   * @returns {object} Information about the created invasion schedule
   */
  addInvasionSchedule(invasionTimeStr, note = "", customReminderTimes = null) {
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
      const invasionId = this.generateScheduleId("invasion");

      // Create human-readable description
      const description = `Invasion at ${invasionTime.toUTCString()}`;

      // Schedule the actual invasion alert
      const invasionDelay = invasionTime.getTime() - now.getTime();
      const invasionTimeoutId = setTimeout(() => {
        console.log(
          `Invasion ${invasionId} starting at: ${new Date().toUTCString()}`
        );
        this.notificationService.sendInvasionStartNotification(
          this.targetChannelId,
          invasionId,
          invasionTime
        );

        // After running, remove it from active schedules
        delete this.activeSchedules[invasionId];
        Object.keys(this.activeSchedules).forEach((id) => {
          if (id.startsWith(`${invasionId}_reminder_`)) {
            delete this.activeSchedules[id];
          }
        });

        // Add to history as 'completed'
        this.addToScheduleHistory(
          invasionId,
          `Invasion at ${invasionTime.toUTCString()}`,
          description,
          note,
          true,
          "completed"
        );
      }, invasionDelay);

      // Add main invasion to active schedules
      this.activeSchedules[invasionId] = {
        type: "invasion",
        scheduledTime: invasionTime,
        timeoutId: invasionTimeoutId,
        description: description,
        created: new Date().toUTCString(),
        note: note,
        remindersSent: [],
      };

      // Schedule reminder notifications
      const reminderTimes = customReminderTimes || config.standardReminderTimes;
      const remindersScheduled = [];

      reminderTimes.forEach((reminder) => {
        // For custom reminder times, handle the format difference
        const minutes =
          typeof reminder === "number" ? reminder : reminder.minutes;
        const label =
          typeof reminder === "number"
            ? minutes >= 60
              ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
              : `${minutes}m`
            : reminder.label;

        const reminderTime = new Date(
          invasionTime.getTime() - minutes * 60 * 1000
        );

        // Skip reminders that would occur in the past
        if (reminderTime <= now) {
          console.log(
            `Skipping ${label} reminder for invasion ${invasionId} - would occur in the past`
          );
          return;
        }

        const reminderId = `${invasionId}_reminder_${minutes}`;
        const reminderDelay = reminderTime.getTime() - now.getTime();

        console.log(
          `Scheduling ${label} reminder for invasion ${invasionId} at ${reminderTime.toUTCString()}`
        );

        const reminderTimeoutId = setTimeout(() => {
          console.log(`Sending ${label} reminder for invasion ${invasionId}`);
          this.notificationService.sendInvasionReminderNotification(
            this.targetChannelId,
            invasionId,
            label,
            reminderTime,
            invasionTime
          );

          // After running, remove just this reminder from active schedules
          delete this.activeSchedules[reminderId];

          // Add this reminder to the list of sent reminders for the main invasion
          if (this.activeSchedules[invasionId]) {
            this.activeSchedules[invasionId].remindersSent.push(label);
          }

          // Add to history as 'completed reminder'
          this.addToScheduleHistory(
            reminderId,
            `Invasion reminder (${label} before)`,
            `Reminder for invasion at ${invasionTime.toUTCString()}`,
            note,
            true,
            "completed reminder"
          );
        }, reminderDelay);

        // Add this reminder to active schedules
        this.activeSchedules[reminderId] = {
          type: "invasion-reminder",
          parentId: invasionId,
          reminderTime: reminderTime,
          invasionTime: invasionTime,
          timeUntilInvasion: label,
          timeoutId: reminderTimeoutId,
          description: `${label} reminder for invasion at ${invasionTime.toUTCString()}`,
          created: new Date().toUTCString(),
          note: note,
        };

        remindersScheduled.push(label);
      });

      console.log(
        `New invasion schedule created with ID ${invasionId}: ${invasionTime.toUTCString()} with ${
          remindersScheduled.length
        } reminders`
      );

      // Add to schedule history
      this.addToScheduleHistory(
        invasionId,
        `Invasion at ${invasionTime.toUTCString()}`,
        description,
        note
      );

      return {
        id: invasionId,
        scheduledTime: invasionTime,
        description: description,
        reminders: remindersScheduled,
      };
    } catch (error) {
      console.error("Failed to create invasion schedule:", error);
      throw error;
    }
  }

  /**
   * Add a one-time general reminder
   * @param {string} dateTimeStr ISO string for reminder time
   * @param {string} title Reminder title
   * @param {string} message Reminder message
   * @param {string} note Optional note
   * @returns {object} Information about the created reminder
   */
  addOneTimeReminder(dateTimeStr, title, message, note = "") {
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
      const scheduleId = this.generateScheduleId("reminder");

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
        this.notificationService.sendGeneralReminder(
          this.targetChannelId,
          scheduleId,
          reminderData.title,
          reminderData.message
        );

        // After running, remove it from active schedules
        delete this.activeSchedules[scheduleId];

        // Add to history as 'completed'
        this.addToScheduleHistory(
          scheduleId,
          `One-time reminder at ${scheduledTime.toUTCString()}`,
          description,
          note,
          true,
          "completed"
        );
      }, delay);

      // Add to active schedules with special type marker
      this.activeSchedules[scheduleId] = {
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
      this.addToScheduleHistory(
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

  /**
   * Get all active schedules
   * @returns {object} All active schedules
   */
  getAllSchedules() {
    return this.activeSchedules;
  }

  /**
   * Get schedule history
   * @returns {Array} Schedule history
   */
  getScheduleHistory() {
    return this.scheduleHistory;
  }
}

module.exports = { ScheduleManager };
