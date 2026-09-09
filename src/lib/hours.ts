// Store hours (Africa/Accra time — GMT, no DST).
// Adjust these two numbers if your actual opening/closing time is different.
const OPEN_HOUR = 10; // 10:00am
const CLOSE_HOUR = 22; // 10:00pm

const TIME_ZONE = "Africa/Accra";

export type OpenStatus = {
  isOpen: boolean;
  /** e.g. "Open · closes 10pm" or "Closed · opens 10am" */
  label: string;
};

function accraHourAndMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const rawHour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // Intl can report midnight as "24" with hour12: false.
  return { hour: rawHour === 24 ? 0 : rawHour, minute };
}

function formatHour(hour: number): string {
  const h = hour % 24;
  const period = h < 12 ? "am" : "pm";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}${period}`;
}

/** Computes live open/closed status from the current time (or a given time) in Accra. */
export function getOpenStatus(now: Date = new Date()): OpenStatus {
  const { hour, minute } = accraHourAndMinute(now);
  const minutesNow = hour * 60 + minute;
  const openMinutes = OPEN_HOUR * 60;
  const closeMinutes = CLOSE_HOUR * 60;

  const isOpen = minutesNow >= openMinutes && minutesNow < closeMinutes;

  return {
    isOpen,
    label: isOpen
      ? `Open · closes ${formatHour(CLOSE_HOUR)}`
      : `Closed · opens ${formatHour(OPEN_HOUR)}`,
  };
}
