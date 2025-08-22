// Options page: Save/retrieve OpenAI API key and model

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.sync.get(["openaiKey", "openaiModel"], (data) => {
    document.getElementById("apiKey").value = data.openaiKey || "";
    const modelSelect = document.getElementById("model");
    const savedModel = data.openaiModel || "gpt-3.5-turbo";
    if (
      Array.from(modelSelect.options).some((opt) => opt.value === savedModel)
    ) {
      modelSelect.value = savedModel;
    } else {
      // If custom model, add it to the dropdown
      const opt = document.createElement("option");
      opt.value = savedModel;
      opt.textContent = savedModel;
      modelSelect.appendChild(opt);
      modelSelect.value = savedModel;
    }
  });

  document.querySelector("button").onclick = function () {
    const openaiKey = document.getElementById("apiKey").value;
    const openaiModel = document.getElementById("model").value;
    chrome.storage.sync.set({ openaiKey, openaiModel }, () => {
      const status = document.getElementById("status");
      status.innerText = "Saved!";
      status.style.background = "#d4edda";
      status.style.color = "#155724";
      status.style.padding = "5px 10px";
      status.style.borderRadius = "4px";
      setTimeout(() => {
        status.innerText = "";
        status.style.background = "";
        status.style.color = "";
        status.style.padding = "";
        status.style.borderRadius = "";
      }, 2000);
    });
  };
});
