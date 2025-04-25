// src/utils/dateUtils.js

/**
 * Format time until a target date in a human-readable way
 * @param {Date} targetTime Target date/time
 * @returns {string} Human-readable time difference
 */
function formatTimeUntil(targetTime) {
  const now = new Date();
  const timeUntil = targetTime.getTime() - now.getTime();

  if (timeUntil <= 0) {
    return "Happening now!";
  }

  // Calculate human-readable time difference
  const days = Math.floor(timeUntil / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

  let countdownText = "";
  if (days > 0) countdownText += `${days} days, `;
  if (hours > 0 || days > 0) countdownText += `${hours} hours, `;
  if (minutes > 0 || hours > 0 || days > 0) countdownText += `${minutes} minutes, `;
  countdownText += `${seconds} seconds`;

  return countdownText;
}

/**
 * Parse a user-friendly date string into a Date object
 * @param {string} dateStr Date string like 'today', 'tomorrow', '2023-12-25', '+2hours', etc.
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseUserFriendlyDate(dateStr) {
  if (!dateStr) return null;
  
  const lowerDateStr = dateStr.toLowerCase();
  let date = new Date();
  
  // Handle special keywords
  if (lowerDateStr === 'today') {
    // Just use today's date, already set
    date.setUTCHours(0, 0, 0, 0);
    return date;
  } 
  else if (lowerDateStr === 'tomorrow') {
    // Use tomorrow's date
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  } 
  else if (lowerDateStr.startsWith('+') && 
          (lowerDateStr.endsWith('hours') || lowerDateStr.endsWith('hour'))) {
    // Handle +Nhours format
    const hours = parseInt(lowerDateStr.replace('+', '').replace('hours', '').replace('hour', ''));
    if (isNaN(hours)) return null;
    
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  } 
  else if (lowerDateStr.startsWith('+') && 
          (lowerDateStr.endsWith('minutes') || lowerDateStr.endsWith('minute'))) {
    // Handle +Nminutes format
    const minutes = parseInt(lowerDateStr.replace('+', '').replace('minutes', '').replace('minute', ''));
    if (isNaN(minutes)) return null;
    
    return new Date(Date.now() + minutes * 60 * 1000);
  } 
  else {
    // Handle YYYY-MM-DD format
    try {
      const dateParts = lowerDateStr.split('-');
      if (dateParts.length !== 3) return null;

      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Months are 0-indexed
      const day = parseInt(dateParts[2]);

      const parsedDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
      if (isNaN(parsedDate.getTime())) return null;
      
      return parsedDate;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Parse a time string in HH:MM format
 * @param {string} timeStr Time string in HH:MM format
 * @param {Date} dateObj Date object to apply the time to
 * @returns {Date|null} Date with time set or null if invalid
 */
function parseTimeString(timeStr, dateObj) {
  if (!timeStr || !dateObj) return null;
  
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return null;

  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const newDate = new Date(dateObj);
  newDate.setUTCHours(hour, minute, 0, 0);
  return newDate;
}

module.exports = {
  formatTimeUntil,
  parseUserFriendlyDate,
  parseTimeString
};