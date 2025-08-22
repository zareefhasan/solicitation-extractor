// For injected sidebar iframe usage
window.ezgovShowResult = function (data) {
  const el = document.getElementById("ezgovSidebarResult");
  if (data.error) {
    el.innerHTML = `<div class='error'>${data.error}</div>`;
    return;
  }
  let obj;
  try {
    obj = typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    // If parsing fails, display the raw data as a string for debugging
    el.innerHTML = `<div class='error'>Invalid JSON from OpenAI. Raw data:</div><pre style="white-space:pre-wrap;word-break:break-all;">${
      typeof data === "string" ? data : JSON.stringify(data, null, 2)
    }</pre>`;
    return;
  }
  function formatValue(val) {
    if (val === "Not specified") return "tbd";
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      if (Array.isArray(val)) {
        return val.map(formatValue).join(", ");
      } else {
        const entries = Object.entries(val);
        if (
          entries.length === 1 &&
          (typeof entries[0][1] === "string" ||
            typeof entries[0][1] === "number")
        ) {
          return `${entries[0][0]}: ${formatValue(entries[0][1])}`;
        }
        return entries
          .map(([key, value]) => `${key}: ${formatValue(value)}`)
          .join("<br>");
      }
    }
    return String(val);
  }
  el.innerHTML = Object.entries(obj)
    .map(([k, v]) => {
      const displayValue = formatValue(v);
      return `<div class='field'><span class='label'>${k}:</span> <span class='value' onclick='window.ezgovCopyField(this)'>${displayValue}</span></div>`;
    })
    .join("");
};

window.ezgovCopyField = function (el) {
  navigator.clipboard.writeText(el.innerText);
};

window.ezgovCopyAll = function () {
  const el = document.getElementById("ezgovSidebarResult");
  navigator.clipboard.writeText(el.innerText);
};

document.getElementById("ezgovSidebarClose").onclick = function () {
  // Remove the sidebar iframe from parent page
  if (window.parent !== window) {
    const iframes =
      window.parent.document.querySelectorAll("#ezgovSidebarFrame");
    iframes.forEach((f) => f.remove());
  } else {
    document.getElementById("ezgovSidebar").remove();
  }
};
