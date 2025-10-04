// This server-side file handles integration between a Clerk-authenticated user and their Google Calendar. It provides two main functions: one for fetching all the user's calendar events within a specified date range (`getCalendarEventTimes`), and another for creating a new calendar event (`createCalendarEvent`). It authenticates users via OAuth using Clerk, formats date values using `date-fns`, and communicates with the Google Calendar API using the `googleapis` package. The file ensures all logic runs securely on the server, marked explicitly by `'use server'`.

'use server'

import { clerkClient } from "@clerk/nextjs/server";
import { endOfDay, startOfDay } from "date-fns";
import { google } from "googleapis";

async function getOAuthClient(clerkUserId: string) {
  try {
    // Initialize Clerk client
    const client = await clerkClient();

    // fetch the OAuth access token for the given Clerk user ID
    const { data } = await client.users.getUserOauthAccessToken(clerkUserId, 'google');

    // Check if the data is empty or the token is missing, throw an error
    if (data.length === 0 || !data[0].token) {
      throw new Error("No OAuth data or token found for the user.");
    }

    // Initialize OAuth2 client with Google Credentials
    const oAuthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URL
    );

    // Set the credentials with the obtained access token
    oAuthClient.setCredentials({ access_token: data[0].token });

    return oAuthClient;
  } catch (error: any) {
    throw new Error(`Failed to get OAuth client: ${error.message}`);
  }
}

// Fetch and format calendar events for a user between a given date range
export async function getCalendarEventTimes(
  clerkUserId: string,
  { start, end }: { start: Date; end: Date }
): Promise<{ start: Date; end: Date }[]> {
  try {
    // get OAuth client for Google Calendar API authentication
    const oAuthClient = await getOAuthClient(clerkUserId);

    if (!oAuthClient) {
      throw new Error("OAuth client could not be obtained.");
    }

    // Fetch events from the Google Calendar API
    const events = await google.calendar("v3").events.list({
      calendarId: "primary", // Use the user's primary calendar
      eventTypes: ["default"], // Only fetch regular (non-special) events
      singleEvents: true, // Expand recurring events into single instances
      timeMin: start.toISOString(), // Start of the time range (inclusive)
      timeMax: end.toISOString(), // End of the time range (exclusive)
      maxResults: 2500, // Limit the number of returned events (max allowed by Google)
      auth: oAuthClient, // OAuth2 client for authenticating the API call
    });

    // Process and format the events
    return (
      events.data.items?.map(event => {
        // Handle all-day events (no specific time, just a date)
        if (event.start?.date && event.end?.date) {
          return {
            start: startOfDay(new Date(event.start.date)), // Set time to 00:00 of the start date
            end: endOfDay(new Date(event.end.date)), // Set time to 23:59 of the end date
          };
        }

        // Handle timed events with exact start and end date-times
        if (event.start?.dateTime && event.end?.dateTime) {
          return {
            start: new Date(event.start.dateTime), // Convert to JavaScript Date object
            end: new Date(event.end.dateTime), // Convert to JavaScript Date object
          };
        }

        // Ignore events that are missing required time data
        return undefined;
      })
      // Filder out any undefined results and enfore correct typing
      .filter((date): date is { start: Date; end: Date } => date !== undefined) || []
    );
  } catch (error: any) {
    throw new Error(`Failed to fetch calendar events: ${error.message || error}`);
  }
}
