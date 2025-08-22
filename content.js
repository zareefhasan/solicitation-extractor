// Content script: Extracts page text and attachment text, sends to background
// (Attachment extraction and OpenAI call logic will be added next)

// Inject sidebar panel if not present
function injectSidebar(callback) {
  if (document.getElementById("ezgovSidebar")) {
    if (callback) callback(document.getElementById("ezgovSidebar"));
    return;
  }
  const sidebar = document.createElement("div");
  sidebar.id = "ezgovSidebar";
  sidebar.style.position = "fixed";
  sidebar.style.top = "50px";
  sidebar.style.right = "0";
  sidebar.style.width = "420px";
  sidebar.style.height = "80vh";
  sidebar.style.background = "#fff";
  sidebar.style.borderLeft = "2px solid #d1d5db";
  sidebar.style.zIndex = "999999";
  sidebar.style.boxShadow = "-2px 0 24px rgba(0,0,0,0.10)";
  sidebar.style.overflowY = "auto";
  sidebar.style.fontFamily = "Segoe UI, Arial, sans-serif";
  sidebar.style.padding = "0";
  sidebar.style.resize = "both";
  sidebar.style.minWidth = "320px";
  sidebar.style.minHeight = "220px";
  sidebar.style.borderTopLeftRadius = "14px";
  sidebar.style.borderBottomLeftRadius = "14px";
  sidebar.innerHTML = `
    <div id="ezgovSidebarHeader" style="cursor:move;position:absolute;top:0;left:0;width:100%;height:48px;background:#f8f9fa;border-bottom:1px solid #e3e7ef;z-index:1;border-top-left-radius:14px;">
      <span style="font-weight:700;line-height:48px;margin-left:18px;font-size:1.2em;color:#2356c7;">Solicitation Info</span>
      <span id="ezgovSidebarClose" style="float:right;cursor:pointer;font-size:22px;margin:12px 18px 0 0;color:#888;transition:color 0.2s;">&times;</span>
    </div>
    <div id="ezgovSidebarResult" style="margin-top:60px;padding:0 22px 0 22px;min-height:60px;font-size:1em;"></div>
    <style>
      #ezgovSidebarClose:hover { color:#2356c7; }
      #ezgovSidebarResult .field { margin-bottom: 12px; display: flex; align-items: center; }
      #ezgovSidebarResult .label { font-weight: 600; color: #2356c7; min-width: 160px; }
      #ezgovSidebarResult .value { background: #f4f6fb; padding: 6px 8px; border-radius: 5px; display: inline-block; margin-right: 8px; }
      #ezgovSidebarResult .error { color: #c72c2c; background: #ffeaea; border-radius: 5px; padding: 6px 8px; }
      .ezgovCopyBtn { background: none; border: none; color: #4f8cff; font-size: 1.1em; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s; }
      .ezgovCopyBtn:hover { background: #eaf1ff; color: #2356c7; }
    </style>
  `;
  document.body.appendChild(sidebar);
  // Drag logic
  let isDragging = false,
    startX,
    startY,
    startLeft,
    startTop;
  const header = sidebar.querySelector("#ezgovSidebarHeader");
  header.onmousedown = function (e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(sidebar.style.right) || 0;
    startTop = parseInt(sidebar.style.top) || 0;
    document.body.style.userSelect = "none";
  };
  document.onmousemove = function (e) {
    if (!isDragging) return;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    sidebar.style.right = startLeft - dx + "px";
    sidebar.style.top = startTop + dy + "px";
  };
  document.onmouseup = function () {
    isDragging = false;
    document.body.style.userSelect = "";
  };
  // Close button
  sidebar.querySelector("#ezgovSidebarClose").onclick = function () {
    sidebar.remove();
  };
  // No Copy All button; individual copy buttons will be rendered per value
  if (callback) callback(sidebar);
}

// Listen for SHOW_SIDEBAR messages from background

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SHOW_SIDEBAR") {
    injectSidebar((sidebar) => {
      showSidebarResult(msg.data);
    });
  }
});

function showSidebarResult(data) {
  const el = document.getElementById("ezgovSidebarResult");
  if (!el) return;
  if (data && data.error) {
    el.innerHTML = `<div class='error'>${data.error}</div>`;
    return;
  }
  let obj;
  try {
    obj = typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    // Show raw data for debugging
    el.innerHTML = `<div class='error'>Invalid JSON from OpenAI.<br><pre style='white-space:pre-wrap;'>${
      typeof data === "string" ? data : JSON.stringify(data)
    }</pre></div>`;
    return;
  }
  if (!obj || Object.keys(obj).length === 0) {
    el.innerHTML = "Extracting...";
    return;
  }
  el.innerHTML = Object.entries(obj)
    .map(([k, v], idx) => {
      const displayValue =
        v === null ||
        v === undefined ||
        v === "null" ||
        v === "undefined" ||
        v === ""
          ? "tbd"
          : v;
      return `<div class='field'><span class='label'>${k}:</span> <span class='value'>${displayValue}</span><button class='ezgovCopyBtn' title='Copy value' data-copy-idx='${idx}'>📋</button></div>`;
    })
    .join("");
  // Add copy event listeners
  Array.from(el.querySelectorAll(".ezgovCopyBtn")).forEach((btn, idx) => {
    btn.onclick = function () {
      const rawValue = Object.values(obj)[idx];
      const value =
        rawValue === null ||
        rawValue === undefined ||
        rawValue === "null" ||
        rawValue === "undefined" ||
        rawValue === ""
          ? "tbd"
          : rawValue;
      navigator.clipboard.writeText(value);
      btn.innerText = "✔";
      setTimeout(() => {
        btn.innerText = "📋";
      }, 1000);
    };
  });
}

// Extraction trigger (for popup or auto)
window.ezgovRunExtraction = function () {
  // Show sidebar immediately with loading message
  injectSidebar((sidebar) => {
    showSidebarResult({});
    const el = sidebar.querySelector("#ezgovSidebarResult");
    if (el) el.innerText = "Extracting...";
  });
  function getPageText() {
    return document.body.innerText || "";
  }
  function getAttachmentLinks() {
    return Array.from(
      document.querySelectorAll('a[href$=".pdf"], a[href$=".docx"]')
    ).map((a) => a.href);
  }
  chrome.runtime.sendMessage({
    type: "EXTRACT_SOLICITATION",
    pageText: getPageText(),
    attachments: getAttachmentLinks(),
    pageUrl: window.location.href,
  });
};
