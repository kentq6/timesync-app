// This server action handles saving a user's schedule by first validating the submitted form data using Zod and checking if the user is authenticated. If valid, it either inserts a new schedule or updates ane xisting one in the database, ensuring the schedule is linked to the authenticated user. It then clears any previously saved availabilities for that schedule and inserts the new ones provided by the user. All database operations are executed in a single batch to ensure consistency and efficiency.

'use server'

import { db } from "@/drizzle/db";
import { ScheduleAvailabilityTable, ScheduleTable } from "@/drizzle/schema";

type ScheduleRow = typeof ScheduleTable.$inferSelect;
type AvailabilityRow = typeof ScheduleAvailabilityTable.$inferSelect;

export type FullSchedule = ScheduleRow & {
  availabilities: AvailabilityRow[];
}

// This functio fetches the schedule (and its availabilities) for a given use rfrom the database
export async function getSchedule(userId: string): Promise<FullSchedule | null> {
  // Query the ScheduleTable for the first record that matches the user's ID
  // Also eagerly load the related 'availabilities' data
  const schedule = await db.query.ScheduleTable.findFirst({
    where: ({ clerkUserId }, { eq }) => eq(clerkUserId, userId), // Match schedule where user ID equals the provided userId
    with: {
      availabilities: true, // Include all related availability records
    }
  });

  // Return the schedule if found or null if it doesn't exist
  return schedule as FullSchedule | null;
}