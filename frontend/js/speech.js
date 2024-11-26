class SpeechHandler {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.audioSource = null;
        this.isPlaying = false;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API no soportado:', e);
        }
    }

    async loadAudio(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error('Error cargando audio:', e);
        }
    }

    play() {
        if (!this.audioBuffer || this.isPlaying) return;

        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.audioContext.destination);
        
        this.audioSource.onended = () => {
            this.isPlaying = false;
            this.updatePlayButton();
        };

        this.audioSource.start(0);
        this.isPlaying = true;
        this.updatePlayButton();
    }

    stop() {
        if (this.audioSource && this.isPlaying) {
            this.audioSource.stop();
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }

    updatePlayButton() {
        const playButton = document.getElementById('playAudio');
        if (playButton) {
            playButton.innerHTML = this.isPlaying ? 
                '<i class="fas fa-pause"></i> Pausar Resumen' :
                '<i class="fas fa-play"></i> Escuchar Resumen';
        }
    }
}

const speechHandler = new SpeechHandler();
speechHandler.init();

// Exportar para uso en otros archivos
export default speechHandler;