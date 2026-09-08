/* =========================================================
   RESEARCH — ISBN SCANNER
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const video =
  document.getElementById("video");

const startScan =
  document.getElementById("startScan");

const stopScan =
  document.getElementById("stopScan");

const scanMessage =
  document.getElementById("scanMessage");

const photoInput =
  document.getElementById("photoInput");

const cropCard =
  document.getElementById("cropCard");

const cropImage =
  document.getElementById("cropImage");

const readCrop =
  document.getElementById("readCrop");

const cropMessage =
  document.getElementById("cropMessage");

const isbnInput =
  document.getElementById("isbn");

const copyButton =
  document.getElementById("copy");

const resultMessage =
  document.getElementById("resultMessage");

const vintedButton =
  document.getElementById("vinted");

const googleButton =
  document.getElementById("google");


/* =========================================================
   VARIABLES
   ========================================================= */

let stream = null;

let reader = null;

let cropper = null;

let scanning = false;


/* =========================================================
   INITIALISATION ZXING
   ========================================================= */

function initReader() {

  try {

    reader =
      new ZXingBrowser.BrowserMultiFormatReader();

    console.log("ZXing chargé.");

  } catch (error) {

    console.error(
      "Erreur ZXing :",
      error
    );

    scanMessage.textContent =
      "Impossible de charger le lecteur de codes-barres.";

    scanMessage.className =
      "message error";
  }
}

initReader();


/* =========================================================
   ISBN
   ========================================================= */


/*
 * Nettoyage.
 */

function clean(value) {

  return value
    .toUpperCase()
    .replace(/[^0-9X]/g, "");

}


/*
 * Vérification ISBN-13.
 */

function validISBN13(isbn) {

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
    (10 - sum % 10) % 10;

  return check ===
    Number(isbn[12]);

}


/*
 * Vérification ISBN-10.
 */

function validISBN10(isbn) {

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

  return sum % 11 === 0;

}


/*
 * ISBN-10 → ISBN-13
 */

function convertISBN10(isbn10) {

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
    (10 - sum % 10) % 10;

  return base + check;

}


/*
 * Recherche d'un ISBN dans du texte.
 */

function findISBN(text) {

  if (!text) {
    return null;
  }

  /*
   * On regarde d'abord exactement
   * ce que le scanner a retourné.
   */

  const cleaned =
    clean(text);


  if (
    cleaned.length === 13 &&
    validISBN13(cleaned)
  ) {

    return cleaned;

  }


  if (
    cleaned.length === 10 &&
    validISBN10(cleaned)
  ) {

    return convertISBN10(cleaned);

  }


  /*
   * Recherche d'un ISBN-13
   * à l'intérieur d'un texte.
   */

  const isbn13 =
    text.match(/\d{13}/g);

  if (isbn13) {

    for (
      const candidate of isbn13
    ) {

      if (
        validISBN13(candidate)
      ) {

        return candidate;

      }

    }

  }


  /*
   * Recherche ISBN-10.
   */

  const isbn10 =
    text.match(
      /\d{9}[\dXx]/g
    );

  if (isbn10) {

    for (
      const candidate of isbn10
    ) {

      const value =
        candidate.toUpperCase();

      if (
        validISBN10(value)
      ) {

        return convertISBN10(value);

      }

    }

  }


  return null;

}


/*
 * Affichage résultat.
 */

function showISBN(isbn) {

  isbnInput.value = isbn;

  resultMessage.textContent =
    "✓ ISBN détecté : " + isbn;

  resultMessage.className =
    "message success";

  vintedButton.disabled = false;

  googleButton.disabled = false;

}


/* =========================================================
   CAMERA
   ========================================================= */

startScan.addEventListener(
  "click",
  async () => {

    if (!reader) {

      initReader();

      if (!reader) {
        return;
      }

    }


    try {

      scanMessage.textContent =
        "Activation de la caméra…";

      scanMessage.className =
        "message";


      /*
       * Demande explicite de la caméra arrière.
       */

      stream =
        await navigator.mediaDevices
          .getUserMedia({

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
            },

            audio: false

          });


      video.srcObject =
        stream;

      await video.play();


      scanning = true;


      startScan.classList.add(
        "hidden"
      );

      stopScan.classList.remove(
        "hidden"
      );


      scanMessage.textContent =
        "Place le code-barres dans le cadre…";


      /*
       * Lecture continue.
       */

      reader.decodeFromVideoElement(
        video,
        (result, error) => {

          if (!scanning) {
            return;
          }


          if (result) {

            const text =
              result.getText();

            console.log(
              "Code détecté :",
              text
            );


            const isbn =
              findISBN(text);


            if (isbn) {

              showISBN(isbn);

              scanMessage.textContent =
                "✓ ISBN trouvé !";

              scanMessage.className =
                "message success";

              stopCamera();

            } else {

              scanMessage.textContent =
                "Code détecté, mais pas reconnu comme ISBN.";

            }

          }

        }
      );


    } catch (error) {

      console.error(
        "Erreur caméra :",
        error
      );


      scanMessage.textContent =
        "Impossible d'accéder à la caméra. Vérifie l'autorisation du navigateur.";

      scanMessage.className =
        "message error";

    }

  }
);


/* =========================================================
   ARRÊT CAMERA
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


  video.srcObject = null;


  startScan.classList.remove(
    "hidden"
  );

  stopScan.classList.add(
    "hidden"
  );

}


stopScan.addEventListener(
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
     * Arrêt caméra si elle tourne.
     */

    stopCamera();


    const url =
      URL.createObjectURL(file);


    cropImage.src = url;

    cropCard.classList.remove(
      "hidden"
    );


    /*
     * Détruire l'ancien Cropper.
     */

    if (cropper) {

      cropper.destroy();

      cropper = null;

    }


    cropImage.onload =
      () => {

        cropper =
          new Cropper(
            cropImage,
            {

              /*
               * Permet de déplacer
               * et redimensionner la sélection.
               */

              viewMode: 1,

              dragMode: "crop",

              autoCropArea: 0.7,

              responsive: true,

              background: false,

              movable: true,

              zoomable: true,

              zoomOnWheel: true,

              cropBoxMovable: true,

              cropBoxResizable: true,

              guides: true,

              center: true,

              highlight: true,

              toggleDragModeOnDblclick:
                false

            }
          );

      };

  }
);


/* =========================================================
   LECTURE DE LA PHOTO RECADRÉE
   ========================================================= */

readCrop.addEventListener(
  "click",
  async () => {

    if (!cropper) {

      cropMessage.textContent =
        "Sélectionne d'abord une zone.";

      cropMessage.className =
        "message error";

      return;

    }


    readCrop.disabled = true;

    readCrop.textContent =
      "🔎 Lecture en cours…";


    cropMessage.textContent =
      "Analyse du code-barres…";

    cropMessage.className =
      "message";


    try {

      /*
       * Génération de l'image recadrée.
       */

      const canvas =
        cropper.getCroppedCanvas({

          width: 1800,

          height: 1200,

          imageSmoothingEnabled: true,

          imageSmoothingQuality:
            "high"

        });


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
        resolve => {

          image.onload =
            resolve;

        }
      );


      /*
       * Lecture ZXing.
       */

      const result =
        await reader.decodeFromImageElement(
          image
        );


      const text =
        result.getText();


      console.log(
        "Résultat photo :",
        text
      );


      const isbn =
        findISBN(text);


      if (isbn) {

        showISBN(isbn);

        cropMessage.textContent =
          "✓ ISBN trouvé !";

        cropMessage.className =
          "message success";

      } else {

        cropMessage.textContent =
          "Le code a été lu, mais ce n'est pas un ISBN reconnu.";

        cropMessage.className =
          "message error";

      }


    } catch (error) {

      console.error(
        "Erreur lecture image :",
        error
      );


      cropMessage.textContent =
        "Code non détecté. Recadre plus précisément le code-barres et réessaie.";

      cropMessage.className =
        "message error";

    }


    readCrop.disabled = false;

    readCrop.textContent =
      "🔎 Lire le code-barres";

  }
);


/* =========================================================
   COPIER ISBN
   ========================================================= */

copyButton.addEventListener(
  "click",
  async () => {

    const value =
      isbnInput.value.trim();

    if (!value) {
      return;
    }


    try {

      await navigator.clipboard.writeText(
        value
      );

    } catch {

      isbnInput.select();

      document.execCommand(
        "copy"
      );

    }


    resultMessage.textContent =
      "✓ ISBN copié !";

    resultMessage.className =
      "message success";

  }
);


/* =========================================================
   SAISIE MANUELLE
   ========================================================= */

isbnInput.addEventListener(
  "input",
  () => {

    const value =
      clean(isbnInput.value);


    /*
     * Autoriser les recherches
     * lorsque l'utilisateur a entré
     * un ISBN-10 ou ISBN-13.
     */

    const validLength =
      value.length === 10 ||
      value.length === 13;


    vintedButton.disabled =
      !validLength;

    googleButton.disabled =
      !validLength;

  }
);


/* =========================================================
   VINTED
   ========================================================= */

vintedButton.addEventListener(
  "click",
  () => {

    const isbn =
      clean(isbnInput.value);

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
      clean(isbnInput.value);

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
   NETTOYAGE
   ========================================================= */

window.addEventListener(
  "beforeunload",
  stopCamera
);
