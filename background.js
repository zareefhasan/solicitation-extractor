// Background script for the Solicitation Extractor Chrome extension
// Handles OpenAI API calls, attachment text extraction, and communication with the sidebar

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  // Only handle EXTRACT_SOLICITATION messages
  if (msg.type === "EXTRACT_SOLICITATION") {
    const { pageText, attachments, pageUrl } = msg;
    let attachmentTexts = [];
    // Extract text from each attachment (PDF/DOCX)
    for (const url of attachments) {
      try {
        const text = await extractAttachmentText(url);
        attachmentTexts.push(text);
      } catch (e) {
        // If extraction fails, push empty string
        attachmentTexts.push("");
      }
    }
    // Combine main page text and all attachment texts
    const fullText = [pageText, ...attachmentTexts].join("\n\n");
    // Retrieve OpenAI API key and model from Chrome storage
    chrome.storage.sync.get(["openaiKey", "openaiModel"], async (data) => {
      const openaiKey = data.openaiKey || "";
      const openaiModel = data.openaiModel || "gpt-3.5-turbo";
      if (!openaiKey) {
        // If no API key, show error in sidebar
        sendToSidebar({ error: "OpenAI API key not set." });
        return;
      }
      try {
        // Call OpenAI API with the combined text
        const result = await callOpenAI(fullText, openaiKey, openaiModel);
        // Log and send the result to the sidebar
        console.log("OpenAI API result:", result);
        sendToSidebar(result);
      } catch (err) {
        // On error, log and show error in sidebar
        console.error("OpenAI API error:", err);
        sendToSidebar({
          error:
            "OpenAI API error: " + (err && err.message ? err.message : err),
        });
      }
    });
    // Respond immediately to indicate processing
    sendResponse({ status: "processing" });
    return true; // Keep message channel open for async response
  }
});

// Send data to the sidebar in the active tab
async function sendToSidebar(data) {
  try {
    const tabId = await getCurrentTabId();
    if (!tabId) {
      console.warn("No valid tab to send sidebar message.");
      return;
    }
    // Always send data as a JSON string for reliable parsing in the sidebar
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_SIDEBAR",
      data: payload,
    });
  } catch (e) {
    console.warn("Could not send sidebar message:", e);
  }
}

// Extract text from a given attachment URL (PDF or DOCX)
// Uses PDF.js for PDFs and Mammoth.js for DOCX files, injected into the page context
async function extractAttachmentText(url) {
  // Determine file type
  const isPdf = url.toLowerCase().endsWith(".pdf");
  const isDocx = url.toLowerCase().endsWith(".docx");
  // Fetch file as ArrayBuffer
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  // Get current tab and validate
  const tabId = await getCurrentTabId();
  if (!tabId) {
    console.warn("No valid tab for script injection.");
    return "";
  }
  try {
    // Inject libloader.js to ensure PDF/DOCX libraries are available
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["libloader.js"],
    });
  } catch (e) {
    console.warn("Could not inject libloader.js:", e);
    return "";
  }
  try {
    // Extract text in the page context using the appropriate library
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (fileBytes, isPdf, isDocx) => {
        if (isPdf) {
          // Use PDF.js to extract text from PDF
          await window._ezgovLibs.loadPdfJs();
          const pdf = await window.pdfjsLib.getDocument({ data: fileBytes })
            .promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item) => item.str).join(" ") + "\n";
          }
          return text;
        } else if (isDocx) {
          // Use Mammoth.js to extract text from DOCX
          await window._ezgovLibs.loadMammothJs();
          const { value } = await window.mammoth.extractRawText({
            arrayBuffer: fileBytes,
          });
          return value;
        }
        // Unsupported file type
        return "";
      },
      args: [arrayBuffer, isPdf, isDocx],
    });
    return result || "";
  } catch (e) {
    console.warn("Could not extract attachment text:", e);
    return "";
  }
}

// Get the ID of the current active tab, or null if not available/allowed
async function getCurrentTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs.length) return null;
  const tab = tabs[0];
  // Don't inject into restricted/special pages
  if (
    !tab.id ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("edge://")
  ) {
    return null;
  }
  return tab.id;
}

// Call the OpenAI API with the combined solicitation text and return the extracted fields
// The prompt instructs the model to extract all required fields in strict JSON format
async function callOpenAI(text, key, model) {
  const prompt = `You are an information extraction assistant. Extract the following fields from the solicitation text. Return the result in strict JSON format only, without any explanation or extra text.

Fields to extract:

SOLICITATION NO

PLACE OF PERFORMANCE: extract the place of performance or site address or location from the project from the Text

PERIOD OF PERFORMANCE: extract the period of performance of the project from the Text

VALUE OF THE PROJECT: extract the range value of the project from the Text

SITE VISIT DATE AND TIME

SCOPE OF WORK

IMPORTANT DATES: Extract all key dates with their full sentences (such as proposal due date, bid opening date, questions due date, award date, response due date etc.) even if they are in a list, table, or section.

Rules:

Only return the exact text from the solicitation, do not summarize.

All fields should be in the format "field name: value". Only return strings as values. Not any objects or arrays. If multiple values are present, return them as a comma-separated string.

If a field is not found, return "tbd".

Keep formatting exactly as in the source text.

For SCOPE OF WORK, return only the specific tasks or services the contractor will perform, written in a human-friendly, 50 to 100 words (no boilerplate or unrelated text).

Text:${text}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data;
}
