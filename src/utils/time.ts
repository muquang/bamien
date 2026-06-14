/**
 * Time slot utilities – ported from PHP getClosestTime()
 */

export const AVAILABLE_TIMES = ["10h", "12h", "14h30", "16h30", "19h", "21h"] as const;
export type TimeSlot = (typeof AVAILABLE_TIMES)[number];

const TIME_SLOTS_MINUTES: Record<string, number> = {
  "10h": 10 * 60,
  "12h": 12 * 60,
  "14h30": 14 * 60 + 30,
  "16h30": 16 * 60 + 30,
  "19h": 19 * 60,
  "21h": 21 * 60,
};

/**
 * Get the closest time slot based on current UTC+7 time.
 * Ported from PHP: after 21h, selects 10h (next day).
 */
export function getClosestTime(): TimeSlot {
  // Get current time in UTC+7 (Asia/Bangkok)
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const currentHour = utc7.getUTCHours();
  const currentMinute = utc7.getUTCMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;

  let closestTime: TimeSlot = "10h";
  let minDifference = Number.MAX_SAFE_INTEGER;

  for (const time of AVAILABLE_TIMES) {
    const slotMinutes = TIME_SLOTS_MINUTES[time]!;
    let difference = Math.abs(currentTotalMinutes - slotMinutes);

    // After 21h → select 10h next day
    if (currentTotalMinutes > TIME_SLOTS_MINUTES["21h"]!) {
      if (time === "10h") {
        const nextDayDiff = 24 * 60 - currentTotalMinutes + TIME_SLOTS_MINUTES["10h"]!;
        if (nextDayDiff < difference) {
          difference = nextDayDiff;
        }
      }
    }

    if (difference < minDifference) {
      minDifference = difference;
      closestTime = time;
    }
  }

  return closestTime;
}

/**
 * Validate if a string is a valid time slot.
 */
export function isValidTimeSlot(time: string | undefined | null): time is TimeSlot {
  if (!time) return false;
  return (AVAILABLE_TIMES as readonly string[]).includes(time);
}

/**
 * Get the selected time slot from query param, falling back to closest.
 */
export function resolveTimeSlot(queryTime: string | undefined | null): TimeSlot {
  if (isValidTimeSlot(queryTime)) return queryTime;
  return getClosestTime();
}
