// Formats a duration in minutes into a readable string like "1 hr 30 mins"
export function formatEventDescription(durationInMinutes: number): string {
  const hours = Math.floor(durationInMinutes / 60); // Get number of full hours
  const minutes = durationInMinutes % 60; // Get remaining minutes after removing full hours

  // Format minutes string (e.g., "1 min" or "10 mins")
  const minutesString = `${minutes} ${minutes > 1 ? "mins" : "min"}`;
  // Format hours string (e.g., "1 hr" or "2 hrs")
  const hoursString = `${hours} ${hours > 1 ? "hrs" : "hr"}`;

  // Return only minutes if there are no full hours
  if (hours === 0) return minutesString;
  // Return only hours if there are no minutes
  if (minutes === 0) return hoursString;
  // Return both hours and minutes if both are present
  return `${hoursString} ${minutesString}`;
}