"use strict";

/*
 * ISBN Research
 *
 * V2
 *
 * - Scanner code-barres en direct
 * - Photo du code-barres
 * - OCR de secours
 * - Validation ISBN-10 / ISBN-13
 * - Conversion ISBN-10 -> ISBN-13
 * - Recherche Vinted
 * - Historique local
 */


// ==========================================
// DOM
// ==========================================

const readerElement =
  document.getElementById("reader");

const placeholderElement =
  document.getElementById("scanner-placeholder");

const startButton =
  document.getElementById("start-scanner");

const photoButton =
  document.getElementById("photo-button");

const stopButton =
  document.getElementById("stop-scanner");

const photoInput =
  document.getElementById("photo-input");

const analysisCard =
  document.getElementById("analysis-card");

const analysisTitle =
  document.getElementById("analysis-title");

const analysisText =
  document.getElementById("analysis-text");

const isbnInput =
  document.getElementById("isbn");

const clearIsbnButton =
  document.getElementById("clear-isbn");

const statusElement =
  document.getElementById("isbn-status");

const vintedButton =
  document.getElementById("vinted-search");

const historyElement =
  document.getElementById("history");

const clearHistoryButton =
  document.getElementById("clear-history");


// ==========================================
// STATE
// ==========================================

let scanner = null;
let scannerRunning = false;

let scanLocked = false;

const HISTORY_KEY =
  "isbn-research-history";


// ==========================================
// ISBN
// ==========================================

function cleanISBN(value) {

  return value
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
}


function isValidISBN10(isbn) {

  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 10; i++) {

    const value =
      isbn[i] === "X"
        ? 10
        : Number(isbn[i]);

    sum += value * (10 - i);
  }

  return sum % 11 === 0;
}


function isValidISBN13(isbn) {

  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 12; i++) {

    const digit =
      Number(isbn[i]);

    sum +=
      i % 2 === 0
        ? digit
        : digit * 3;
  }

  const checkDigit =
    (10 - (sum % 10)) % 10;

  return (
    checkDigit ===
    Number(isbn[12])
  );
}


function isbn10To13(isbn10) {

  const base =
    "978" +
    isbn10.substring(0, 9);

  let sum = 0;

  for (let i = 0; i < 12; i++) {

    const digit =
      Number(base[i]);

    sum +=
      i % 2 === 0
        ? digit
        : digit * 3;
  }

  const checkDigit =
    (10 - (sum % 10)) % 10;

  return base + checkDigit;
}


function normalizeISBN(value) {

  const isbn =
    cleanISBN(value);

  if (isValidISBN13(isbn)) {
    return isbn;
  }

  if (isValidISBN10(isbn)) {
    return isbn10To13(isbn);
  }

  return null;
}


// ==========================================
// RESULTAT ISBN
// ==========================================

function setISBN(value) {

  const isbn =
    normalizeISBN(value);

  if (!isbn) {

    statusElement.textContent =
      "ISBN invalide ou incomplet";

    statusElement.className =
      "status invalid";

    vintedButton.disabled = true;

    return false;
  }

  isbnInput.value = isbn;

  statusElement.textContent =
    `ISBN valide : ${isbn}`;

  statusElement.className =
    "status valid";

  vintedButton.disabled = false;

  return true;
}


function updateISBNStatus() {

  if (!isbnInput.value.trim()) {

    statusElement.textContent = "";

    statusElement.className =
      "status";

    vintedButton.disabled = true;

    return;
  }

  setISBN(isbnInput.value);
}


// ==========================================
// VINTED
// ==========================================

function searchVinted(isbn) {

  const normalizedISBN =
    normalizeISBN(isbn);

  if (!normalizedISBN) {
    return;
  }

  addToHistory(normalizedISBN);

  const url =
    "https://www.vinted.fr/catalog?search_text=" +
    encodeURIComponent(normalizedISBN);

  window.open(url, "_blank");
}


// ==========================================
// HISTORIQUE
// ==========================================

function getHistory() {

  try {

    return JSON.parse(
      localStorage.getItem(HISTORY_KEY)
    ) || [];

  } catch {

    return [];
  }
}


function saveHistory(history) {

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history)
  );
}


function addToHistory(isbn) {

  let history =
    getHistory();

  history =
    history.filter(
      item => item !== isbn
    );

  history.unshift(isbn);

  history =
    history.slice(0, 10);

  saveHistory(history);

  renderHistory();
}


function renderHistory() {

  const history =
    getHistory();

  if (!history.length) {

    historyElement.innerHTML =
      `<p class="empty-history">
        Aucun scan pour le moment.
      </p>`;

    return;
  }

  historyElement.innerHTML = "";

  history.forEach(isbn => {

    const item =
      document.createElement("div");

    item.className =
      "history-item";


    const isbnText =
      document.createElement("span");

    isbnText.className =
      "history-isbn";

    isbnText.textContent =
      isbn;


    const searchButton =
      document.createElement("button");

    searchButton.className =
      "history-search";

    searchButton.textContent =
      "Vinted";

    searchButton.addEventListener(
      "click",
      () => searchVinted(isbn)
    );


    item.appendChild(isbnText);

    item.appendChild(searchButton);

    historyElement.appendChild(item);
  });
}


// ==========================================
// SCANNER CAMERA
// ==========================================

async function startScanner() {

  if (scannerRunning) {
    return;
  }

  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {

    alert(
      "Le scanner n'est pas encore chargé. " +
      "Vérifie ta connexion Internet."
    );

    return;
  }

  scanLocked = false;

  scanner =
    new Html5Qrcode("reader");

  readerElement.style.display =
    "block";

  placeholderElement.classList.add(
    "hidden"
  );

  startButton.classList.add(
    "hidden"
  );

  photoButton.classList.add(
    "hidden"
  );

  stopButton.classList.remove(
    "hidden"
  );

  scannerRunning = true;


  const config = {

    fps: 10,

    qrbox: {
      width: 300,
      height: 140
    },

    aspectRatio: 1.777778,

    formatsToSupport: [

      Html5QrcodeSupportedFormats.EAN_13,

      Html5QrcodeSupportedFormats.EAN_8,

      Html5QrcodeSupportedFormats.UPC_A,

      Html5QrcodeSupportedFormats.UPC_E,

      Html5QrcodeSupportedFormats.CODE_128

    ]
  };


  try {

    await scanner.start(

      {
        facingMode:
          "environment"
      },

      config,

      onScanSuccess,

      onScanFailure
    );

  } catch (error) {

    console.error(error);

    await stopScanner();

    alert(
      "Impossible d'accéder à la caméra."
    );
  }
}


async function stopScanner() {

  if (
    scanner &&
    scannerRunning
  ) {

    try {
      await scanner.stop();
    } catch (error) {
      console.warn(error);
    }

    try {
      scanner.clear();
    } catch (error) {
      console.warn(error);
    }
  }

  scanner = null;

  scannerRunning = false;

  readerElement.style.display =
    "none";

  placeholderElement.classList.remove(
    "hidden"
  );

  startButton.classList.remove(
    "hidden"
  );

  photoButton.classList.remove(
    "hidden"
  );

  stopButton.classList.add(
    "hidden"
  );
}


function onScanSuccess(decodedText) {

  if (scanLocked) {
    return;
  }

  scanLocked = true;

  console.log(
    "Code détecté :",
    decodedText
  );

  const isbn =
    normalizeISBN(decodedText);

  if (!isbn) {

    scanLocked = false;

    statusElement.textContent =
      "Code détecté mais ISBN invalide.";

    statusElement.className =
      "status invalid";

    return;
  }

  isbnInput.value =
    isbn;

  updateISBNStatus();

  stopScanner();

  /*
   * On ne lance PAS automatiquement Vinted.
   *
   * L'utilisateur voit maintenant
   * l'ISBN et appuie sur le bouton.
   */
}


function onScanFailure() {
  // Normal :
  // la caméra essaie constamment
  // de trouver un code.
}


// ==========================================
// PHOTO
// ==========================================

photoButton.addEventListener(
  "click",
  () => {

    photoInput.value = "";

    photoInput.click();
  }
);


photoInput.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    await analyzePhoto(file);
  }
);


// ==========================================
// ANALYSE PHOTO
// ==========================================

async function analyzePhoto(file) {

  showAnalysis(
    "Analyse de la photo...",
    "Recherche du code-barres."
  );


  /*
   * Première tentative :
   * utiliser le navigateur pour lire
   * directement l'image.
   */

  const barcodeResult =
    await tryBarcodeFromImage(file);


  if (barcodeResult) {

    const isbn =
      normalizeISBN(
        barcodeResult
      );

    if (isbn) {

      hideAnalysis();

      setISBN(isbn);

      return;
    }
  }


  /*
   * Deuxième tentative :
   * OCR.
   */

  showAnalysis(
    "Lecture des chiffres...",
    "Je cherche un ISBN imprimé sur la photo."
  );


  try {

    const result =
      await Tesseract.recognize(
        file,
        "eng",
        {
          logger: message => {

            if (
              message.status ===
              "recognizing text"
            ) {

              const percent =
                Math.round(
                  (message.progress || 0)
                  * 100
                );

              analysisText.textContent =
                `Lecture du texte... ${percent}%`;
            }
          }
        }
      );


    const text =
      result.data.text;

    console.log(
      "OCR :",
      text
    );


    const isbn =
      findISBNInText(text);


    hideAnalysis();


    if (isbn) {

      setISBN(isbn);

      return;
    }


    statusElement.textContent =
      "Aucun ISBN détecté. Essaie une photo plus rapprochée du code-barres.";

    statusElement.className =
      "status invalid";


  } catch (error) {

    console.error(error);

    hideAnalysis();

    statusElement.textContent =
      "Impossible d'analyser la photo.";

    statusElement.className =
      "status invalid";
  }
}


// ==========================================
// BARCODE DANS IMAGE
// ==========================================

async function tryBarcodeFromImage(file) {

  /*
   * On utilise une instance temporaire
   * de Html5Qrcode pour tenter de lire
   * le code directement dans la photo.
   */

  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {
    return null;
  }


  const temporaryId =
    "temporary-image-reader";


  const temporary =
    document.createElement("div");

  temporary.id =
    temporaryId;

  temporary.style.display =
    "none";

  document.body.appendChild(
    temporary
  );


  const scanner =
    new Html5Qrcode(
      temporaryId
    );


  try {

    const result =
      await scanner.scanFile(
        file,
        false
      );

    await scanner.clear();

    temporary.remove();

    return result;

  } catch (error) {

    try {
      await scanner.clear();
    } catch {}

    temporary.remove();

    return null;
  }
}


// ==========================================
// OCR
// ==========================================

function findISBNInText(text) {

  /*
   * On nettoie légèrement le texte OCR.
   */

  const normalized =
    text
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1");


  /*
   * Cherche d'abord des groupes
   * ressemblant à des ISBN-13.
   */

  const numbers =
    normalized.match(
      /(?:97[89][\s-]?)?(?:\d[\s-]?){9,13}/g
    ) || [];


  for (const candidate of numbers) {

    const isbn =
      normalizeISBN(candidate);

    if (isbn) {
      return isbn;
    }
  }


  /*
   * Recherche ISBN-10.
   */

  const isbn10Candidates =
    normalized.match(
      /\b\d[\d\s-]{8,11}[\dXx]\b/g
    ) || [];


  for (
    const candidate
    of isbn10Candidates
  ) {

    const isbn =
      normalizeISBN(candidate);

    if (isbn) {
      return isbn;
    }
  }


  return null;
}


// ==========================================
// ANALYSE UI
// ==========================================

function showAnalysis(
  title,
  text
) {

  analysisTitle.textContent =
    title;

  analysisText.textContent =
    text;

  analysisCard.classList.remove(
    "hidden"
  );
}


function hideAnalysis() {

  analysisCard.classList.add(
    "hidden"
  );
}


// ==========================================
// EVENTS
// ==========================================

startButton.addEventListener(
  "click",
  startScanner
);


stopButton.addEventListener(
  "click",
  stopScanner
);


isbnInput.addEventListener(
  "input",
  () => {

    const cleaned =
      isbnInput.value.replace(
        /[^0-9Xx-]/g,
        ""
      );

    isbnInput.value =
      cleaned;

    updateISBNStatus();
  }
);


isbnInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      const isbn =
        normalizeISBN(
          isbnInput.value
        );

      if (isbn) {
        searchVinted(isbn);
      }
    }
  }
);


vintedButton.addEventListener(
  "click",
  () => {

    const isbn =
      normalizeISBN(
        isbnInput.value
      );

    if (isbn) {
      searchVinted(isbn);
    }
  }
);


clearIsbnButton.addEventListener(
  "click",
  () => {

    isbnInput.value = "";

    updateISBNStatus();

    isbnInput.focus();
  }
);


clearHistoryButton.addEventListener(
  "click",
  () => {

    localStorage.removeItem(
      HISTORY_KEY
    );

    renderHistory();
  }
);


// ==========================================
// INIT
// ==========================================

renderHistory();

updateISBNStatus();
