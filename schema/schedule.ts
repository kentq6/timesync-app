import { DAYS_OF_WEEK_IN_ORDER } from "@/constants";
import { timeToFloat } from "@/lib/utils";
import z from "zod";

export const scheduleFormSchema = z.object({
  timezone: z.string().min(1, "Required"), // The timezone must be a string and cannot be empty
  availabilities: z // The 'availabilities' field is an array
    .array(
      z.object({
        dayOfWeek: z.enum(DAYS_OF_WEEK_IN_ORDER), // 'dayOfWeek' must be one of the days from the DAYS_OF_WEEK_IN_ORDER
        startTime: z // 'startTime' must be a string that matches the HH:MM format (24-hour time)
          .string()
          .regex(
            /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, // Regex patter to match the time)
            "time must be in the format HH:MM" // Custom error message if the time doesn't match the pattern

            // Valid examples: '00:00', '09:15', '14:30', '23:50'
            // Invalid examples: '9:15', '24:50', '12:60'
          ),
        endTime: z // 'endTime' follows the same validation as 'startTime'
          .string()
          .regex(
            /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, // Regex patter to match the time)
            "time must be in the format HH:MM" // Custom error message if the time doesn't match the pattern
          ),
      })
    )

    // Ensure users can't submit overlapping or backward time ranges - like 2:00-1:00pm, or two blocks on the same day that conflict
    .superRefine((availabilities, ctx) => {
      // Custom refinement function to add additional validation
      availabilities.forEach((availability, index) => {
        // Loop through each availability in the array
        const overlaps = availabilities.some((a, i) => {
          // Check if there are any time overlaps with other availabilities
          return (
            i !== index && // Ensure it's not comparing the same item to itself
            a.dayOfWeek === availability.dayOfWeek && // Check if it's the same day of the week
            // If a.dayOfWeek === availability.dayOfWeek is true, it means that the two availability entries being compared are for the same day of the week—for example, both are on Monday
            timeToFloat(a.startTime) < timeToFloat(availability.endTime) && // Check if the start time of one is before the end time of another
            timeToFloat(a.endTime) > timeToFloat(availability.startTime) // Check if the end time of one is after the start time of another
          );
        });

        // The some() function here is being used to check if any availability in the list overlaps with the one currently being edited (at index)
        // some() loops through the availabilities array
        // For each availability a, it checks:
        // It's not the same item (avoids comparing with itself)
        // It's on the same day
        // The time ranges overlap
        // If any availability passes all these checks, some() returns true

        if (overlaps) {
          // If there is an overlap, add a validation issue
          ctx.addIssue({
            code: "custom", // Custom validation error code
            message: "Availability overlaps with another", // Custom error message
            path: [index, "startTime"], // This attaches error to startTime field
          });
        }

        // Check if start time is greater than or equal to end time
        if (
          timeToFloat(availability.startTime) >=
          timeToFloat(availability.endTime)
        ) {
          ctx.addIssue({
            code: "custom", // Custom validation error code
            message: "End time must be after start time", // Custom error message
            path: [index, "endTime"], // This attaches error to endTime field
          });
        }
      });
    }),
});
