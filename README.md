
# Court Diary Watcher

A Chrome extension that checks Google Calendar for legal-looking
events whose hearing has ended and whose calendar entry has not
been edited since the hearing.

## Features

- Read-only Google Calendar access.
- Detects legal-related keywords in event titles and descriptions.
- Flags entries at least two days past their hearing end.
- Checks up to 60 days back by default.
- Handles paginated Calendar API responses.
- Displays a reminder with Copy and Close buttons.
- Supports manual checks and scheduled checks every two hours.
- Avoids opening duplicate reminder windows.

## Files

- manifest.json: Extension configuration and OAuth settings.
- background.js: Calendar API requests and reminder scheduling.
- popup.html: Reminder interface.
- popup.js: Interface behaviour and authorization.

## Step 1: Enable Google Calendar API

1. Open https://console.cloud.google.com/
2. Create a Google Cloud project.
3. Open APIs & Services > Library.
4. Search for Google Calendar API and enable it.
5. Configure the OAuth consent screen and add your account
   as a test user if the app is in testing mode.

## Step 2: Load the extension

1. Open chrome://extensions/.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the court-diary-watcher folder.
5. Copy the extension ID shown on its extension card.

## Step 3: Create an OAuth client

1. Open Google Cloud > APIs & Services > Credentials.
2. Create an OAuth client ID.
3. Select Chrome Extension if that client type is
   available for your project.
4. Enter the extension ID copied in Step 2.
5. Copy the generated client ID.

If the Chrome Extension client type is unavailable,
check Google's current OAuth configuration requirements
for Chrome extensions before choosing another client type.

## Step 4: Configure the extension

1. Open manifest.json.
2. Replace the placeholder client ID with your actual ID.
3. Save the file.
4. Reload the extension at chrome://extensions/.
5. Click the extension icon and select
   Connect Google Calendar.
6. Sign in and grant read-only Calendar access.

## Step 5: Select the calendar

The default is:

    const CALENDAR_ID = "primary";

For a separate court diary calendar:

1. Open Google Calendar settings.
2. Select the required calendar.
3. Find Integrate calendar.
4. Copy the Calendar ID.
5. Replace "primary" in background.js.
6. Save the file and reload the extension.

## Step 6: Customize the settings

At the top of background.js:

- STALE_DAYS = 2
- INTERVAL_MIN = 120
- LOOKBACK_DAYS = 60
- CALENDAR_ID = "primary"

Reload the extension after changing settings.

## Testing

1. Create a test event in Google Calendar with a title
   such as "Test vs Example".
2. Set its date to more than two days ago.
3. Do not edit it after its hearing date.
4. Click the extension icon.
5. Connect Google Calendar if required.
6. Click Check now.

Use a separate test calendar where possible.

## Troubleshooting

No reminders:
- Check the selected calendar ID.
- Check the event date and legal keywords.
- Confirm the event was not edited after the hearing.
- Check the service worker console in chrome://extensions/.

Authorization errors:
- Confirm the OAuth client ID matches the extension ID.
- Check the Google Calendar API is enabled.
- Confirm your Google account is authorized as a test user
  if required by the consent-screen configuration.

No automatic popup:
- Open the extension once and connect Google Calendar.
- Check the service worker console for errors.
- Confirm the scheduled alarm exists.
- Remember that Chrome may delay alarms under some conditions.

## Privacy and limitations

The extension requests read-only Google Calendar access.
It sends requests to Google's Calendar API and stores the
resulting reminder list locally in Chrome extension storage.

It does not determine whether a court has issued an order,
whether a case has changed status, or whether a new hearing
date exists outside the calendar entry.

Treat the reminders as prompts for manual verification.
