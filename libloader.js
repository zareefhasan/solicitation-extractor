// pdfjs and mammothjs loader for content script
// This script will be injected by the content script when needed

// Load pdfjs
// Load pdfjs from local libs folder
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve();
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("libs/pdf.min.js");
    script.onload = () => {
      // Set workerSrc for pdfjs
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
          "libs/pdf.worker.min.js"
        );
      }
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load mammothjs
// Load mammothjs from local libs folder
function loadMammothJs() {
  return new Promise((resolve, reject) => {
    if (window.mammoth) return resolve();
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("libs/mammoth.browser.min.js");
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

window._ezgovLibs = { loadPdfJs, loadMammothJs };
