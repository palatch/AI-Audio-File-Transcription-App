import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const changeFileBtn = document.getElementById('changeFileBtn');
const fileInfo = document.getElementById('fileInfo');
const fileNameEl = document.getElementById('fileName');
const startBtn = document.getElementById('startBtn');
const langSelect = document.getElementById('langSelect');
const modelSelect = document.getElementById('modelSelect');
const progressCard = document.getElementById('progressCard');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const resultCard = document.getElementById('resultCard');
const resultText = document.getElementById('resultText');
const wordCount = document.getElementById('wordCount');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');

let selectedFile = null;

// --- File selection ---
browseBtn.addEventListener('click', () => fileInput.click());
changeFileBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

['dragover', 'dragenter'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  })
);
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('audio/')) {
    alert('กรุณาเลือกไฟล์เสียงเท่านั้น');
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = `🎵 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  fileInfo.classList.remove('hidden');
  startBtn.disabled = false;
}

// --- Decode audio to 16kHz mono Float32Array (required by Whisper) ---
async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetSampleRate),
    targetSampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

// --- Transcription ---
startBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  progressCard.classList.remove('hidden');
  resultCard.classList.add('hidden');
  startBtn.disabled = true;
  updateProgress(0, 'กำลังโหลดโมเดล (ครั้งแรกอาจใช้เวลาสักครู่)...');

  try {
    const modelName = modelSelect.value;
    const transcriber = await pipeline('automatic-speech-recognition', modelName, {
      progress_callback: (data) => {
        if (data.status === 'progress' && data.file) {
          const pct = Math.round(data.progress || 0);
          updateProgress(pct * 0.6, `กำลังดาวน์โหลดโมเดล... ${pct}%`);
        }
      }
    });

    updateProgress(60, 'กำลังแปลงไฟล์เสียง...');
    const audioData = await decodeAudioFile(selectedFile);

    updateProgress(70, 'กำลังถอดเสียงเป็นข้อความ...');

    const langValue = langSelect.value;
    const options = {
      chunk_length_s: 30,     // แบ่งไฟล์ยาวเป็นช่วง 30 วิ
      stride_length_s: 5,     // overlap 5 วิ กันตัดคำตรงรอยต่อ
      return_timestamps: false,
      task: 'transcribe',
    };
    if (langValue !== 'auto') options.language = langValue;

    const output = await transcriber(audioData, options);

    updateProgress(100, 'เสร็จสิ้น!');
    showResult(output.text.trim());

  } catch (err) {
    console.error(err);
    statusText.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
  } finally {
    startBtn.disabled = false;
  }
});

function updateProgress(pct, text) {
  progressBar.style.width = pct + '%';
  statusText.textContent = text;
}

function showResult(text) {
  resultText.value = text;
  const words = text.split(/\s+/).filter(Boolean).length;
  wordCount.textContent = `${words} คำ / ${text.length} ตัวอักษร`;
  resultCard.classList.remove('hidden');
  setTimeout(() => progressCard.classList.add('hidden'), 800);
}

// --- Actions ---
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText.value);
  copyBtn.textContent = '✅ คัดลอกแล้ว';
  setTimeout(() => (copyBtn.textContent = '📋 คัดลอก'), 1500);
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([resultText.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (selectedFile?.name.replace(/\.[^.]+$/, '') || 'transcript') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  resultCard.classList.add('hidden');
  progressCard.classList.add('hidden');
  startBtn.disabled = true;
  resultText.value = '';
});