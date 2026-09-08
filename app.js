/* =========================================================
   RESEARCH — ISBN SCANNER V3
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const video =
  document.getElementById("video");

const cameraPlaceholder =
  document.getElementById("cameraPlaceholder");

const scannerOverlay =
  document.getElementById("scannerOverlay");

const startCamera =
  document.getElementById("startCamera");

const stopCamera =
  document.getElementById("stopCamera");

const cameraStatus =
  document.getElementById("cameraStatus");

const photoInput =
  document.getElementById("photoInput");

const cropCard =
  document.getElementById("cropCard");

const cropContainer =
  document.getElementById("cropContainer");

const cropImage =
  document.getElementById("cropImage");

const readCrop =
  document.getElementById("readCrop");

const newPhoto =
  document.getElementById("newPhoto");

const cropStatus =
  document.getElementById("cropStatus");

const isbnInput =
  document.getElementById("isbn");

const copyISBN =
  document.getElementById("copyISBN");

const resultStatus =
  document.getElementById("resultStatus");

const vintedButton =
  document.getElementById("vintedButton");

const googleButton =
  document.getElementById("googleButton");


/* =========================================================
   VARIABLES
   ========================================================= */

let stream = null;

let cropper = null;

let reader = null;

let scanning = false;


/* =========================================================
   INITIALISATION ZXING
   ========================================================= */

function initialiseReader() {

  try {

    if (
      typeof ZXingBrowser ===
      "undefined"
    ) {

      throw new Error(
        "ZXing n'est pas chargé."
      );

    }


    reader =
      new ZXingBrowser
        .BrowserMultiFormatReader();


    console.log(
      "ZXing correctement chargé."
    );


  } catch (error) {

    console.error(error);

    cameraStatus.textContent =
      "⚠️ Le lecteur de codes-barres n'a pas pu être chargé.";

    cameraStatus.className =
      "diagnostic error";

  }

}


initialiseReader();


/* =========================================================
   ISBN
   ========================================================= */


/*
 * Nettoie une chaîne.
 */

function cleanISBN(value) {

  return String(value || "")
    .toUpperCase()
    .replace(/[^0-9X]/g, "");

}


/*
 * Validation ISBN-13.
 */

function isValidISBN13(isbn) {

  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }


  let sum = 0;


  for (
    let i = 0;
    i < 12;
    i++
  ) {

    sum +=
      Number(isbn[i]) *
      (i % 2 === 0 ? 1 : 3);

  }


  const check =
    (10 - (sum % 10)) % 10;


  return (
    check ===
    Number(isbn[12])
  );

}


/*
 * Validation ISBN-10.
 */

function isValidISBN10(isbn) {

  if (
    !/^\d{9}[\dX]$/.test(isbn)
  ) {

    return false;

  }


  let sum = 0;


  for (
    let i = 0;
    i < 10;
    i++
  ) {

    const value =
      isbn[i] === "X"
        ? 10
        : Number(isbn[i]);


    sum +=
      value * (10 - i);

  }


  return (
    sum % 11 === 0
  );

}


/*
 * Conversion ISBN-10 vers ISBN-13.
 */

function isbn10To13(isbn10) {

  const base =
    "978" +
    isbn10.substring(0, 9);


  let sum = 0;


  for (
    let i = 0;
    i < 12;
    i++
  ) {

    sum +=
      Number(base[i]) *
      (i % 2 === 0 ? 1 : 3);

  }


  const check =
    (10 - (sum % 10)) % 10;


  return base + check;

}


/*
 * Cherche un ISBN dans un texte.
 */

function findISBN(text) {

  if (!text) {
    return null;
  }


  /*
   * Cas où le lecteur renvoie
   * directement le code.
   */

  const cleaned =
    cleanISBN(text);


  if (
    cleaned.length === 13 &&
    isValidISBN13(cleaned)
  ) {

    return cleaned;

  }


  if (
    cleaned.length === 10 &&
    isValidISBN10(cleaned)
  ) {

    return isbn10To13(cleaned);

  }


  /*
   * Recherche ISBN-13 dans le texte.
   */

  const matches13 =
    String(text).match(
      /\d{13}/g
    );


  if (matches13) {

    for (
      const candidate of matches13
    ) {

      if (
        isValidISBN13(candidate)
      ) {

        return candidate;

      }

    }

  }


  /*
   * Recherche ISBN-10.
   */

  const matches10 =
    String(text).match(
      /\d{9}[\dXx]/g
    );


  if (matches10) {

    for (
      const candidate of matches10
    ) {

      const value =
        candidate.toUpperCase();


      if (
        isValidISBN10(value)
      ) {

        return isbn10To13(value);

      }

    }

  }


  return null;

}


/*
 * Affichage ISBN.
 */

function displayISBN(isbn) {

  isbnInput.value =
    isbn;


  resultStatus.textContent =
    "✓ ISBN détecté : " +
    isbn;


  resultStatus.className =
    "message success";


  vintedButton.disabled =
    false;


  googleButton.disabled =
    false;

}


/* =========================================================
   CAMERA — DIAGNOSTIC
   ========================================================= */

async function startCameraStream() {

  /*
   * Vérification HTTPS.
   */

  if (
    location.protocol !== "https:" &&
    location.hostname !== "localhost"
  ) {

    cameraStatus.textContent =
      "⚠️ La caméra nécessite HTTPS. Utilise l'adresse GitHub Pages.";

    cameraStatus.className =
      "diagnostic error";

    return false;

  }


  /*
   * Vérification de getUserMedia.
   */

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    cameraStatus.textContent =
      "⚠️ Ce navigateur ne permet pas l'accès à la caméra.";

    cameraStatus.className =
      "diagnostic error";

    return false;

  }


  try {

    cameraStatus.textContent =
      "⏳ Demande d'autorisation caméra…";

    cameraStatus.className =
      "diagnostic";


    /*
     * Caméra arrière.
     */

    stream =
      await navigator.mediaDevices
        .getUserMedia({

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


    console.log(
      "Flux caméra obtenu :",
      stream
    );


    /*
     * Connexion du flux à la vidéo.
     */

    video.srcObject =
      stream;


    /*
     * Important sur certains mobiles :
     * attendre les métadonnées avant play().
     */

    await new Promise(
      resolve => {

        if (
          video.readyState >= 1
        ) {

          resolve();

        } else {

          video.onloadedmetadata =
            () => resolve();

        }

      }
    );


    await video.play();


    /*
     * Vérification que le flux
     * produit réellement une image.
     */

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {

      throw new Error(
        "La caméra ne fournit aucune image."
      );

    }


    console.log(
      "Résolution caméra :",
      video.videoWidth,
      "x",
      video.videoHeight
    );


    cameraPlaceholder
      .classList
      .add("hidden");


    scannerOverlay
      .classList
      .remove("hidden");


    startCamera
      .classList
      .add("hidden");


    stopCamera
      .classList
      .remove("hidden");


    cameraStatus.textContent =
      "✓ Caméra active — place le code-barres dans le cadre.";

    cameraStatus.className =
      "diagnostic success";


    return true;


  } catch (error) {

    console.error(
      "Erreur caméra :",
      error
    );


    /*
     * Messages adaptés aux erreurs
     * les plus fréquentes.
     */

    if (
      error.name ===
      "NotAllowedError"
    ) {

      cameraStatus.textContent =
        "❌ Accès caméra refusé. Autorise la caméra pour ce site dans les réglages du navigateur.";

    } else if (
      error.name ===
      "NotFoundError"
    ) {

      cameraStatus.textContent =
        "❌ Aucune caméra trouvée.";

    } else if (
      error.name ===
      "NotReadableError"
    ) {

      cameraStatus.textContent =
        "❌ La caméra est utilisée par une autre application.";

    } else {

      cameraStatus.textContent =
        "❌ Impossible d'ouvrir la caméra : " +
        error.message;

    }


    cameraStatus.className =
      "diagnostic error";


    return false;

  }

}


/* =========================================================
   CAMERA — SCAN
   ========================================================= */

startCamera.addEventListener(
  "click",
  async () => {

    if (scanning) {
      return;
    }


    /*
     * Ouvrir la caméra.
     */

    const opened =
      await startCameraStream();


    if (!opened) {
      return;
    }


    /*
     * ZXing doit être disponible.
     */

    if (!reader) {

      initialiseReader();

    }


    if (!reader) {

      cameraStatus.textContent =
        "✓ Caméra active, mais le lecteur de codes-barres n'est pas disponible.";

      return;

    }


    scanning = true;


    /*
     * Lecture continue.
     */

    try {

      reader.decodeFromVideoElement(
        video,
        (result, error) => {

          if (!scanning) {
            return;
          }


          if (result) {

            const raw =
              result.getText();


            console.log(
              "Code détecté :",
              raw
            );


            const isbn =
              findISBN(raw);


            if (isbn) {

              displayISBN(isbn);


              cameraStatus.textContent =
                "✓ ISBN trouvé !";


              cameraStatus.className =
                "diagnostic success";


              stopCamera();

            } else {

              cameraStatus.textContent =
                "Code détecté, mais il ne correspond pas à un ISBN.";

              cameraStatus.className =
                "diagnostic";

            }

          }

        }
      );


    } catch (error) {

      console.error(
        "Erreur ZXing :",
        error
      );


      cameraStatus.textContent =
        "⚠️ La caméra fonctionne, mais la lecture du code-barres a échoué.";

      cameraStatus.className =
        "diagnostic error";

    }

  }
);


/* =========================================================
   STOP CAMERA
   ========================================================= */

function stopCamera() {

  scanning = false;


  if (stream) {

    stream
      .getTracks()
      .forEach(
        track => track.stop()
      );

    stream = null;

  }


  video.pause();

  video.srcObject = null;


  scannerOverlay
    .classList
    .add("hidden");


  cameraPlaceholder
    .classList
    .remove("hidden");


  startCamera
    .classList
    .remove("hidden");


  stopCamera
    .classList
    .add("hidden");


  if (
    cameraStatus.classList
      .contains("success")
  ) {

    return;

  }


  cameraStatus.textContent =
    "Caméra inactive";

  cameraStatus.className =
    "diagnostic";

}


stopCamera.addEventListener(
  "click",
  stopCamera
);


/* =========================================================
   PHOTO
   ========================================================= */

photoInput.addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];


    if (!file) {
      return;
    }


    /*
     * Arrêter la caméra.
     */

    stopCamera();


    /*
     * Détruire l'ancien Cropper.
     */

    if (cropper) {

      cropper.destroy();

      cropper = null;

    }


    cropStatus.textContent =
      "⏳ Chargement de la photo…";

    cropStatus.className =
      "message";


    /*
     * URL temporaire de la photo.
     */

    const imageURL =
      URL.createObjectURL(file);


    /*
     * IMPORTANT :
     * afficher la carte AVANT
     * de charger l'image.
     */

    cropCard
      .classList
      .remove("hidden");


    /*
     * Reset image.
     */

    cropImage.removeAttribute(
      "src"
    );


    /*
     * Attendre le chargement réel.
     */

    cropImage.onload =
      () => {

        console.log(
          "Image chargée :",
          cropImage.naturalWidth,
          "x",
          cropImage.naturalHeight
        );


        cropStatus.textContent =
          "✓ Photo chargée. Sélectionne le code-barres.";

        cropStatus.className =
          "message success";


        /*
         * Initialisation Cropper
         * APRÈS chargement complet.
         */

        cropper =
          new Cropper(
            cropImage,
            {

              viewMode: 1,

              dragMode: "crop",

              responsive: true,

              restore: false,

              guides: true,

              center: true,

              highlight: true,

              background: true,

              autoCrop: true,

              autoCropArea: 0.65,

              movable: true,

              zoomable: true,

              zoomOnWheel: false,

              cropBoxMovable: true,

              cropBoxResizable: true,

              toggleDragModeOnDblclick:
                false

            }
          );


        /*
         * Libérer l'URL temporaire
         * après chargement.
         */

        URL.revokeObjectURL(
          imageURL
        );

      };


    cropImage.onerror =
      () => {

        cropStatus.textContent =
          "❌ Impossible d'afficher cette photo.";

        cropStatus.className =
          "message error";

      };


    /*
     * Déclenche le chargement.
     */

    cropImage.src =
      imageURL;

  }
);


/* =========================================================
   NOUVELLE PHOTO
   ========================================================= */

newPhoto.addEventListener(
  "click",
  () => {

    if (cropper) {

      cropper.destroy();

      cropper = null;

    }


    cropCard
      .classList
      .add("hidden");


    /*
     * Permet de sélectionner
     * à nouveau le même fichier.
     */

    photoInput.value = "";

    photoInput.click();

  }
);


/* =========================================================
   LECTURE DU CROP
   ========================================================= */

readCrop.addEventListener(
  "click",
  async () => {

    if (!cropper) {

      cropStatus.textContent =
        "❌ La zone de recadrage n'est pas prête.";

      cropStatus.className =
        "message error";

      return;

    }


    if (!reader) {

      initialiseReader();

    }


    if (!reader) {

      cropStatus.textContent =
        "❌ Le lecteur de codes-barres n'est pas disponible.";

      cropStatus.className =
        "message error";

      return;

    }


    readCrop.disabled = true;

    readCrop.textContent =
      "🔎 Analyse…";


    cropStatus.textContent =
      "Analyse de la zone sélectionnée…";

    cropStatus.className =
      "message";


    try {

      /*
       * Récupération du crop.
       */

      const canvas =
        cropper.getCroppedCanvas({

          /*
           * Haute résolution pour
           * faciliter la lecture.
           */

          width: 1800,

          height: 1200,

          imageSmoothingEnabled:
            true,

          imageSmoothingQuality:
            "high"

        });


      if (!canvas) {

        throw new Error(
          "Canvas impossible à créer."
        );

      }


      /*
       * Conversion en image.
       */

      const image =
        new Image();


      image.src =
        canvas.toDataURL(
          "image/jpeg",
          0.98
        );


      await new Promise(
        (resolve, reject) => {

          image.onload =
            resolve;

          image.onerror =
            reject;

        }
      );


      /*
       * Lecture ZXing.
       */

      const result =
        await reader.decodeFromImageElement(
          image
        );


      if (!result) {

        throw new Error(
          "Aucun code détecté."
        );

      }


      const raw =
        result.getText();


      console.log(
        "Résultat photo :",
        raw
      );


      const isbn =
        findISBN(raw);


      if (!isbn) {

        throw new Error(
          "Le code détecté n'est pas un ISBN."
        );

      }


      /*
       * Résultat.
       */

      displayISBN(isbn);


      cropStatus.textContent =
        "✓ ISBN trouvé : " +
        isbn;

      cropStatus.className =
        "message success";


    } catch (error) {

      console.error(
        "Erreur lecture photo :",
        error
      );


      cropStatus.textContent =
        "❌ Aucun ISBN détecté. Essaie de recadrer plus précisément le code-barres.";

      cropStatus.className =
        "message error";

    }


    readCrop.disabled = false;

    readCrop.textContent =
      "🔎 Lire cette zone";

  }
);


/* =========================================================
   COPIE
   ========================================================= */

copyISBN.addEventListener(
  "click",
  async () => {

    const value =
      isbnInput.value.trim();


    if (!value) {
      return;
    }


    try {

      await navigator.clipboard
        .writeText(value);

    } catch {

      isbnInput.select();

      document.execCommand(
        "copy"
      );

    }


    resultStatus.textContent =
      "✓ ISBN copié !";

    resultStatus.className =
      "message success";

  }
);


/* =========================================================
   ISBN MANUEL
   ========================================================= */

isbnInput.addEventListener(
  "input",
  () => {

    const value =
      cleanISBN(
        isbnInput.value
      );


    const usable =
      value.length === 10 ||
      value.length === 13;


    vintedButton.disabled =
      !usable;

    googleButton.disabled =
      !usable;

  }
);


/* =========================================================
   VINTED
   ========================================================= */

vintedButton.addEventListener(
  "click",
  () => {

    const isbn =
      cleanISBN(
        isbnInput.value
      );


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


/* =========================================================
   GOOGLE
   ========================================================= */

googleButton.addEventListener(
  "click",
  () => {

    const isbn =
      cleanISBN(
        isbnInput.value
      );


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


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (stream) {

      stream
        .getTracks()
        .forEach(
          track => track.stop()
        );

    }

  }
);
