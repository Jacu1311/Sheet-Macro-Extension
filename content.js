let snippets = {};

// Parser de formato enriquecido plano
function parseRichTextToPlain(text) {
  return text
    .replace(/\*(.*?)\*/g, (_, bold) => bold.toUpperCase()) // *negrita* → NEGRITA
    .replace(/_(.*?)_/g, (_, italic) => italic)              // _cursiva_ → cursiva
    .replace(/^[-*] /gm, '• ')                               // - item → • item
    .replace(/\\n/g, '\n');                                  // \n literal → salto de línea
}

// Detecta trigger y reemplaza texto
function processElement(element) {
  let original = typeof element.value === 'string' ? element.value : element.textContent;
  if (typeof original !== 'string') return;

  for (let triggerKey in snippets) {
    if (original.includes(triggerKey)) {
      const replacement = parseRichTextToPlain(snippets[triggerKey]);

      // Reemplazar salto de línea en el valor del elemento
      const updated = replacement.replace(/\n/g, () => {
        if (typeof element.value === 'string') {
          // Inserta un salto de línea dentro de un textarea o input
          const before = element.value.slice(0, element.selectionStart);
          const after = element.value.slice(element.selectionStart);
          element.value = before + '\n' + after;
        } else {
          // Para elementos contenteditable, agregamos un salto de línea al texto
          element.textContent = element.textContent + '\n';
        }
      });

      if (typeof element.value === 'string') {
        element.value = updated;
      } else if (isContentEditable(element)) {
        element.textContent = updated;
      }
    }
  }
}

function isContentEditable(element) {
  return element.isContentEditable || element.getAttribute("contenteditable") === "true";
}

// Crea modal de selección de snippets
function createSnippetModal(snippets, targetElement) {
  if (document.getElementById("snippet-modal")) return;

  const modal = document.createElement("div");
  modal.id = "snippet-modal";
  modal.style = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    color: black;
    padding: 16px;
    border: 1px solid #ccc;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    z-index: 10000;
    max-height: 300px;
    overflow-y: auto;
    min-width: 300px;
    font-family: sans-serif
  `;

  // Crear botón de cierre
  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #666;
    padding: 0;
  `;
  closeButton.addEventListener("mouseover", () => {
    closeButton.style.backgroundColor = "#f0f0f0";
  });
  closeButton.addEventListener("mouseout", () => {
    closeButton.style.backgroundColor = "transparent";
  });
  closeButton.addEventListener("click", () => {
    modal.remove();
  });

  modal.appendChild(closeButton);

  const title = document.createElement("div");
  title.textContent = "Selecciona un snippet:";
  title.style = "font-weight: bold; margin-bottom: 8px;";
  modal.appendChild(title);

  for (let key in snippets) {
    const item = document.createElement("div");
    item.textContent = `${key} → ${parseRichTextToPlain(snippets[key]).slice(0, 50)}...`;
    item.style = "padding: 6px; cursor: pointer; border-bottom: 1px solid #eee;";
    item.addEventListener("click", () => {
      insertSnippetAtCursor(targetElement, parseRichTextToPlain(snippets[key]));
      modal.remove();
    });
    modal.appendChild(item);
  }

  document.body.appendChild(modal);
}

// Inserta snippet reemplazando '._'
function insertSnippetAtCursor(element, text) {
  const trigger = '._';
  let fullText = typeof element.value === 'string' ? element.value : element.textContent;
  const caretPos = element.selectionStart || fullText.length;

  const before = fullText.slice(0, caretPos - trigger.length);
  const after = fullText.slice(caretPos);

  const newValue = before + text + after;

  if (typeof element.value === 'string') {
    element.value = newValue;
  } else if (isContentEditable(element)) {
    element.textContent = newValue;
  }
}

// Observa y enlaza listeners a todos los campos
function attachListeners() {
  const handleInput = (element) => {
    element.addEventListener("input", () => processElement(element));
    element.addEventListener("keydown", (e) => {
      // Activa modal con combinación ._
      const currentText = typeof element.value === 'string' ? element.value : element.textContent;
      if (e.key === "_" && currentText.endsWith(".")) {
        e.preventDefault();
        createSnippetModal(snippets, element);
      }
    });
  };

  const observer = new MutationObserver(() => {
    const inputs = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
    inputs.forEach((el) => {
      if (!el.dataset.snippetBound) {
        el.dataset.snippetBound = true;
        handleInput(el);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Ejecuta inmediatamente para los ya existentes
  const existing = document.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
  existing.forEach((el) => {
    if (!el.dataset.snippetBound) {
      el.dataset.snippetBound = true;
      handleInput(el);
    }
  });
}

// Función para procesar el CSV correctamente, manejando comas y saltos de línea
function processCSV(csvText) {
  const lines = csvText.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (row && row.length >= 2) {
      const key = row[0].replace(/^"|"$/g, "").trim();
      const snippet = row[1].replace(/^"|"$/g, "").trim();

      // Si el texto tiene saltos de línea, conservarlos
      snippets[key] = snippet.replace(/\\n/g, '\n');
    }
  }
}

// Carga los snippets desde Google Sheets (CSV)
chrome.storage.sync.get(['sheetUrl'], (result) => {
  if (!result.sheetUrl) {
    console.warn("No se encontró una URL de hoja configurada.");
    return;
  }

  const match = result.sheetUrl.match(/\/d\/([^\/]+)\//);
  if (!match) return;

  const spreadsheetId = match[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;

  fetch(csvUrl)
    .then((res) => res.text())
    .then((csvText) => {
      processCSV(csvText);  // Procesa el CSV y carga los snippets
      console.log("Snippets cargados:", snippets);
      attachListeners();
    })
    .catch((err) => console.error("Error al cargar CSV:", err));
});
