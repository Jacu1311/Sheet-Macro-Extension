document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("sheetUrl");
  const status = document.getElementById("status");

  chrome.storage.sync.get(["sheetUrl"], (result) => {
    console.log("URL guardada:", result.sheetUrl);
    if (result.sheetUrl) {
      input.value = result.sheetUrl;
    }
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    const url = input.value.trim();
    chrome.storage.sync.set({ sheetUrl: url }, () => {
      status.textContent = "Guardado!";
      setTimeout(() => (status.textContent = ""), 2000);
    });
  });
});
