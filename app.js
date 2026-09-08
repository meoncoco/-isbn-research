"use strict";

/*
 * ISBN Research
 *
 * Tout le traitement est effectué côté navigateur.
 *
 * Pipeline :
 *
 * caméra
 *   ↓
 * photo originale
 *   ↓
 * recadrage manuel
 *   ↓
 * pré-traitement image
 *   ↓
 * html5-qrcode / EAN_13
 *   ↓
 * validation ISBN
 *   ↓
 * recherche Vinted / Google
 *
 * Si le barcode n'est pas détecté :
 *   ↓
 * OCR Tesseract
 */

const video = document.getElementById("camera");
const captureCanvas = document.getElementById("captureCanvas");

const startCameraButton = document.getElementById("startCamera");
const takePhotoButton = document.getElementById("takePhoto");
const stopCameraButton = document.getElementById("stopCamera");

const cameraStatus = document.getElementById("cameraStatus");
const cameraError = document.getElementById("cameraError");

const cropSection = document.getElementById("cropSection");
const cropContainer = document.getElementById("cropContainer");
const capturedImage = document.getElementById("capturedImage");
const selection = document.getElementById("selection");

const resetCropButton = document.getElementById("resetCrop");
const scanCropButton = document.getElementById("scanCrop");

const isbnInput = document.getElementById("isbn");
const copyIsbnButton = document.getElementById("copyIsbn");

const vintedButton = document.getElementById("vintedButton");
const googleButton = document.getElementById("googleButton");

const resultMessage = document.getElementById("resultMessage");
const scanStatus = document.getElementById("scanStatus");

let cameraStream = null;
let capturedBlob = null;

let naturalImageWidth = 0;
let naturalImageHeight = 0;

let crop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1
};

let dragging = false;
let dragStart = null;


/* =========================================================
   CAMERA
========================================================= */

startCameraButton.addEventListener("click", startCamera);
takePhotoButton.addEventListener("click", takePhoto);
stopCameraButton.addEventListener("click", stopCamera);

async function startCamera() {
  cameraError.textContent = "";

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.textContent =
      "La caméra n'est pas disponible dans ce navigateur. Utilise HTTPS ou localhost.";
    return;
  }

  stopCamera();

  try {
    /*
     * On demande explicitement la caméra arrière.
     *
     * Le navigateur peut ajuster ces contraintes si le téléphone
     * ne les supporte pas exactement.
     */
    cameraStream = await navigator.mediaDevices.getUserMedia({
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
        }
      }
    });

    video.srcObject = cameraStream;

    await video.play();

    cameraStatus.textContent = "Caméra active";
    takePhotoButton.disabled = false;
    stopCameraButton.disabled = false;
    startCameraButton.textContent = "📷 Caméra active";

  } catch (error) {
    console.error(error);

    cameraStatus.textContent = "Erreur caméra";

    cameraError.textContent =
      "Impossible d'ouvrir la caméra. Vérifie les permissions du navigateur et utilise HTTPS.";
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  video.srcObject = null;

  takePhotoButton.disabled = true;
  stopCameraButton.disabled = true;

  cameraStatus.textContent = "Caméra inactive";
  startCameraButton.textContent = "📷 Ouvrir la caméra";
}


/* =========================================================
   TAKE PHOTO
========================================================= */

function takePhoto() {
  if (!video.videoWidth || !video.videoHeight) {
    cameraError.textContent = "La caméra n'est pas encore prête.";
    return;
  }

  /*
   * On conserve la résolution réelle de la caméra.
   *
   * C'est important :
   * réduire la photo avant le scan peut faire perdre
   * les barres fines du code EAN.
   */
  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;

  const ctx = captureCanvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.drawImage(
    video,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height
  );

  captureCanvas.toBlob(
    blob => {
      if (!blob) {
        cameraError.textContent = "Impossible de créer la photo.";
        return;
      }

      capturedBlob = blob;

      const url = URL.createObjectURL(blob);

      capturedImage.onload = () => {
        naturalImageWidth = capturedImage.naturalWidth;
        naturalImageHeight = capturedImage.naturalHeight;

        resetCrop();

        cropSection.classList.remove("hidden");

        cropSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      };

      capturedImage.src = url;

      /*
       * On arrête immédiatement la caméra.
       *
       * Cela évite :
       * - batterie inutilement consommée
       * - caméra qui reste active
       * - problème iOS/Safari avec plusieurs streams
       */
      stopCamera();
    },
    "image/jpeg",
    0.95
  );
}


/* =========================================================
   CROP
========================================================= */

cropContainer.addEventListener("pointerdown", beginCrop);
cropContainer.addEventListener("pointermove", moveCrop);
cropContainer.addEventListener("pointerup", endCrop);
cropContainer.addEventListener("pointercancel", endCrop);

resetCropButton.addEventListener("click", resetCrop);

function resetCrop() {
  crop = {
    x: 0.05,
    y: 0.25,
    width: 0.90,
    height: 0.50
  };

  renderCrop();
}

function beginCrop(event) {
  /*
   * Si on clique dans l'image, on crée une nouvelle sélection.
   */
  const rect = cropContainer.getBoundingClientRect();

  const x = clamp(
    (event.clientX - rect.left) / rect.width,
    0,
    1
  );

  const y = clamp(
    (event.clientY - rect.top) / rect.height,
    0,
    1
  );

  dragging = true;

  dragStart = {
    x,
    y
  };

  crop = {
    x,
    y,
    width: 0,
    height: 0
  };

  selection.classList.remove("hidden");

  cropContainer.setPointerCapture(event.pointerId);
}

function moveCrop(event) {
  if (!dragging) return;

  const rect = cropContainer.getBoundingClientRect();

  const currentX = clamp(
    (event.clientX - rect.left) / rect.width,
    0,
    1
  );

  const currentY = clamp(
    (event.clientY - rect.top) / rect.height,
    0,
    1
  );

  const x1 = Math.min(dragStart.x, currentX);
  const y1 = Math.min(dragStart.y, currentY);

  const x2 = Math.max(dragStart.x, currentX);
  const y2 = Math.max(dragStart.y, currentY);

  crop = {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1
  };

  renderCrop();
}

function endCrop() {
  dragging = false;
}

function renderCrop() {
  const rect = cropContainer.getBoundingClientRect();

  selection.style.left = `${crop.x * 100}%`;
  selection.style.top = `${crop.y * 100}%`;
  selection.style.width = `${crop.width * 100}%`;
  selection.style.height = `${crop.height * 100}%`;

  selection.classList.remove("hidden");
}


/* =========================================================
   CROP IMAGE
========================================================= */

function createCroppedCanvas(scale = 2) {
  const sx = Math.round(crop.x * naturalImageWidth);
  const sy = Math.round(crop.y * naturalImageHeight);

  const sw = Math.max(
    10,
    Math.round(crop.width * naturalImageWidth)
  );

  const sh = Math.max(
    10,
    Math.round(crop.height * naturalImageHeight)
  );

  /*
   * Upscaling du crop.
   *
   * Pour un EAN-13, c'est très utile lorsque le code-barres
   * occupe une petite partie de la photo.
   */
  const maxDimension = 2400;

  const factor = Math.min(
    scale,
    maxDimension / Math.max(sw, sh)
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(300, Math.round(sw * factor));
  canvas.height = Math.max(200, Math.round(sh * factor));

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    capturedImage,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}


/* =========================================================
   BARCODE SCAN
========================================================= */

scanCropButton.addEventListener("click", scanCurrentCrop);

async function scanCurrentCrop() {
  scanCropButton.disabled = true;
  scanStatus.textContent = "Lecture...";
  resultMessage.textContent = "";

  try {
    const cropCanvas = createCroppedCanvas(2);

    /*
     * Première tentative :
     * image couleur haute résolution.
     */
    let code = await scanCanvasWithHtml5QrCode(cropCanvas);

    /*
     * Deuxième tentative :
     * version noir/blanc fortement contrastée.
     */
    if (!code) {
      const processed = preprocessBarcodeCanvas(cropCanvas);

      code = await scanCanvasWithHtml5QrCode(processed);
    }

    if (code) {
      const isbn = normalizeISBN(code);

      if (isbn) {
        setISBN(isbn);
        resultMessage.textContent =
          "ISBN détecté automatiquement depuis le code-barres.";
        scanStatus.textContent = "✓ Trouvé";

        scanCropButton.disabled = false;
        return;
      }
    }

    /*
     * Si le barcode n'est pas reconnu :
     * OCR de secours.
     */
    scanStatus.textContent = "OCR...";

    const ocrResult = await runOCR(cropCanvas);

    const isbnFromOCR = extractISBNFromText(ocrResult);

    if (isbnFromOCR) {
      setISBN(isbnFromOCR);

      resultMessage.textContent =
        "ISBN récupéré par OCR. Vérifie le numéro avant la recherche.";

      scanStatus.textContent = "✓ OCR";

    } else {
      resultMessage.textContent =
        "Aucun ISBN détecté. Essaie de recadrer uniquement le code-barres avec les chiffres visibles sous les barres.";

      scanStatus.textContent = "Non trouvé";
    }

  } catch (error) {
    console.error(error);

    resultMessage.textContent =
      "La lecture a échoué. Essaie avec un recadrage plus serré ou une photo plus nette.";

    scanStatus.textContent = "Erreur";

  } finally {
    scanCropButton.disabled = false;
  }
}


/*
 * Utilise html5-qrcode uniquement comme moteur de décodage.
 *
 * On limite volontairement aux formats ISBN :
 *
 * - EAN_13 : format normal des ISBN-13
 * - EAN_8 : ajouté pour robustesse
 */
async function scanCanvasWithHtml5QrCode(canvas) {
  const blob = await canvasToBlob(canvas);

  const file = new File(
    [blob],
    "isbn.jpg",
    {
      type: "image/jpeg"
    }
  );

  const scannerId =
    "isbn-scanner-" + Date.now();

  const scannerElement =
    document.createElement("div");

  scannerElement.id = scannerId;
  scannerElement.className = "hidden";

  document.body.appendChild(scannerElement);

  const scanner = new Html5Qrcode(scannerId, {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8
    ],
    verbose: false
  });

  try {
    const result = await scanner.scanFile(
      file,
      false
    );

    return result || null;

  } catch {
    return null;

  } finally {
    try {
      await scanner.clear();
    } catch {
      // Rien à faire.
    }

    scannerElement.remove();
  }
}


/* =========================================================
   BARCODE PREPROCESSING
========================================================= */

function preprocessBarcodeCanvas(source) {
  const canvas = document.createElement("canvas");

  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.drawImage(
    source,
    0,
    0
  );

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = imageData.data;

  /*
   * Conversion grayscale + contraste.
   *
   * Les codes-barres ISBN sont beaucoup plus faciles
   * à décoder lorsque les barres sont franchement noires
   * et le fond franchement blanc.
   */
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let gray =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    /*
     * Augmentation du contraste.
     */
    gray = (gray - 128) * 1.8 + 128;

    gray = clamp(gray, 0, 255);

    /*
     * Binarisation légère.
     */
    if (gray < 135) {
      gray = 0;
    } else {
      gray = 255;
    }

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

  return canvas;
}


/* =========================================================
   OCR FALLBACK
========================================================= */

async function runOCR(canvas) {
  if (!window.Tesseract) {
    return "";
  }

  /*
   * Pour l'OCR on prépare une image plus contrastée.
   */
  const processed = preprocessOCRCanvas(canvas);

  const result = await Tesseract.recognize(
    processed,
    "eng",
    {
      logger: message => {
        if (
          message.status === "recognizing text" &&
          typeof message.progress === "number"
        ) {
          resultMessage.textContent =
            `OCR ${Math.round(message.progress * 100)} %`;
        }
      }
    }
  );

  return result.data.text || "";
}

function preprocessOCRCanvas(source) {
  const canvas = document.createElement("canvas");

  canvas.width = source.width * 1.5;
  canvas.height = source.height * 1.5;

  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    source,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );

  return canvas;
}


/* =========================================================
   ISBN EXTRACTION
========================================================= */

function extractISBNFromText(text) {
  if (!text) return null;

  /*
   * Nettoyage :
   * l'OCR confond régulièrement :
   *
   * O -> 0
   * I -> 1
   * l -> 1
   */
  let cleaned = text
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  /*
   * On recherche en priorité des séquences ISBN-13.
   */
  const candidates13 =
    cleaned.match(
      /(?:97[89][\s-]?\d[\s-]?\d{4}[\s-]?\d{3}[\s-]?\d{1,2})/g
    ) || [];

  for (const candidate of candidates13) {
    const isbn = normalizeISBN(candidate);

    if (isbn) {
      return isbn;
    }
  }

  /*
   * Puis ISBN-10.
   */
  const candidates10 =
    cleaned.match(
      /(?:\d[\d\s-]{8}[\dX])/g
    ) || [];

  for (const candidate of candidates10) {
    const isbn10 = candidate
      .replace(/[^0-9X]/g, "");

    if (isbn10.length === 10) {
      const isbn13 = isbn10To13(isbn10);

      if (isbn13) {
        return isbn13;
      }
    }
  }

  /*
   * Dernier recours :
   * recherche toutes les suites de 10-13 chiffres.
   */
  const numbers =
    cleaned.match(/\d{10,13}/g) || [];

  for (const number of numbers) {
    const isbn = normalizeISBN(number);

    if (isbn) {
      return isbn;
    }
  }

  return null;
}


/*
 * Transforme un code EAN ou ISBN en ISBN-13 valide.
 */
function normalizeISBN(value) {
  if (!value) return null;

  let digits = String(value)
    .toUpperCase()
    .replace(/[^0-9X]/g, "");

  /*
   * EAN-13
   */
  if (
    digits.length === 13 &&
    /^97[89]/.test(digits)
  ) {
    if (validateISBN13(digits)) {
      return formatISBN13(digits);
    }

    return null;
  }

  /*
   * ISBN-10
   */
  if (digits.length === 10) {
    const isbn13 = isbn10To13(digits);

    if (isbn13) {
      return formatISBN13(isbn13);
    }
  }

  return null;
}


function validateISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum +=
      Number(isbn[i]) *
      (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit =
    (10 - (sum % 10)) % 10;

  return checkDigit === Number(isbn[12]);
}


function validateISBN10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) {
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


function isbn10To13(isbn10) {
  if (!validateISBN10(isbn10)) {
    return null;
  }

  const base =
    "978" + isbn10.substring(0, 9);

  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum +=
      Number(base[i]) *
      (i % 2 === 0 ? 1 : 3);
  }

  const check =
    (10 - (sum % 10)) % 10;

  return base + check;
}


function formatISBN13(isbn) {
  /*
   * Affichage lisible mais la valeur interne
   * reste exploitable pour les URLs.
   */
  return isbn;
}


/* =========================================================
   ISBN INPUT
========================================================= */

isbnInput.addEventListener("input", () => {
  /*
   * Autorise également une saisie manuelle.
   */
  const normalized = normalizeISBN(isbnInput.value);

  if (normalized) {
    isbnInput.value = normalized;
    updateSearchLinks(normalized);

    resultMessage.textContent =
      "ISBN valide.";

    scanStatus.textContent = "Valide";
  } else {
    /*
     * Si l'utilisateur est encore en train de taper,
     * on ne signale pas immédiatement une erreur.
     */
    updateSearchLinks(null);
  }
});


function setISBN(isbn) {
  isbnInput.value = isbn;

  updateSearchLinks(isbn);
}


function updateSearchLinks(isbn) {
  if (!isbn) {
    vintedButton.href = "#";
    googleButton.href = "#";

    vintedButton.classList.add("disabled");
    googleButton.classList.add("disabled");

    return;
  }

  /*
   * URL demandée pour Vinted.
   */
  const vintedURL =
    `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(isbn)}`;

  /*
   * Google recherche l'ISBN exact.
   */
  const googleURL =
    `https://www.google.com/search?q=${encodeURIComponent(isbn)}`;

  vintedButton.href = vintedURL;
  googleButton.href = googleURL;

  vintedButton.classList.remove("disabled");
  googleButton.classList.remove("disabled");
}


/* =========================================================
   COPY
========================================================= */

copyIsbnButton.addEventListener("click", async () => {
  const value = isbnInput.value.trim();

  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);

    copyIsbnButton.textContent = "✓ Copié";

    setTimeout(() => {
      copyIsbnButton.textContent = "Copier";
    }, 1200);

  } catch {
    /*
     * Fallback pour certains navigateurs.
     */
    isbnInput.focus();
    isbnInput.select();

    document.execCommand("copy");

    copyIsbnButton.textContent = "✓ Copié";

    setTimeout(() => {
      copyIsbnButton.textContent = "Copier";
    }, 1200);
  }
});


/* =========================================================
   HELPERS
========================================================= */

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}


function canvasToBlob(canvas) {
  return new Promise(resolve => {
    canvas.toBlob(
      blob => resolve(blob),
      "image/jpeg",
      0.95
    );
  });
}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
  "beforeunload",
  stopCamera
);
