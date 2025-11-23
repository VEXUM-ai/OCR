const LANG = 'jpn+eng'
const WORKER_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js'
const CORE_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js'
const LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast'

const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')
const clearBtn = document.getElementById('clear-btn')
const engineStatus = document.getElementById('engine-status')
const processStatus = document.getElementById('process-status')
const progress = document.getElementById('progress')
const errorBox = document.getElementById('error')
const resultsEl = document.getElementById('results')
const totalCount = document.getElementById('total-count')

let worker = null
let workerReady = false
let processing = false

// pdf.js worker (CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.js'

clearBtn.addEventListener('click', () => {
  resultsEl.innerHTML = ''
  updateCount()
})

dropZone.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', (e) => handleFiles(e.target.files))

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropZone.classList.add('dragging')
})

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'))

dropZone.addEventListener('drop', (e) => {
  e.preventDefault()
  dropZone.classList.remove('dragging')
  handleFiles(e.dataTransfer.files)
})

async function handleFiles(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length || processing) return
  setError('')
  setProcessStatus('処理中', false)
  processing = true
  try {
    await ensureWorker()
    for (const file of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        await processPdf(file)
      } else {
        await processImage(file)
      }
    }
  } catch (err) {
    setError(err && err.message ? err.message : '処理中にエラーが発生しました')
  } finally {
    processing = false
    setProcessStatus('待機中', true)
    setProgress('-')
  }
}

async function ensureWorker() {
  if (workerReady) return
  engineStatus.textContent = '初期化中...'
  try {
    worker = await Tesseract.createWorker({
      workerPath: WORKER_PATH,
      corePath: CORE_PATH,
      langPath: LANG_PATH,
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(`${Math.round((m.progress || 0) * 100)}%`)
        }
      },
    })
    await worker.loadLanguage(LANG)
    await worker.initialize(LANG)
    workerReady = true
    engineStatus.textContent = '準備完了'
  } catch (err) {
    engineStatus.textContent = '初期化失敗'
    throw err
  }
}

async function processImage(file) {
  const dataUrl = await fileToDataUrl(file)
  await runOcr({
    source: dataUrl,
    fileName: file.name,
    pageLabel: '画像',
  })
}

async function processPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/png')
    await runOcr({
      source: dataUrl,
      fileName: file.name,
      pageLabel: `p.${i}`,
    })
  }
}

async function runOcr({ source, fileName, pageLabel }) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  addResult({ id, fileName, pageLabel, status: 'processing', text: '' })
  try {
    const { data } = await worker.recognize(source)
    updateResult(id, { status: 'done', text: (data.text || '').trim() })
  } catch (err) {
    updateResult(id, { status: 'error', text: '', error: err && err.message ? err.message : 'OCRに失敗しました' })
  }
}

function addResult({ id, fileName, pageLabel, status, text }) {
  const el = document.createElement('div')
  el.className = 'result'
  el.id = id
  el.innerHTML = `
    <div class="result-head">
      <div class="file-meta">
        <span>🧾</span>
        <div>
          <div class="pill">${escapeHtml(fileName)}</div>
          <div class="muted tiny">${escapeHtml(pageLabel)}</div>
        </div>
      </div>
      <span class="badge ${status === 'done' ? 'success' : status === 'error' ? 'danger' : ''}">
        ${statusLabel(status)}
      </span>
    </div>
    <textarea class="textarea" readonly>${text}</textarea>
    <div class="error hidden"></div>
  `
  resultsEl.prepend(el)
  updateCount()
}

function updateResult(id, { status, text, error }) {
  const el = document.getElementById(id)
  if (!el) return
  const badge = el.querySelector('.badge')
  const textarea = el.querySelector('textarea')
  const errBox = el.querySelector('.error')
  badge.textContent = statusLabel(status)
  badge.classList.remove('success', 'danger')
  if (status === 'done') {
    badge.classList.add('success')
    textarea.value = text
    errBox.classList.add('hidden')
  } else if (status === 'error') {
    badge.classList.add('danger')
    textarea.value = ''
    errBox.textContent = error || 'エラー'
    errBox.classList.remove('hidden')
  }
}

function statusLabel(status) {
  if (status === 'processing') return '処理中'
  if (status === 'done') return '完了'
  return '失敗'
}

function setProcessStatus(label, idle) {
  processStatus.textContent = label
  processStatus.classList.toggle('success', idle)
}

function setProgress(label) {
  progress.textContent = label
}

function setError(msg) {
  if (!msg) {
    errorBox.classList.add('hidden')
    errorBox.textContent = ''
  } else {
    errorBox.classList.remove('hidden')
    errorBox.textContent = msg
  }
}

function updateCount() {
  const count = resultsEl.children.length
  totalCount.textContent = `総件数: ${count}`
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('ファイル読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
