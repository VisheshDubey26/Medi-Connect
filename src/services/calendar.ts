import { db } from '../db/index.ts';
import { auditLogs } from '../db/schema.ts';

interface CalendarEventParams {
  summary: string;
  description: string;
  startDateTime: string; // ISO String
  endDateTime: string; // ISO String
  patientEmail?: string;
  doctorName?: string;
}

/**
 * Service to sync and manage calendar events with Google Calendar.
 * Since the user is logged in via Firebase Google OAuth, we can use their OAuth Token
 * if provided, or gracefully simulate the calendar event sync with Audit logs
 * in case of API access limits or unconfigured OAuth variables.
 */
export async function createGoogleCalendarEvent(
  accessToken: string | null,
  userId: number,
  params: CalendarEventParams
): Promise<string> {
  const { summary, description, startDateTime, endDateTime, patientEmail } = params;

  // Log the action to database audits
  await db.insert(auditLogs).values({
    userId,
    action: 'CREATE_CALENDAR_EVENT',
    details: {
      summary,
      startDateTime,
      endDateTime,
      patientEmail,
      status: accessToken ? 'PENDING_GOOGLE_SYNC' : 'LOCAL_LOGGED_ONLY',
    },
  });

  if (!accessToken) {
    console.log('No Google Calendar access token available. Simulating event sync.');
    return `mock_event_${Date.now()}`;
  }

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary,
          description,
          start: {
            dateTime: startDateTime,
            timeZone: 'UTC',
          },
          end: {
            dateTime: endDateTime,
            timeZone: 'UTC',
          },
          attendees: patientEmail ? [{ email: patientEmail }] : [],
          reminders: {
            useDefault: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar API Error: ${errText}`);
    }

    const data: any = await response.json();
    console.log(`Successfully synced event to Google Calendar. Event ID: ${data.id}`);

    // Log success
    await db.insert(auditLogs).values({
      userId,
      action: 'CALENDAR_EVENT_SYNC_SUCCESS',
      details: { eventId: data.id },
    });

    return data.id;
  } catch (error: any) {
    console.error('Failed to sync event with Google Calendar API:', error);
    // Graceful fallback - return a mock ID so the booking is not blocked (as per requirements!)
    return `mock_event_${Date.now()}_fallback`;
  }
}

/**
 * Updates an existing calendar event.
 */
export async function updateGoogleCalendarEvent(
  accessToken: string | null,
  userId: number,
  eventId: string,
  params: Partial<CalendarEventParams>
): Promise<boolean> {
  await db.insert(auditLogs).values({
    userId,
    action: 'UPDATE_CALENDAR_EVENT',
    details: { eventId, ...params },
  });

  if (!accessToken || eventId.startsWith('mock_')) {
    console.log(`Skipping real Google update for event ID: ${eventId}`);
    return true;
  }

  try {
    const updateBody: any = {};
    if (params.summary) updateBody.summary = params.summary;
    if (params.description) updateBody.description = params.description;
    if (params.startDateTime) {
      updateBody.start = { dateTime: params.startDateTime, timeZone: 'UTC' };
    }
    if (params.endDateTime) {
      updateBody.end = { dateTime: params.endDateTime, timeZone: 'UTC' };
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateBody),
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Failed to update Google Calendar event ${eventId}:`, error);
    return false;
  }
}

/**
 * Deletes a calendar event.
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string | null,
  userId: number,
  eventId: string
): Promise<boolean> {
  await db.insert(auditLogs).values({
    userId,
    action: 'DELETE_CALENDAR_EVENT',
    details: { eventId },
  });

  if (!accessToken || eventId.startsWith('mock_')) {
    console.log(`Skipping real Google deletion for event ID: ${eventId}`);
    return true;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Failed to delete Google Calendar event ${eventId}:`, error);
    return false;
  }
}
