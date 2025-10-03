// This server-side file handles integration between a Clerk-authenticated user and their Google Calendar. It provides two main functions: one for fetching all the user's calendar events within a specified date range (`getCalendarEventTimes`), and another for creating a new calendar event (`createCalendarEvent`). It authenticates users via OAuth using Clerk, formats date values using `date-fns`, and communicates with the Google Calendar API using the `googleapis` package. The file ensures all logic runs securely on the server, marked explicitly by `'use server'`.

'use server'

import { clerkClient } from "@clerk/nextjs/server";
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