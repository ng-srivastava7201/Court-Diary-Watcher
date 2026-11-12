/* ============ SETTINGS ============ */

const CALENDAR_ID = "primary";
// Replace "primary" with separate Court Diary calendar ID if needed.

const STALE_DAYS = 2;
const INTERVAL_MIN = 120;
const LOOKBACK_DAYS = 60;

/* ================================= */

// If "wp" causes false matches (e.g. WordPress), delete it from the list.
const LEGAL_REGEX =
  /(?<![a-z])(?:vs\.?|v\/s|versus|v\.|crl|wp|slp|case\s*no|#case)(?![a-z])/i;
const EXCLUDE_REGEX =
    /\b(conferences?|meetings?)\b/i;
const POPUP_URL = chrome.runtime.getURL("popup.html");
const EXCLUDED_COLOR_IDS = ["11"];
/*
 * Use non-interactive authentication in the background.
 * Initial Google authorization is requested from popup.js
 * after the user clicks Connect Google Calendar.
 */
function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken(
      { interactive: false },
      (token) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(chrome.runtime.lastError.message)
          );
          return;
        }

        if (!token) {
          reject(new Error("Google authorization required."));
          return;
        }

        resolve(token);
      }
    );
  });
}


function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function setBadge(text, color) {
  await chrome.action.setBadgeText({ text });

  if (text) {
    await chrome.action.setBadgeBackgroundColor({ color });
  }
}

function getEventEndTimestamp(event) {
  if (!event.end) {
    return NaN;
  }

  if (event.end.dateTime) {
    return new Date(event.end.dateTime).getTime();
  }

  if (event.end.date) {
    return new Date(event.end.date).getTime() - 1;
  }

  return NaN;
}

async function findStaleCases(allowRetry = true) {
  const token = await getToken();

  const now = Date.now();
  const staleCutoff = now - STALE_DAYS * 86400000;
  const lookbackStart =
    new Date(now - LOOKBACK_DAYS * 86400000).toISOString();

  const baseUrl =
    "https://www.googleapis.com/calendar/v3/calendars/" +
    encodeURIComponent(CALENDAR_ID) +
    "/events";

  const params = {
    timeMin: lookbackStart,
    timeMax: new Date(staleCutoff).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250"
  };

  const events = [];
  let pageToken = null;

  do {
    const searchParams = new URLSearchParams(params);

    if (pageToken) {
      searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(
      `${baseUrl}?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.status === 401 && allowRetry) {
      await removeCachedToken(token);
      return findStaleCases(false);
    }

    if (!response.ok) {
      throw new Error(
        `Google Calendar API error: ${response.status}`
      );
    }

    const data = await response.json();

    events.push(...(data.items || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return events
    

.filter((event) => {
    const eventText =
        `${event.summary || ""} ${event.description || ""}`;

    if (!LEGAL_REGEX.test(eventText)) {
        return false;
    }

    const endTimestamp = getEventEndTimestamp(event);

    const updatedTimestamp =
        new Date(event.updated || "").getTime();

    if (
        !Number.isFinite(endTimestamp) ||
        !Number.isFinite(updatedTimestamp)
    ) {
        return false;
    }

    // Hearing must have ended at least 2 days ago.
    if (endTimestamp > staleCutoff) {
        return false;
    }

    if (updatedTimestamp > staleCutoff) {
        return false;
    }

    return true;
})

    .map((event) => ({
      title: event.summary || "(no title)",
      date: event.start?.dateTime || event.start?.date || "",
      link: event.htmlLink || ""
    }));
}

async function openReminderWindow() {
  const windows = await chrome.windows.getAll({
    populate: true
  });

  for (const win of windows) {
    const existingPopup = (win.tabs || []).some(
      (tab) => tab.url === POPUP_URL
    );

    if (existingPopup) {
      await chrome.windows.update(win.id, {
        focused: true
      });
      return;
    }
  }

  await chrome.windows.create({
    url: POPUP_URL,
    type: "popup",
    width: 540,
    height: 620
  });
}

async function checkAndNotify({ notify = true } = {}) {
  try {
    const pending = await findStaleCases();

    await chrome.storage.local.set({
      pending,
      lastChecked: Date.now(),
      lastError: ""
    });

    await setBadge(
      pending.length > 0 ? String(pending.length) : "",
      "#b42318"
    );

    if (notify && pending.length > 0) {
      await openReminderWindow();
    }

    return { ok: true };
  } catch (error) {
    console.error("Court Diary Watcher:", error);

    const message = error.message || "Calendar check failed.";

    await chrome.storage.local.set({ lastError: message });
    await setBadge("!", "#b42318");

    return { ok: false, error: message };
  }
}

function setup() {
  chrome.alarms.create("recheck", {
    periodInMinutes: INTERVAL_MIN
  });
  checkAndNotify({notify:false});
}

chrome.runtime.onStartup.addListener(setup);
chrome.runtime.onInstalled.addListener(setup);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "recheck") {
    checkAndNotify({notify:false});
  }
});


chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message?.action === "CALENDAR_OPENED") {

      if (
        sender.tab &&
        sender.url?.startsWith("https://calendar.google.com/")
      ) {
        checkAndNotify({ notify: true }).then(sendResponse);
        return true;
      }

      return false;
    }

    if (message?.action === "CHECK_NOW") {
      checkAndNotify({ notify: false }).then(sendResponse);
      return true;
    }
  }
);
