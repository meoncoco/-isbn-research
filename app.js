/* =====================================================
   ISBN SCANNER
   ===================================================== */


/* =========================
   ELEMENTS
========================= */

const video = document.getElementById("video");

const startCameraButton =
  document.getElementById("startCamera");

const stopCameraButton =
  document.getElementById("stopCamera");

const cameraStatus =
  document.getElementById("cameraStatus");

const imageInput =
  document.getElementById("imageInput");

const cropSection =
  document.getElementById("cropSection");

const cropImage =
  document.getElementById("cropImage");

const scanCropButton =
  document.getElementById("scanCrop");

const isbnInput =
  document.getElementById("isbnInput");

const copyButton =
  document.getElementById("copyButton");

const resultStatus =
  document.getElementById("resultStatus");

const vintedButton =
  document.getElementById("vintedButton");

const googleButton =
  document.getElementById("googleButton");


/* =========================
   VARIABLES
========================= */

let stream = null;
let codeReader = null;
let cropper = null;


/* =========================
   INITIALISATION ZXING
========================= */

try {
  codeReader = new ZXingBrowser.BrowserMultiFormatReader();
} catch (error) {
  console.error("Impossible de charger ZXing :", error);
}


/* =====================================================
   UTILITAIRES ISBN
   ===================================================== */


/**
 * Nettoie une chaîne pour ne garder
 * que les chiffres et éventuellement X.
 */
function cleanISBN(value) {

  return value
    .toUpperCase()
    .replace(/[^0-9X]/g, "");

}


/**
 * Calcule la clé de contrôle d'un ISBN-13.
 */
function isValidISBN13(isbn) {

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


/**
 * Calcule la clé de contrôle d'un ISBN-10.
 */
function isValidISBN10(isbn) {

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


/**
 * Convertit un ISBN-10 en ISBN-13.
 */
function isbn10To13(isbn10) {

  const base =
    "978" + isbn10.substring(0, 9);

  let sum = 0;

  for (let i = 0; i < 12; i++) {

    sum +=
      Number(base[i]) *
      (i % 2 === 0 ? 1 : 3);

  }

  const checkDigit =
    (10 - (sum % 10)) % 10;

  return base + checkDigit;

}


/**
 * Cherche un ISBN dans le résultat
 * fourni par ZXing.
 */
function extractISBN(text) {

  if (!text) {
    return null;
  }

  const cleaned = cleanISBN(text);

  /* ISBN-13 */

  if (
    cleaned.length === 13 &&
    isValidISBN13(cleaned)
  ) {
    return cleaned;
  }

  /* ISBN-10 */

  if (
    cleaned.length === 10 &&
    isValidISBN10(cleaned)
  ) {
    return isbn10To13(cleaned);
  }


  /*
   * Certains lecteurs peuvent retourner
   * un texte contenant plusieurs informations.
   *
   * On cherche donc des groupes de 13 chiffres.
   */

  const matches =
    text.match(/\d{13}/g);

  if (matches) {

    for (const candidate of matches) {

      if (isValidISBN13(candidate)) {
        return candidate;
      }

    }

  }


  /*
   * Puis ISBN-10.
   */

  const matches10 =
    text.match(/\d{9}[\dXx]/g);

  if (matches10) {

    for (const candidate of matches10) {

      const isbn =
        candidate.toUpperCase();

      if (isValidISBN10(isbn)) {
        return isbn10To13(isbn);
      }

    }

  }

  return null;

}


/**
 * Affiche un ISBN dans l'interface.
 */
function setISBN(isbn) {

  isbnInput.value = isbn;

  resultStatus.textContent =
    "ISBN détecté : " + isbn;

  resultStatus.className =
    "status success";

  vintedButton.disabled = false;
  googleButton.disabled = false;

}


/**
 * Réinitialise le résultat.
 */
function clearISBN() {

  isbnInput.value = "";

  vintedButton.disabled = true;
  googleButton.disabled = true;

}


/* =====================================================
   CAMÉRA
   ===================================================== */


/**
 * Démarre la caméra.
 */
async function startCamera() {

  if (!codeReader) {

    cameraStatus.textContent =
      "Le lecteur de code-barres n'est pas disponible.";

    cameraStatus.className =
      "status error";

    return;

  }


  try {

    cameraStatus.textContent =
      "Demande d'accès à la caméra…";

    stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          }
        },

        audio: false
      });


    video.srcObject = stream;

    await video.play();


    startCameraButton.classList.add("hidden");
    stopCameraButton.classList.remove("hidden");


    cameraStatus.textContent =
      "Place le code-barres dans le cadre…";

    cameraStatus.className =
      "status";


    /*
     * Lecture continue.
     */

    codeReader.decodeFromVideoElement(
      video,
      (result, error) => {

        if (result) {

          const raw =
            result.getText();

          console.log(
            "Code détecté :",
            raw
          );

          const isbn =
            extractISBN(raw);

          if (isbn) {

            setISBN(isbn);

            cameraStatus.textContent =
              "✓ ISBN trouvé !";

            cameraStatus.className =
              "status success";

            stopCamera();

          } else {

            cameraStatus.textContent =
              "Code détecté mais ce n'est pas un ISBN.";

          }

        }

      }
    );


  } catch (error) {

    console.error(error);

    cameraStatus.textContent =
      "Impossible d'accéder à la caméra. Vérifie les autorisations.";

    cameraStatus.className =
      "status error";

  }

}


/**
 * Arrête la caméra.
 */
function stopCamera() {

  if (stream) {

    stream
      .getTracks()
      .forEach(track => track.stop());

    stream = null;

  }

  video.srcObject = null;

  startCameraButton.classList.remove("hidden");
  stopCameraButton.classList.add("hidden");

}


/* =====================================================
   PHOTO + CROP
   ===================================================== */


/**
 * Lorsqu'une photo est sélectionnée.
 */
imageInput.addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }


    const url =
      URL.createObjectURL(file);

    cropImage.src = url;

    cropSection.classList.remove("hidden");


    /*
     * Détruire l'ancien Cropper.
     */

    if (cropper) {

      cropper.destroy();
      cropper = null;

    }


    cropImage.onload = () => {

      cropper =
        new Cropper(
          cropImage,
          {
            viewMode: 1,

            autoCropArea: 0.8,

            responsive: true,

            background: false,

            movable: true,

            zoomable: true,

            rotatable: false,

            scalable: false
          }
        );

    };

  }
);


/**
 * Analyse la zone recadrée.
 */
scanCropButton.addEventListener(
  "click",
  async () => {

    if (!cropper) {

      resultStatus.textContent =
        "Aucune image à analyser.";

      resultStatus.className =
        "status error";

      return;

    }


    scanCropButton.disabled = true;

    scanCropButton.textContent =
      "🔎 Analyse…";


    try {

      /*
       * On demande à Cropper.js
       * de générer l'image recadrée.
       */

      const canvas =
        cropper.getCroppedCanvas({
          width: 1600,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high"
        });


      /*
       * Transformer le canvas en image.
       */

      const croppedImage =
        new Image();

      croppedImage.src =
        canvas.toDataURL("image/jpeg", 0.95);


      await new Promise(resolve => {
        croppedImage.onload = resolve;
      });


      /*
       * ZXing analyse l'image.
       */

      const result =
        await codeReader.decodeFromImageElement(
          croppedImage
        );


      const raw =
        result.getText();

      console.log(
        "Résultat photo :",
        raw
      );


      const isbn =
        extractISBN(raw);


      if (isbn) {

        setISBN(isbn);

      } else {

        resultStatus.textContent =
          "Un code a été trouvé, mais il ne semble pas être un ISBN.";

        resultStatus.className =
          "status error";

      }


    } catch (error) {

      console.error(error);

      resultStatus.textContent =
        "Impossible de lire le code. Essaie de recadrer plus précisément le code-barres.";

      resultStatus.className =
        "status error";

    }


    scanCropButton.disabled = false;

    scanCropButton.textContent =
      "🔎 Lire le code-barres";

  }
);


/* =====================================================
   COPIE
   ===================================================== */

copyButton.addEventListener(
  "click",
  async () => {

    const isbn =
      isbnInput.value.trim();

    if (!isbn) {
      return;
    }

    try {

      await navigator.clipboard.writeText(
        isbn
      );

      resultStatus.textContent =
        "✓ ISBN copié !";

      resultStatus.className =
        "status success";

    } catch (error) {

      /*
       * Fallback pour certains navigateurs.
       */

      isbnInput.select();

      document.execCommand("copy");

      resultStatus.textContent =
        "✓ ISBN copié !";

      resultStatus.className =
        "status success";

    }

  }
);


/* =====================================================
   RECHERCHES
   ===================================================== */


/**
 * Récupère l'ISBN actuellement présent
 * dans le champ.
 */
function getCurrentISBN() {

  const isbn =
    cleanISBN(isbnInput.value);

  return isbn;

}


/**
 * Recherche Vinted.
 */
vintedButton.addEventListener(
  "click",
  () => {

    const isbn =
      getCurrentISBN();

    if (!isbn) {
      return;
    }


    const url =
      "https://www.vinted.fr/catalog?search_text=" +
      encodeURIComponent(isbn);


    window.open(
      url,
      "_blank"
    );

  }
);


/**
 * Recherche Google.
 */
googleButton.addEventListener(
  "click",
  () => {

    const isbn =
      getCurrentISBN();

    if (!isbn) {
      return;
    }


    const url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(isbn);


    window.open(
      url,
      "_blank"
    );

  }
);


/* =====================================================
   MODIFICATION MANUELLE DE L'ISBN
===================================================== */

isbnInput.addEventListener(
  "input",
  () => {

    const isbn =
      getCurrentISBN();

    /*
     * On autorise la recherche même si
     * l'utilisateur a corrigé manuellement
     * l'ISBN.
     */

    const valid =
      isbn.length === 10 ||
      isbn.length === 13;

    vintedButton.disabled = !valid;
    googleButton.disabled = !valid;

  }
);


/* =====================================================
   ÉVÉNEMENTS
===================================================== */

startCameraButton.addEventListener(
  "click",
  startCamera
);

stopCameraButton.addEventListener(
  "click",
  stopCamera
);


/*
 * Nettoyage lorsque l'utilisateur
 * quitte la page.
 */

window.addEventListener(
  "beforeunload",
  stopCamera
);
