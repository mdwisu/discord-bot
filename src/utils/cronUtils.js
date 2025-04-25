// src/utils/cronUtils.js

/**
 * Translates a cron pattern into a human-readable description
 * @param {string} pattern Cron pattern (minute hour dayOfMonth month dayOfWeek)
 * @returns {string} Human-readable description of the schedule
 */
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

/**
 * Parse day input string into cron day-of-week or day-of-month pattern
 * @param {string} dayInput Day input like 'daily', 'weekend', 'mon,wed,fri', 'every2days'
 * @returns {object} Object with pattern and type ('dayOfWeek' or 'dayOfMonth')
 */
function parseDaysToCronPattern(dayInput) {
  if (!dayInput) {
    return { pattern: "*", type: "dayOfWeek" };
  }
  
  const lowerDayInput = dayInput.toLowerCase();
  
  // Check for special keywords
  if (lowerDayInput === "daily") {
    return { pattern: "*", type: "dayOfWeek" };
  } 
  else if (lowerDayInput === "weekend") {
    return { pattern: "0,6", type: "dayOfWeek" };
  } 
  else if (lowerDayInput === "weekday") {
    return { pattern: "1-5", type: "dayOfWeek" };
  } 
  else if (lowerDayInput.startsWith("every")) {
    // Handle 'every2days', 'every3days', etc.
    const dayInterval = lowerDayInput.replace("every", "").replace("days", "").replace("day", "");
    if (!isNaN(dayInterval) && parseInt(dayInterval) > 0) {
      return { pattern: `*/${dayInterval}`, type: "dayOfMonth" };
    }
  } 
  else {
    // Handle comma-separated days like "mon,wed,fri"
    const dayMap = {
      sun: 0, sunday: 0,
      mon: 1, monday: 1,
      tue: 2, tuesday: 2,
      wed: 3, wednesday: 3,
      thu: 4, thursday: 4,
      fri: 5, friday: 5,
      sat: 6, saturday: 6
    };

    const daysList = lowerDayInput.split(",");
    const daysNumbers = [];

    for (const day of daysList) {
      if (dayMap[day] !== undefined) {
        daysNumbers.push(dayMap[day]);
      }
    }

    if (daysNumbers.length > 0) {
      return { pattern: daysNumbers.join(","), type: "dayOfWeek" };
    }
  }
  
  // Default fallback
  return { pattern: "*", type: "dayOfWeek" };
}

/**
 * Create a cron pattern from user-friendly inputs
 * @param {string} dayInput Day input string
 * @param {string} hourInput Hour in 24-hour format
 * @param {string} minuteInput Minute (0-59)
 * @returns {string} Complete cron pattern
 */
function createCronPattern(dayInput, hourInput, minuteInput) {
  const { pattern: dayPattern, type: dayType } = parseDaysToCronPattern(dayInput);
  
  // Create cron pattern based on the type of day pattern
  if (dayType === "dayOfMonth") {
    // If using */n format, it belongs in the day-of-month field
    return `${minuteInput} ${hourInput} ${dayPattern} * *`;
  } else {
    // Otherwise it's a day-of-week pattern
    return `${minuteInput} ${hourInput} * * ${dayPattern}`;
  }
}

module.exports = {
  translateCronToHumanReadable,
  parseDaysToCronPattern,
  createCronPattern
};