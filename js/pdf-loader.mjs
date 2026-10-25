// Loads the vendored PDF.js (v4, ES module build) and exposes it as window.pdfjsLib
// for the classic-script modules. Module scripts run before DOMContentLoaded.
import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjsLib;
