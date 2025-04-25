// src/commands/index.js

// Import all command modules
const setupCommands = require("./setup");
const invasionCommands = require("./invasion");
const reminderCommands = require("./reminder");
const scheduleCommands = require("./schedule");
const helpCommands = require("./help");

/**
 * All available bot commands
 */
const commands = [
  // Setup commands
  setupCommands.setChannel,
  setupCommands.status,
  setupCommands.timeNow,

  // Invasion commands
  invasionCommands.invasion,
  invasionCommands.countdown,
  invasionCommands.customCountdown,
  invasionCommands.testNotif,
  invasionCommands.recurringInvasion,

  // Reminder commands
  reminderCommands.reminder,

  // Schedule commands
  scheduleCommands.scheduleEasy,
  scheduleCommands.addSchedule,
  scheduleCommands.removeSchedule,
  scheduleCommands.listSchedules,
  scheduleCommands.schedules,
  scheduleCommands.scheduleHistory,

  // Help commands
  helpCommands.help,
  helpCommands.invasionHelp,
  helpCommands.reminderHelp,
  helpCommands.scheduleHelp,
];

module.exports = { commands };
