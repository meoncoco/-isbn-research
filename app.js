"use strict";

/*
 * ISBN RESEARCH
 *
 * Scanner V3
 *
 * Stratégie :
 *
 * 1. Caméra native haute résolution
 * 2. BarcodeDetector natif si disponible
 * 3. html5-qrcode sur une capture
 * 4. OCR Tesseract en dernier recours
 *
 */


// =====================================================
// DOM
// =====================================================

const video =
  document.getElementById("camera-video");

const cameraContainer =
  document.getElementById("camera-container");

const placeholder =
  document.getElementById("scanner-placeholder");

const startButton =
  document.getElementById("start-scanner");

const captureButton =
  document.getElementById("capture-button");

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

const clearButton =
  document.getElementById("clear-isbn");

const statusElement =
  document.getElementById("isbn-status");

const vintedButton =
  document.getElementById("vinted-search");

const historyElement =
  document.getElementById("history");

const clearHistoryButton =
  document.getElementById("clear-history");


// =====================================================
// STATE
// =====================================================

let cameraStream = null;

let cameraRunning = false;

let detectionTimer = null;

let processing = false;

let barcodeDetector = null;

const HISTORY_KEY =
  "isbn-research-history";


// =====================================================
// ISBN
// =====================================================

function cleanISBN(value) {

  return String(value || "")
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

  const check =
    (10 - (sum % 10)) % 10;

  return check === Number(isbn[12]);
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

  const check =
    (10 - (sum % 10)) % 10;

  return base + check;
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


// =====================================================
// RESULTAT
// =====================================================

function setISBN(value) {

  const isbn =
    normalizeISBN(value);

  if (!isbn) {

    statusElement.textContent =
      "ISBN invalide ou incomplet";

    statusElement.className =
      "status invalid";

    vintedButton.disabled =
      true;

    return false;
  }

  isbnInput.value =
    isbn;

  statusElement.textContent =
    `ISBN valide : ${isbn}`;

  statusElement.className =
    "status valid";

  vintedButton.disabled =
    false;

  return true;
}


function updateISBNStatus() {

  if (!isbnInput.value.trim()) {

    statusElement.textContent =
      "";

    statusElement.className =
      "status";

    vintedButton.disabled =
      true;

    return;
  }

  setISBN(isbnInput.value);
}


// =====================================================
// VINTED
// =====================================================

function searchVinted(value) {

  const isbn =
    normalizeISBN(value);

  if (!isbn) {
    return;
  }

  addToHistory(isbn);

  const url =
    "https://www.vinted.fr/catalog?search_text=" +
    encodeURIComponent(isbn);

  window.open(
    url,
    "_blank"
  );
}


// =====================================================
// HISTORIQUE
// =====================================================

function getHistory() {

  try {

    return JSON.parse(
      localStorage.getItem(
        HISTORY_KEY
      )
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

  historyElement.innerHTML =
    "";

  history.forEach(isbn => {

    const item =
      document.createElement("div");

    item.className =
      "history-item";


    const text =
      document.createElement("span");

    text.className =
      "history-isbn";

    text.textContent =
      isbn;


    const button =
      document.createElement("button");

    button.className =
      "history-search";

    button.textContent =
      "Vinted";

    button.addEventListener(
      "click",
      () => searchVinted(isbn)
    );


    item.appendChild(text);

    item.appendChild(button);

    historyElement.appendChild(item);
  });
}


// =====================================================
// CAMERA
// =====================================================

async function startCamera() {

  if (cameraRunning) {
    return;
  }

  processing = false;


  try {

    cameraStream =
      await navigator.mediaDevices.getUserMedia({

        audio: false,

        video: {

          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1920
          },

          height: {
            ideal: 1080
          },

          frameRate: {
            ideal: 30
          }
        }
      });


    video.srcObject =
      cameraStream;

    await video.play();


    cameraRunning =
      true;


    cameraContainer.classList.remove(
      "hidden"
    );

    placeholder.classList.add(
      "hidden"
    );

    startButton.classList.add(
      "hidden"
    );

    photoButton.classList.add(
      "hidden"
    );

    captureButton.classList.remove(
      "hidden"
    );

    stopButton.classList.remove(
      "hidden"
    );


    initializeBarcodeDetector();

    /*
     * On tente une détection automatique
     * toutes les 500 ms.
     */

    detectionTimer =
      setInterval(
        detectLiveFrame,
        500
      );


  } catch (error) {

    console.error(
      "Erreur caméra :",
      error
    );

    alert(
      "Impossible d'accéder à la caméra.\n\n" +
      "Vérifie que le navigateur a l'autorisation " +
      "d'utiliser la caméra."
    );
  }
}


function stopCamera() {

  if (detectionTimer) {

    clearInterval(
      detectionTimer
    );

    detectionTimer =
      null;
  }


  if (cameraStream) {

    cameraStream
      .getTracks()
      .forEach(
        track => track.stop()
      );

    cameraStream =
      null;
  }


  video.srcObject =
    null;

  cameraRunning =
    false;

  processing =
    false;


  cameraContainer.classList.add(
    "hidden"
  );

  placeholder.classList.remove(
    "hidden"
  );

  startButton.classList.remove(
    "hidden"
  );

  photoButton.classList.remove(
    "hidden"
  );

  captureButton.classList.add(
    "hidden"
  );

  stopButton.classList.add(
    "hidden"
  );
}


// =====================================================
// BARCODE DETECTOR NATIF
// =====================================================

function initializeBarcodeDetector() {

  if (
    !("BarcodeDetector" in window)
  ) {

    barcodeDetector =
      null;

    console.log(
      "BarcodeDetector non disponible."
    );

    return;
  }


  try {

    barcodeDetector =
      new BarcodeDetector({

        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128"
        ]

      });

  } catch (error) {

    console.warn(
      "BarcodeDetector indisponible :",
      error
    );

    barcodeDetector =
      null;
  }
}


// =====================================================
// DETECTION IMAGE CAMERA
// =====================================================

async function detectLiveFrame() {

  if (
    !cameraRunning ||
    processing ||
    video.readyState < 2
  ) {
    return;
  }


  /*
   * Première méthode :
   * BarcodeDetector natif.
   */

  if (barcodeDetector) {

    try {

      const results =
        await barcodeDetector.detect(
          video
        );


      for (
        const result
        of results
      ) {

        const isbn =
          normalizeISBN(
            result.rawValue
          );

        if (isbn) {

          onISBNFound(
            isbn,
            "Code-barres détecté"
          );

          return;
        }
      }

    } catch (error) {

      console.warn(
        "Erreur BarcodeDetector",
        error
      );
    }
  }
}


// =====================================================
// CAPTURE PHOTO CAMERA
// =====================================================

captureButton.addEventListener(
  "click",
  async () => {

    if (
      !cameraRunning ||
      processing
    ) {
      return;
    }

    await captureAndAnalyze();
  }
);


async function captureAndAnalyze() {

  processing = true;

  showAnalysis(
    "Analyse de la photo...",
    "Recherche du code-barres."
  );


  const canvas =
    document.createElement(
      "canvas"
    );


  /*
   * On récupère la vraie résolution
   * du flux caméra.
   */

  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;


  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  /*
   * Capture haute résolution.
   */

  context.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );


  /*
   * On transforme le canvas en fichier.
   */

  const blob =
    await new Promise(
      resolve =>
        canvas.toBlob(
          resolve,
          "image/jpeg",
          0.95
        )
    );


  if (!blob) {

    processing = false;

    hideAnalysis();

    return;
  }


  /*
   * On analyse l'image.
   */

  await analyzeImage(
    blob
  );

  processing = false;
}


// =====================================================
// PHOTO DEPUIS TELEPHONE
// =====================================================

photoButton.addEventListener(
  "click",
  () => {

    photoInput.value =
      "";

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

    await analyzeImage(file);
  }
);


// =====================================================
// ANALYSE IMAGE
// =====================================================

async function analyzeImage(file) {

  processing = true;


  showAnalysis(
    "Analyse de la photo...",
    "Étape 1/3 : recherche du code-barres."
  );


  /*
   * =========================================
   * ÉTAPE 1
   * BarcodeDetector
   * =========================================
   */

  const nativeResult =
    await detectBarcodeFromImage(
      file
    );


  if (nativeResult) {

    const isbn =
      normalizeISBN(
        nativeResult
      );

    if (isbn) {

      onISBNFound(
        isbn,
        "Code-barres détecté"
      );

      processing = false;

      return;
    }
  }


  /*
   * =========================================
   * ÉTAPE 2
   * html5-qrcode
   * =========================================
   */

  showAnalysis(
    "Analyse du code-barres...",
    "Étape 2/3 : lecture de l'image."
  );


  const qrResult =
    await detectWithHtml5Qr(
      file
    );


  if (qrResult) {

    const isbn =
      normalizeISBN(
        qrResult
      );

    if (isbn) {

      onISBNFound(
        isbn,
        "Code-barres détecté"
      );

      processing = false;

      return;
    }
  }


  /*
   * =========================================
   * ÉTAPE 3
   * OCR
   * =========================================
   */

  showAnalysis(
    "Lecture des chiffres...",
    "Étape 3/3 : recherche de l'ISBN imprimé."
  );


  const ocrResult =
    await runOCR(file);


  const isbn =
    findISBNInText(
      ocrResult
    );


  if (isbn) {

    onISBNFound(
      isbn,
      "ISBN lu sur la photo"
    );

    processing = false;

    return;
  }


  /*
   * ÉCHEC
   */

  hideAnalysis();

  statusElement.textContent =
    "ISBN non détecté. Essaie une photo plus proche et bien nette du code-barres.";

  statusElement.className =
    "status invalid";

  processing = false;
}


// =====================================================
// BARCODE DETECTOR SUR IMAGE
// =====================================================

async function detectBarcodeFromImage(file) {

  if (
    !("BarcodeDetector" in window)
  ) {
    return null;
  }


  try {

    const bitmap =
      await createImageBitmap(
        file
      );


    if (!barcodeDetector) {
      initializeBarcodeDetector();
    }


    if (!barcodeDetector) {
      return null;
    }


    const results =
      await barcodeDetector.detect(
        bitmap
      );


    for (
      const result
      of results
    ) {

      const value =
        result.rawValue;

      if (normalizeISBN(value)) {

        return value;
      }
    }


  } catch (error) {

    console.warn(
      "BarcodeDetector image error:",
      error
    );
  }


  return null;
}


// =====================================================
// HTML5 QR
// =====================================================

async function detectWithHtml5Qr(file) {

  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {
    return null;
  }


  const id =
    "temporary-barcode-reader-" +
    Date.now();


  const element =
    document.createElement(
      "div"
    );

  element.id =
    id;

  element.style.display =
    "none";

  document.body.appendChild(
    element
  );


  const scanner =
    new Html5Qrcode(id);


  try {

    const result =
      await scanner.scanFile(
        file,
        false
      );


    try {
      await scanner.clear();
    } catch {}


    element.remove();

    return result;


  } catch (error) {

    try {
      await scanner.clear();
    } catch {}

    element.remove();

    return null;
  }
}


// =====================================================
// OCR
// =====================================================

async function runOCR(file) {

  if (
    typeof Tesseract ===
    "undefined"
  ) {

    return "";
  }


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
                `Lecture des chiffres... ${percent}%`;
            }
          }

        }
      );


    console.log(
      "OCR result :",
      result.data.text
    );


    return result.data.text;


  } catch (error) {

    console.error(
      "OCR error:",
      error
    );

    return "";
  }
}


// =====================================================
// TROUVER ISBN DANS TEXTE OCR
// =====================================================

function findISBNInText(text) {

  if (!text) {
    return null;
  }


  /*
   * On corrige quelques erreurs OCR
   * fréquentes.
   */

  const cleaned =
    text
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[Ss]/g, "5");


  /*
   * On récupère toutes les suites
   * suffisamment longues de chiffres.
   */

  const candidates =
    cleaned.match(
      /(?:97[89][\s-]*)?(?:\d[\s-]*){9,13}/g
    ) || [];


  for (
    const candidate
    of candidates
  ) {

    const isbn =
      normalizeISBN(
        candidate
      );

    if (isbn) {
      return isbn;
    }
  }


  /*
   * Deuxième tentative :
   * on extrait uniquement les chiffres
   * de chaque ligne.
   */

  const lines =
    cleaned.split("\n");


  for (
    const line
    of lines
  ) {

    const digits =
      line.replace(
        /[^0-9Xx]/g,
        ""
      );


    /*
     * Un ISBN-13 commence généralement
     * par 978 ou 979.
     */

    if (
      digits.length >= 13
    ) {

      for (
        let i = 0;
        i <= digits.length - 13;
        i++
      ) {

        const candidate =
          digits.substring(
            i,
            i + 13
          );

        const isbn =
          normalizeISBN(
            candidate
          );

        if (isbn) {
          return isbn;
        }
      }
    }
  }


  return null;
}


// =====================================================
// ISBN TROUVE
// =====================================================

function onISBNFound(
  isbn,
  message
) {

  console.log(
    "ISBN trouvé :",
    isbn
  );


  stopCamera();

  hideAnalysis();

  isbnInput.value =
    isbn;


  statusElement.textContent =
    `${message} : ${isbn}`;

  statusElement.className =
    "status valid";


  vintedButton.disabled =
    false;


  /*
   * Petit feedback visuel.
   */

  if (
    navigator.vibrate
  ) {

    navigator.vibrate(
      [80, 50, 80]
    );
  }


  /*
   * On met le focus sur le bouton.
   */

  setTimeout(
    () => {
      vintedButton.focus();
    },
    100
  );
}


// =====================================================
// ANALYSE UI
// =====================================================

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


// =====================================================
// EVENTS
// =====================================================

startButton.addEventListener(
  "click",
  startCamera
);


stopButton.addEventListener(
  "click",
  stopCamera
);


isbnInput.addEventListener(
  "input",
  () => {

    isbnInput.value =
      isbnInput.value.replace(
        /[^0-9Xx-]/g,
        ""
      );

    updateISBNStatus();
  }
);


isbnInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
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


clearButton.addEventListener(
  "click",
  () => {

    isbnInput.value =
      "";

    updateISBNStatus();

    isbnInput.focus();
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


clearHistoryButton.addEventListener(
  "click",
  () => {

    localStorage.removeItem(
      HISTORY_KEY
    );

    renderHistory();
  }
);


// =====================================================
// INIT
// =====================================================

renderHistory();

updateISBNStatus();
