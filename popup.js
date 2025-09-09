document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("sheetUrl");
  const status = document.getElementById("status");
  const saveBtn = document.getElementById("saveBtn");

  // Load existing URL
  chrome.storage.sync.get(["sheetUrl"], (result) => {
    if (result.sheetUrl) {
      input.value = result.sheetUrl;
    }
  });

  // Validate Google Sheets URL
  function isValidGoogleSheetsUrl(url) {
    return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(url);
  }

  // Enable/disable save button based on URL validity
  input.addEventListener("input", () => {
    const url = input.value.trim();
    saveBtn.disabled = !isValidGoogleSheetsUrl(url);
    status.textContent = "";
  });

  // Save URL handler
  saveBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    
    if (!isValidGoogleSheetsUrl(url)) {
      status.textContent = "URL inválida. Debe ser una URL de Google Sheets.";
      status.style.color = "red";
      return;
    }

    try {
      await chrome.storage.sync.set({ sheetUrl: url });
      // Clear cache to force reload of snippets
      await chrome.storage.local.remove(['snippetsCache', 'snippetsCacheTime']);
      
      status.textContent = "¡Guardado exitosamente!";
      status.style.color = "green";
      setTimeout(() => {
        status.textContent = "";
      }, 2000);
    } catch (error) {
      status.textContent = "Error al guardar: " + error.message;
      status.style.color = "red";
    }
  });
});
