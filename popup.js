// popup.js: Handles Run Extractor and Settings link

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("runBtn").onclick = async function () {
    document.getElementById("status").innerText = "Extraction started!";
    document.getElementById("status").innerText = "Running...";
    const downloadChecked = document.getElementById(
      "downloadTextCheckbox"
    ).checked;
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (downloadChecked) {
      // Get page text and attachment links from the content script
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          function getPageText() {
            return document.body.innerText || "";
          }
          function getAttachmentLinks() {
            return Array.from(
              document.querySelectorAll('a[href$=".pdf"], a[href$=".docx"]')
            ).map((a) => a.href);
          }
          return {
            pageText: getPageText(),
            attachments: getAttachmentLinks(),
            pageUrl: window.location.href,
          };
        },
      });
      // Combine text as in background.js
      const fullText = [result.pageText, ...(result.attachments || [])].join(
        "\n\n"
      );
      // Download as txt file
      const blob = new Blob([fullText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "solicitation_text.txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
    // Call ezgovRunExtraction in the content script of the active tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.ezgovRunExtraction && window.ezgovRunExtraction();
      },
    });
    document.getElementById("status").innerText = "Extraction started!";
    setTimeout(() => window.close(), 1000);
  };

  document.getElementById("settingsLink").onclick = function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };
});
