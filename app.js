"use strict";

/*
 * ISBN → Vinted
 *
 * Application personnelle permettant :
 * - de scanner un code-barres de livre
 * - d'identifier un ISBN
 * - de rechercher automatiquement cet ISBN sur Vinted
 */

// ================================
// DOM
// ================================

const readerElement = document.getElementById("reader");
const placeholderElement = document.getElementById("scanner-placeholder");

const startButton = document.getElementById("start-scanner");
const stopButton = document.getElementById("stop-scanner");

const isbnInput = document.getElementById("isbn");
const clearIsbnButton = document.getElementById("clear-isbn");

const statusElement = document.getElementById("isbn-status");
const vintedButton = document.getElementById("vinted-search");

const historyElement = document.getElementById("history");
const clearHistoryButton = document.getElementById("clear-history");

// ================================
// STATE
// ================================

let scanner = null;
let scannerRunning = false;

const HISTORY_KEY = "isbn-vinted-history";

// ================================
// ISBN
// ================================

function cleanISBN(value) {
  return value
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
}


/**
 * Vérifie un ISBN-10.
 */
function isValidISBN10(isbn) {
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 10; i++) {
    const value = isbn[i] === "X"
      ? 10
      : Number(isbn[i]);

    sum += value * (10 - i);
  }

  return sum % 11 === 0;
}


/**
 * Vérifie un ISBN-13.
 */
function isValidISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 12; i++) {
    const digit = Number(isbn[i]);

    sum += i % 2 === 0
      ? digit
      : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === Number(isbn[12]);
}


/**
 * Convertit un ISBN-10 en ISBN-13.
 */
function isbn10To13(isbn10) {
  const base = "978" + isbn10.substring(0, 9);

  let sum = 0;

  for (let i = 0; i < 12; i++) {
    const digit = Number(base[i]);

    sum += i % 2 === 0
      ? digit
      : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  return base + checkDigit;
}


/**
 * Retourne un ISBN-13 normalisé si possible.
 */
function normalizeISBN(value) {
  const isbn = cleanISBN(value);

  if (isValidISBN13(isbn)) {
    return isbn;
  }

  if (isValidISBN10(isbn)) {
    return isbn10To13(isbn);
  }

  return null;
}


// ================================
// UI ISBN
// ================================

function updateISBNStatus() {
  const value = isbnInput.value.trim();

  if (!value) {
    statusElement.textContent = "";
    statusElement.className = "status";

    vintedButton.disabled = true;

    return;
  }

  const isbn = normalizeISBN(value);

  if (isbn) {
    statusElement.textContent = `ISBN valide : ${isbn}`;
    statusElement.className = "status valid";

    vintedButton.disabled = false;

    return;
  }

  statusElement.textContent = "ISBN invalide ou incomplet";
  statusElement.className = "status invalid";

  vintedButton.disabled = true;
}


// ================================
// VINTED
// ================================

function searchVinted(isbn) {
  const normalizedISBN = normalizeISBN(isbn);

  if (!normalizedISBN) {
    return;
  }

  const url =
    `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(normalizedISBN)}`;

  addToHistory(normalizedISBN);

  window.open(url, "_blank");
}


// ================================
// HISTORY
// ================================

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
  let history = getHistory();

  // Évite les doublons.
  history = history.filter(item => item !== isbn);

  // Le plus récent en premier.
  history.unshift(isbn);

  // On conserve les 10 derniers.
  history = history.slice(0, 10);

  saveHistory(history);

  renderHistory();
}


function renderHistory() {
  const history = getHistory();

  if (history.length === 0) {
    historyElement.innerHTML =
      `<p class="empty-history">Aucun scan pour le moment.</p>`;

    return;
  }

  historyElement.innerHTML = "";

  history.forEach(isbn => {

    const item = document.createElement("div");
    item.className = "history-item";

    const isbnText = document.createElement("span");
    isbnText.className = "history-isbn";
    isbnText.textContent = isbn;

    const searchButton = document.createElement("button");
    searchButton.className = "history-search";
    searchButton.textContent = "Vinted";

    searchButton.addEventListener("click", () => {
      searchVinted(isbn);
    });

    item.appendChild(isbnText);
    item.appendChild(searchButton);

    historyElement.appendChild(item);
  });
}


// ================================
// SCANNER
// ================================

async function startScanner() {

  if (scannerRunning) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    alert(
      "Le scanner n'est pas encore chargé. Vérifie ta connexion Internet puis réessaie."
    );

    return;
  }

  scanner = new Html5Qrcode("reader");

  readerElement.style.display = "block";
  placeholderElement.classList.add("hidden");

  startButton.classList.add("hidden");
  stopButton.classList.remove("hidden");

  scannerRunning = true;

  const config = {
    fps: 10,

    qrbox: {
      width: 280,
      height: 120
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
        facingMode: "environment"
      },
      config,
      onScanSuccess,
      onScanFailure
    );

  } catch (error) {

    console.error(error);

    stopScanner();

    alert(
      "Impossible d'accéder à la caméra.\n\n" +
      "Vérifie que ton navigateur a l'autorisation d'utiliser la caméra."
    );
  }
}


async function stopScanner() {

  if (!scanner || !scannerRunning) {
    resetScannerUI();
    return;
  }

  try {
    await scanner.stop();
  } catch (error) {
    console.warn("Erreur lors de l'arrêt du scanner :", error);
  }

  try {
    scanner.clear();
  } catch (error) {
    console.warn("Erreur lors du nettoyage du scanner :", error);
  }

  scanner = null;
  scannerRunning = false;

  resetScannerUI();
}


function resetScannerUI() {
  readerElement.style.display = "none";
  placeholderElement.classList.remove("hidden");

  startButton.classList.remove("hidden");
  stopButton.classList.add("hidden");
}


// ================================
// SCAN CALLBACKS
// ================================

function onScanSuccess(decodedText) {

  console.log("Code détecté :", decodedText);

  const isbn = normalizeISBN(decodedText);

  if (!isbn) {
    statusElement.textContent =
      `Code détecté (${decodedText}), mais ce n'est pas un ISBN valide.`;

    statusElement.className = "status invalid";

    return;
  }

  // Remplit automatiquement le champ.
  isbnInput.value = isbn;

  updateISBNStatus();

  // Arrêt du scanner.
  stopScanner();

  // Petit délai pour laisser voir le résultat.
  setTimeout(() => {
    searchVinted(isbn);
  }, 300);
}


function onScanFailure(errorMessage) {
  // Les erreurs de scan sont normales :
  // la caméra essaie plusieurs images par seconde.
}


// ================================
// EVENTS
// ================================

startButton.addEventListener("click", startScanner);

stopButton.addEventListener("click", stopScanner);


isbnInput.addEventListener("input", () => {

  // Nettoyage léger pendant la saisie.
  const cleaned = isbnInput.value.replace(/[^0-9Xx-]/g, "");

  if (isbnInput.value !== cleaned) {
    isbnInput.value = cleaned;
  }

  updateISBNStatus();
});


isbnInput.addEventListener("keydown", event => {

  if (event.key === "Enter") {

    const isbn = normalizeISBN(isbnInput.value);

    if (isbn) {
      searchVinted(isbn);
    }
  }
});


vintedButton.addEventListener("click", () => {

  const isbn = normalizeISBN(isbnInput.value);

  if (isbn) {
    searchVinted(isbn);
  }
});


clearIsbnButton.addEventListener("click", () => {

  isbnInput.value = "";

  updateISBNStatus();

  isbnInput.focus();
});


clearHistoryButton.addEventListener("click", () => {

  localStorage.removeItem(HISTORY_KEY);

  renderHistory();
});


// ================================
// INITIALISATION
// ================================

renderHistory();
updateISBNStatus();
