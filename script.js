// ============ CONFIG ============
// GANTI dengan web app URL Apps Script Anda (lihat instruksi di bawah)
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxHnOBksObNPz8xWKGYE7gvHcpb0EXlTecmV9X8THV97VHBrJXdORGf9jjEuPlbbTsS/exec";
const API_TOKEN = "https://docs.google.com/spreadsheets/d/1PzmzYW7ULvlpig6IoDngwt5xG5ahdZtnXUA9p3d4pcw/edit?usp=sharing";
// ================================

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const detectedArea = document.getElementById("detectedArea");
const codeInput = document.getElementById("codeInput");
const typeInput = document.getElementById("typeInput");
const noteInput = document.getElementById("noteInput");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const refreshListBtn = document.getElementById("refreshList");
const tableBody = document.querySelector("#sheetTable tbody");

let stream = null;
let scanning = false;
let scanInterval = null;

async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}, audio:false});
    video.srcObject = stream;
    await video.play();
    statusEl.textContent = "Status: Kamera aktif, menunggu hasil...";
    scanning = true;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    scanInterval = requestAnimationFrame(tick);
    startBtn.disabled = true;
    stopBtn.disabled = false;
  }catch(err){
    console.error(err);
    statusEl.textContent = "Status: Gagal akses kamera — " + err.message;
    alert("Error akses kamera: " + err.message);
  }
}

function stopCamera(){
  scanning = false;
  if(stream){
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if(scanInterval) cancelAnimationFrame(scanInterval);
  statusEl.textContent = "Status: Kamera dihentikan";
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

function tick(){
  if(!scanning) return;
  if(video.readyState === video.HAVE_ENOUGH_DATA){
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {inversionAttempts:"attemptBoth"});
    if(code){
      // Tampilkan hasil
      detectedArea.textContent = `Terdeteksi: ${code.data}`;
      codeInput.value = code.data;
      statusEl.textContent = "Status: QR terdeteksi!";
      // Opsional: hentikan scanning otomatis (komentar jika mau terus scan)
      // stopCamera();
    } else {
      statusEl.textContent = "Status: Mencari QR...";
    }
  }
  scanInterval = requestAnimationFrame(tick);
}

// Save to Google Sheet via Web App POST
async function saveToSheet(dataObj){
  statusEl.textContent = "Status: Menyimpan ke Sheet...";
  try{
    const payload = { token: API_TOKEN, ...dataObj };
    const res = await fetch(WEB_APP_URL, {
      method:"POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if(j.status === "ok"){
      statusEl.textContent = "Status: Tersimpan ✅";
      fetchSheetData(); // refresh list
    } else {
      statusEl.textContent = "Status: Gagal menyimpan: " + (j.message || JSON.stringify(j));
      console.warn("Save response:", j);
      alert("Gagal menyimpan: " + (j.message || JSON.stringify(j)));
    }
  }catch(err){
    console.error(err);
    statusEl.textContent = "Status: Error saat menyimpan — " + err.message;
    alert("Error saat menyimpan: " + err.message);
  }
}

// Fetch list (GET)
async function fetchSheetData(){
  try{
    statusEl.textContent = "Status: Mengambil data dari Sheet...";
    const res = await fetch(`${WEB_APP_URL}?token=${API_TOKEN}`);
    const j = await res.json();
    if(j.status === "ok" && Array.isArray(j.rows)){
      populateTable(j.rows);
      statusEl.textContent = "Status: Data terambil";
    } else {
      statusEl.textContent = "Status: Gagal ambil data";
      console.warn("Fetch response:", j);
    }
  }catch(err){
    console.error(err);
    statusEl.textContent = "Status: Error ambil data — " + err.message;
  }
}

function populateTable(rows){
  // rows: array of arrays, pertama adalah header (jika ada).
  tableBody.innerHTML = "";
  // skip header if appears as first row with string 'Timestamp' for example
  const startIndex = (rows.length && rows[0].some(cell=>String(cell).toLowerCase().includes("timestamp"))) ? 1 : 0;
  const toShow = rows.slice(startIndex).reverse(); // show latest first
  toShow.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx+1}</td>
      <td>${r[0]||""}</td>
      <td>${r[1]||""}</td>
      <td>${r[2]||""}</td>
      <td>${r[3]||""}</td>`;
    tableBody.appendChild(tr);
  });
}

// UI Events
startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
clearBtn.addEventListener("click", ()=>{ codeInput.value=""; typeInput.value=""; noteInput.value=""; detectedArea.textContent="Belum ada hasil";});
saveBtn.addEventListener("click", ()=>{
  const code = codeInput.value.trim();
  if(!code){ alert("Masukkan hasil scan atau kode terlebih dahulu."); return; }
  const payload = {
    code,
    type: typeInput.value.trim() || "QR",
    note: noteInput.value.trim() || ""
  };
  saveToSheet(payload);
});
refreshListBtn.addEventListener("click", fetchSheetData);

// init
fetchSheetData();
