// Elementos del DOM
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const resultsSection = document.getElementById('resultsSection');
const resultsTable = document.getElementById('resultsTable');
const summaryText = document.getElementById('summaryText');
const loadingOverlay = document.getElementById('loadingOverlay');
const audioPlayer = document.getElementById('audioPlayer');
const playAudioButton = document.getElementById('playAudio');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeUploadHandlers();
});

function initializeUploadHandlers() {
    // Prevenir comportamiento por defecto
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Efectos visuales para drag & drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Manejadores de eventos
    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFiles, false);
    if (playAudioButton) {
        playAudioButton.addEventListener('click', toggleAudio);
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    dropZone.classList.add('dragover');
}

function unhighlight(e) {
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    const files = e.dataTransfer.files;
    handleFiles({ target: { files } });
}

async function handleFiles(e) {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) {
        showError('Por favor seleccione un archivo');
        return;
    }

    // Verificar si es PDF
    const file = files[0];
    if (!file.type.includes('pdf')) {
        showError('Por favor seleccione un archivo PDF');
        return;
    }

    showLoading(true);

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('http://127.0.0.1:3090/process_invoice', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        console.log('Respuesta del servidor:', data); // Para depuración

        if (response.ok && data.status === 'success') {
            if (data.data) {
                displayResults(data);
                if (data.audio_file) {
                    setupAudioPlayer(data.audio_file);
                }
                showSuccess('Factura procesada exitosamente');
            } else {
                throw new Error('No se recibieron datos de la factura');
            }
        } else {
            throw new Error(data.error || 'Error procesando la factura');
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Error al procesar el archivo');
    } finally {
        showLoading(false);
    }
}

function displayResults(result) {
    if (!result || !result.data) {
        showError('No se recibieron datos válidos');
        return;
    }

    resultsSection.style.display = 'block';
    
    if (result.summary) {
        summaryText.textContent = result.summary;
    } else {
        summaryText.textContent = 'No hay resumen disponible';
    }
    
    resultsTable.innerHTML = '';
    
    const data = result.data || {};
    
    Object.entries(data).forEach(([key, value]) => {
        const row = document.createElement('tr');
        let displayValue = value;

        // Formatear valores monetarios
        if (['Importe_Total', 'Valor_Venta', 'IGV', 'Descuento'].includes(key)) {
            displayValue = formatMoney(value);
        }

        row.innerHTML = `
            <td><strong>${formatKey(key)}</strong></td>
            <td>${displayValue || '-'}</td>
        `;
        resultsTable.appendChild(row);
    });

    scrollToResults();
}

function formatMoney(amount) {
    if (amount === null || amount === undefined) return '-';
    return `S/ ${parseFloat(amount).toFixed(2)}`;
}
function formatKey(key) {
    return key.replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function setupAudioPlayer(audioFile) {
    if (!audioFile) return;
    
    const audioUrl = `http://127.0.0.1:3090/audio/${audioFile}`;
    audioPlayer.src = audioUrl;
    playAudioButton.style.display = 'inline-flex';
    playAudioButton.innerHTML = '<i class="fas fa-play"></i> Escuchar Resumen';
}

function toggleAudio() {
    if (!audioPlayer.src) return;
    
    if (audioPlayer.paused) {
        audioPlayer.play();
        playAudioButton.innerHTML = '<i class="fas fa-pause"></i> Pausar Resumen';
    } else {
        audioPlayer.pause();
        playAudioButton.innerHTML = '<i class="fas fa-play"></i> Escuchar Resumen';
    }
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const alert = createAlert('error', message);
    showAlert(alert);
}

function showSuccess(message) {
    const alert = createAlert('success', message);
    showAlert(alert);
}

function createAlert(type, message) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    return alert;
}

function showAlert(alert) {
    const container = document.querySelector('.container');
    const uploadSection = document.querySelector('.upload-section');
    if (container && uploadSection) {
        container.insertBefore(alert, uploadSection);
    }

    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

function scrollToResults() {
    if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}