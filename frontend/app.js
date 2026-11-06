const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeBtn = document.getElementById('removeBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingState = document.getElementById('loadingState');
const results = document.getElementById('results');

let selectedFile = null;

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('border-cyan-500');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-cyan-500'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('border-cyan-500');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file.');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    dropzone.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    results.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

removeBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  previewContainer.classList.add('hidden');
  dropzone.classList.remove('hidden');
  results.classList.add('hidden');
});

analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile || !imagePreview.src) return;

  // Extract pure base64 data without data-URL header
  const base64Data = imagePreview.src.split(',')[1];

  previewContainer.classList.add('hidden');
  loadingState.classList.remove('hidden');

  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Data,
        mimeType: selectedFile.type
      })
    });

    const data = await res.json();
    loadingState.classList.add('hidden');
    previewContainer.classList.remove('hidden');

    if (!res.ok) throw new Error(data.error || 'Audit failed');

    renderResults(data);
  } catch (err) {
    loadingState.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    alert(`Audit Error: ${err.message}`);
  }
});

function renderResults(report) {
  document.getElementById('scoreBadge').textContent = `${report.score}/100`;
  
  const strengthsUl = document.getElementById('strengthsList');
  strengthsUl.innerHTML = '';
  (report.strengths || []).forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    strengthsUl.appendChild(li);
  });

  const improvUl = document.getElementById('improvementsList');
  improvUl.innerHTML = '';
  (report.improvements || []).forEach(i => {
    const li = document.createElement('li');
    li.textContent = i;
    improvUl.appendChild(li);
  });

  document.getElementById('actionItems').textContent = report.actionItems || 'No direct action items generated.';
  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth' });
}