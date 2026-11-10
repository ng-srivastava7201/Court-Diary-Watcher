
const listElement = document.getElementById("list");
const statusElement = document.getElementById("status");
const errorElement = document.getElementById("error");
const messageElement = document.getElementById("msg");

const connectButton = document.getElementById("connect");
const checkButton = document.getElementById("check");
const copyButton = document.getElementById("copy");
const closeButton = document.getElementById("close");

let pending = [];

function formatDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split("-");
    return `${day}/${month}/${year}`;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function makeReminderText() {
  if (pending.length === 0) {
    return "No stale legal-case entries were found.";
  }

  return (
    "Court diary entries not updated after the hearing:\n\n" +
    pending.map((item, index) => {
      const lines = [
        `${index + 1}. ${item.title}`,
        `   Hearing: ${formatDate(item.date)}`
      ];

      if (item.link) {
        lines.push(`   Calendar: ${item.link}`);
      }

      return lines.join("\n");
    }).join("\n\n")
  );
}

function render() {
  listElement.textContent = makeReminderText();

  if (pending.length > 0) {
    statusElement.textContent =
      `${pending.length} reminder(s) found.`;
  } else {
    statusElement.textContent =
      "No pending reminders.";
  }
}

async function refreshFromStorage() {
  const result = await chrome.storage.local.get([
    "pending",
    "lastChecked",
    "lastError"
  ]);

  pending = result.pending || [];
  render();

  if (result.lastChecked) {
    statusElement.textContent +=
      ` Last checked: ${
        new Date(result.lastChecked).toLocaleString()
      }.`;
  }

  if (result.lastError) {
    errorElement.textContent =
      `Last check error: ${result.lastError}`;
  } else {
    errorElement.textContent = "";
  }
}

function showMessage(message) {
  messageElement.textContent = message;
}

async function requestCheck() {
  errorElement.textContent = "";
  showMessage("Checking Google Calendar...");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "CHECK_NOW"
    });

    await refreshFromStorage();

    if (response?.ok) {
      showMessage("Calendar check completed.");
    } else {
      showMessage("Check requested. See any error above.");
    }
  } catch (error) {
    errorElement.textContent =
      error.message || "Could not contact the background service.";
    showMessage("");
  }
}

connectButton.addEventListener("click", () => {
  errorElement.textContent = "";
  showMessage("Waiting for Google authorization...");

  chrome.identity.getAuthToken(
    { interactive: true },
    async (token) => {
      if (chrome.runtime.lastError || !token) {
        errorElement.textContent =
          chrome.runtime.lastError?.message ||
          "Google authorization failed.";

        showMessage("");
        return;
      }

      showMessage("Google Calendar connected.");

      // service can now use non-interactive authentication.
      await requestCheck();
    }
  );
});

checkButton.addEventListener("click", requestCheck);

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(makeReminderText());
    showMessage("Reminder list copied!");
  } catch (error) {
    errorElement.textContent =
      "Copy failed. Please try again.";
    showMessage("");
  }
});

closeButton.addEventListener("click", () => {
  window.close();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.pending) {
    pending = changes.pending.newValue || [];
    render();
  }

  if (areaName === "local" && changes.lastError) {
    errorElement.textContent =
      changes.lastError.newValue
        ? `Last check error: ${changes.lastError.newValue}`
        : "";
  }

  if (areaName === "local" && changes.lastChecked) {
    refreshFromStorage();
  }
});

refreshFromStorage();
