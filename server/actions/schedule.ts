// This server action handles saving a user's schedule by first validating the submitted form data using Zod and checking if the user is authenticated. If valid, it either inserts a new schedule or updates ane xisting one in the database, ensuring the schedule is linked to the authenticated user. It then clears any previously saved availabilities for that schedule and inserts the new ones provided by the user. All database operations are executed in a single batch to ensure consistency and efficiency.

"use server";

import { db } from "@/drizzle/db";
import { ScheduleAvailabilityTable, ScheduleTable } from "@/drizzle/schema";
import { scheduleFormSchema } from "@/schema/schedule";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import z from "zod";
import { getCalendarEventTimes } from "../google/googleCalendar";

type ScheduleRow = typeof ScheduleTable.$inferSelect;
type AvailabilityRow = typeof ScheduleAvailabilityTable.$inferSelect;

export type FullSchedule = ScheduleRow & {
  availabilities: AvailabilityRow[];
};

// This functio fetches the schedule (and its availabilities) for a given use rfrom the database
export async function getSchedule(userId: string): Promise<FullSchedule> {
  // Query the ScheduleTable for the first record that matches the user's ID
  // Also eagerly load the related 'availabilities' data
  const schedule = await db.query.ScheduleTable.findFirst({
    where: ({ clerkUserId }, { eq }) => eq(clerkUserId, userId), // Match schedule where user ID equals the provided userId
    with: {
      availabilities: true, // Include all related availability records
    },
  });

  // Return the schedule if found or null if it doesn't exist
  return schedule as FullSchedule;
}

export async function saveSchedule(
  unsafeData: z.infer<typeof scheduleFormSchema>
) {
  try {
    // Get currently authenticated user's ID
    const { userId } = await auth();

    // Validate the incoming data against the schedula schema
    const { success, data } = scheduleFormSchema.safeParse(unsafeData);

    // If validation fails or no user is authenticated, throw an error
    if (!success || !userId) {
      throw new Error("Invalid schedule data or user not authenticated.");
    }

    // Destructure availabilities and the rest of the schedule data
    const { availabilities, ...scheduleData } = data;

    // Insert or update the user's schedule and return the schedule ID
    const [{ id: scheduleId }] = await db
      .insert(ScheduleTable)
      .values({ ...scheduleData, clerkUserId: userId }) // Associate schedule with the current user
      .onConflictDoUpdate({
        target: ScheduleTable.clerkUserId, // Update if a schedule for this user already exists
        set: scheduleData,
      })
      .returning({ id: ScheduleTable.id }); // Return the schedule ID for use in the next step

    // Initialize SQL statements for batch execution
    const statements: [BatchItem<"pg">] = [
      // First, delete any existing availabilities for this schedule
      db
        .delete(ScheduleAvailabilityTable)
        .where(eq(ScheduleAvailabilityTable.scheduleId, scheduleId)),
    ];

    // If there are availabilities, prepare an insert operation for them
    if (availabilities.length > 0) {
      statements.push(
        db.insert(ScheduleAvailabilityTable).values(
          availabilities.map((availability) => ({
            ...availability,
            scheduleId, // Link availability to the saved schedule
          }))
        )
      );
    }

    // Run all statements in a single transaction
    await db.batch(statements);
  } catch (error: any) {
    // Catch and throw an error with a readable message
    throw new Error(`Failed to save schedule: ${error.message || error}`);
  } finally {
    // Revalidate the /schedule path to udpate the cache and reflect the new data
    revalidatePath("/schedule");
  }
}

/**
 * Filters a list of time slots to return onylt hsoe that:
 * 1. Match the user's availability schedule
 * 2. Do not overlap with existing Google Calendar events
 */
export async function getValidTimesFromSchedule(
  timesInOrder: Date[], // All possible time slots to check
  event: { clerkUserId: string; durationInMinutes: number } // Event-specific data
): Promise<Date[]> {
  const { clerkUserId: userId, durationInMinutes } = event;

  // Define the start and end of the overall range to check
  const start = timesInOrder[0];
  const end = timesInOrder.at(-1);

  // If start or end is missing, there are no times to check
  if (!start || !end) return [];

  // Fetch the user's saved schedule along with their availabilities
  const schedule = await getSchedule(userId);

  // If no schedule is found, return an empty list (user has no availabilities)
  if (!schedule) return [];

  // Group availabilities by day of the week (e.g., Monday, Tuesday)
  const groupedAvailabilities = Object.groupBy(
    schedule.availabilities,
    (a) => a.dayOfWeek
  );

  // Fetch all existing Google Calendar events between start and end
  const eventTimes = await getCalendarEventTimes(userId, {
    start,
    end,
  });

  // Filter and return onyl valid time slots based on availability and conflicts
  return timesInOrder.filter((intervalDate) => {
    // Get the user's availabilities for the specific day, adjusted to their timezone
    const availabilities = getAvailabilities(
      groupedAvailabilities,
      intervalDate,
      schedule.timezone
    );
  });
}
