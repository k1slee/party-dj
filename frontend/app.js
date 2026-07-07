// ============================================================
// 🔧 КОНФИГУРАЦИЯ (универсальная)
// ============================================================

const CONFIG = {
    // Бэкенд API (можно менять под свои нужды)
    apiUrl: 'http://localhost:8000',
    
    // URL фронтенда (определяется автоматически)
    get frontendUrl() {
        const port = window.location.port || '80';
        return `${window.location.protocol}//${window.location.hostname}:${port}`;
    },
    
    // Генерация ссылки для приглашения
    getJoinLink(roomId) {
        return `${this.frontendUrl}/join/${roomId}`;
    },
    
    // WebSocket URL
    getWebSocketUrl(roomId, name, isHost) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Используем хост бэкенда (без порта)
        const host = this.apiUrl.replace(/^https?:\/\//, '').split(':')[0];
        return `${wsProtocol}//${host}:8000/ws/${roomId}?name=${encodeURIComponent(name)}&host=${isHost}`;
    }
};

console.log('🔧 Party DJ Конфигурация:', {
    apiUrl: CONFIG.apiUrl,
    frontendUrl: CONFIG.frontendUrl
});

// ============================================================
// 🎵 PARTY DJ - КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

// ---------- STATE ----------
let ws = null;
let roomId = null;
let guestId = null;
let isHost = false;
let currentBpm = 120;
let isConnected = false;

// ---------- DOM ----------
const joinScreen = document.getElementById('joinScreen');
const playerScreen = document.getElementById('playerScreen');
const roomInput = document.getElementById('roomInput');
const nameInput = document.getElementById('nameInput');
const hostCheckbox = document.getElementById('hostCheckbox');
const connectBtn = document.getElementById('connectBtn');
const statusDiv = document.getElementById('status');
const leaveBtn = document.getElementById('leaveBtn');

const roomTitle = document.getElementById('roomTitle');
const guestsCount = document.getElementById('guestsCount');
const bpmText = document.getElementById('bpmText');
const bpmCircle = document.getElementById('bpmCircle');
const trackName = document.getElementById('trackName');
const trackStatus = document.getElementById('trackStatus');
const moodSlider = document.getElementById('moodSlider');
const moodValue = document.getElementById('moodValue');
const moodEmojis = document.getElementById('moodEmojis');
const guestsList = document.getElementById('guestsList');

const hostControls = document.getElementById('hostControls');
const playBtn = document.getElementById('playBtn');
const lockBpmBtn = document.getElementById('lockBpmBtn');

// ---------- AUDIO STATE ----------
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let gainNode = null;
let isAudioPlaying = false;
let trackOriginalBpm = 120;
let trackPauseTime = 0;
let trackStartTime = 0;

// ---------- QR DOM ----------
const qrSection = document.getElementById('qrSection');
const qrCodeImage = document.getElementById('qrCodeImage');
const qrLoading = document.getElementById('qrLoading');
const joinLinkInput = document.getElementById('joinLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');

// ============================================================
// UI HELPERS
// ============================================================

function showStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
}

function updateBpm(bpm) {
    currentBpm = Math.round(bpm);
    bpmText.textContent = currentBpm;
    
    bpmCircle.style.transition = 'all 0.3s ease';
    bpmCircle.style.transform = 'scale(1.05)';
    setTimeout(() => {
        bpmCircle.style.transform = 'scale(1)';
    }, 300);
}

function updateGuests(guests) {
    if (!guests || guests.length === 0) {
        guestsList.innerHTML = '<div class="guest-item" style="color:rgba(255,255,255,0.4);">Нет гостей</div>';
        return;
    }
    
    guestsList.innerHTML = guests.map(g => `
        <div class="guest-item">
            ${g.name}${g.is_host ? ' <span class="host-badge">👑</span>' : ''}
            <span class="mood-dot" style="background: hsl(${g.mood * 120}, 80%, 50%);"></span>
        </div>
    `).join('');
}

function updateMoodEmojis(value) {
    const emojis = ['😴', '🙂', '😊', '😄', '🔥'];
    const index = Math.min(Math.floor(value * emojis.length), emojis.length - 1);
    moodEmojis.textContent = emojis[index];
}

function updateGuestsCount(count) {
    guestsCount.textContent = `👥 ${count}`;
}

// ============================================================
// WEBSOCKET
// ============================================================

function connect() {
    roomId = roomInput.value.trim() || 'party123';
    const name = nameInput.value.trim() || 'Гость';
    isHost = hostCheckbox.checked;
    
    if (!roomId) {
        showStatus('❌ Введите ID комнаты', 'error');
        return;
    }
    
    // Используем CONFIG для WebSocket URL
    const wsUrl = CONFIG.getWebSocketUrl(roomId, name, isHost);
    
    console.log('🔗 WebSocket URL:', wsUrl);
    showStatus('🔄 Подключение...', '');
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        isConnected = true;
        showStatus('✅ Подключено к комнате', 'success');
        joinScreen.classList.remove('active');
        playerScreen.classList.add('active');
        roomTitle.textContent = `🎵 Комната: ${roomId}`;
        if (isHost) {
            hostControls.style.display = 'flex';
            loadQRCode();
        }
        initAudio();
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('Ошибка парсинга:', e);
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket ошибка:', error);
        showStatus('❌ Ошибка WebSocket. Проверьте, что сервер запущен.', 'error');
    };
    
    ws.onclose = () => {
        isConnected = false;
        showStatus('🔌 Отключено от сервера', 'error');
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'init':
            guestId = data.guest_id;
            isHost = data.is_host || isHost;
            updateBpm(data.bpm);
            updateGuests(data.guests || []);
            updateGuestsCount(data.guests_count || 0);
            if (data.current_track) {
                trackName.textContent = data.current_track;
            }
            if (isHost) {
                hostControls.style.display = 'flex';
                loadQRCode();
            }
            break;
        case 'state_update':
            updateBpm(data.bpm);
            updateGuestsCount(data.guests_count);
            if (data.current_track) {
                trackName.textContent = data.current_track;
            }
            break;
        case 'bpm_override':
            updateBpm(data.bpm);
            showStatus(`👑 Хост зафиксировал BPM: ${data.bpm}`, 'success');
            break;
        case 'bpm_release':
            updateBpm(data.bpm);
            showStatus(`👑 Хост отменил фиксацию BPM`, '');
            break;
        case 'mood_confirmed':
            break;
        case 'play_state':
            isAudioPlaying = data.is_playing;
            trackStatus.textContent = isAudioPlaying ? '▶️ Играет' : '⏸️ Остановлено';
            playBtn.textContent = isAudioPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести';
            break;
        case 'track_change':
            trackName.textContent = data.track_name;
            updateBpm(data.bpm);
            break;
        default:
            console.log('Неизвестное сообщение:', data);
    }
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// ============================================================
// MOOD CONTROLS
// ============================================================

moodSlider.addEventListener('input', () => {
    const value = parseFloat(moodSlider.value);
    moodValue.textContent = `Настроение: ${value.toFixed(2)}`;
    updateMoodEmojis(value);
    if (isConnected) {
        sendMessage({ type: 'mood', value: value });
    }
});

// ============================================================
// HOST CONTROLS
// ============================================================

playBtn.addEventListener('click', () => {
    if (isHost && isConnected) {
        if (!audioBuffer) {
            generateTestTone();
        }
        if (isAudioPlaying) {
            pauseTrack();
        } else {
            playTrack();
        }
        sendMessage({ type: 'play' });
    }
});

lockBpmBtn.addEventListener('click', () => {
    if (isHost && isConnected) {
        const bpm = prompt('Введите фиксированный BPM (60-190):', currentBpm);
        if (bpm !== null) {
            const value = parseInt(bpm);
            if (value >= 60 && value <= 190) {
                sendMessage({ type: 'set_bpm', bpm: value });
            } else {
                alert('BPM должен быть от 60 до 190');
            }
        }
    }
});

leaveBtn.addEventListener('click', () => {
    if (ws) {
        ws.close();
    }
    isConnected = false;
    playerScreen.classList.remove('active');
    joinScreen.classList.add('active');
    showStatus('👋 Вы вышли из комнаты', '');
});

// ============================================================
// QR-КОДЫ (исправлено с CONFIG)
// ============================================================

async function loadQRCode() {
    if (!isHost) return;
    try {
        qrSection.style.display = 'block';
        qrLoading.style.display = 'block';
        qrCodeImage.style.display = 'none';
        
        // Используем CONFIG для URL
        const frontendUrl = CONFIG.frontendUrl;
        const url = `${CONFIG.apiUrl}/api/room/${roomId}/qr?base_url=${encodeURIComponent(frontendUrl)}`;
        
        console.log('📡 Запрос QR:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            qrCodeImage.src = `data:image/png;base64,${data.qr_code}`;
            qrCodeImage.style.display = 'block';
            qrLoading.style.display = 'none';
            joinLinkInput.value = data.join_link;
            console.log('✅ QR-код загружен:', data.join_link);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки QR:', error);
        qrLoading.textContent = '❌ Ошибка загрузки';
    }
}

copyLinkBtn.addEventListener('click', () => {
    const link = joinLinkInput.value;
    if (link) {
        navigator.clipboard.writeText(link)
            .then(() => {
                const original = copyLinkBtn.textContent;
                copyLinkBtn.textContent = '✅ Скопировано!';
                setTimeout(() => { copyLinkBtn.textContent = original; }, 2000);
            })
            .catch(() => {
                joinLinkInput.select();
                document.execCommand('copy');
            });
    }
});

// ============================================================
// АУДИО-ДВИЖОК
// ============================================================

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.8;
    }
}

async function loadTrack(url) {
    try {
        initAudio();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        trackOriginalBpm = 120;
        console.log('✅ Трек загружен');
        return true;
    } catch (error) {
        console.error('❌ Ошибка загрузки трека:', error);
        return false;
    }
}

function playTrack() {
    if (!audioBuffer) {
        generateTestTone();
        return;
    }
    if (isAudioPlaying) {
        pauseTrack();
        return;
    }
    initAudio();
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = true;
    const speed = currentBpm / trackOriginalBpm;
    sourceNode.playbackRate.value = Math.max(0.5, Math.min(2.0, speed));
    sourceNode.connect(gainNode);
    trackStartTime = audioContext.currentTime - trackPauseTime;
    sourceNode.start(0, trackPauseTime);
    isAudioPlaying = true;
    trackStatus.textContent = '▶️ Играет';
    playBtn.textContent = '⏸️ Пауза';
    sourceNode.onended = () => {
        if (isAudioPlaying) {
            isAudioPlaying = false;
            trackStatus.textContent = '⏹️ Закончился';
            playBtn.textContent = '▶️ Воспроизвести';
        }
    };
}

function pauseTrack() {
    if (!isAudioPlaying || !sourceNode) return;
    trackPauseTime = audioContext.currentTime - trackStartTime;
    sourceNode.stop();
    sourceNode.disconnect();
    sourceNode = null;
    isAudioPlaying = false;
    trackStatus.textContent = '⏸️ На паузе';
    playBtn.textContent = '▶️ Воспроизвести';
}

function generateTestTone() {
    initAudio();
    const sampleRate = 44100;
    const duration = 10;
    const bufferSize = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
    }
    audioBuffer = buffer;
    trackOriginalBpm = 120;
    trackName.textContent = '🎵 Тестовый тон 440Hz';
    console.log('✅ Сгенерирован тестовый тон');
}

function loadCustomTrack() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const success = await loadTrack(url);
        if (success && isHost) {
            trackName.textContent = file.name;
            sendMessage({
                type: 'set_track',
                track_name: file.name,
                track_url: url,
                bpm: 120
            });
        }
    };
    input.click();
}

// ============================================================
// АВТОМАТИЧЕСКИЙ ВХОД ПО ССЫЛКЕ
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    // Обработка URL вида /join/room_id
    const path = window.location.pathname;
    const match = path.match(/\/join\/(.+)/);
    if (match) {
        const roomId = match[1];
        roomInput.value = roomId;
        showStatus(`🔄 Автоматическое подключение к комнате ${roomId}...`, '');
        setTimeout(connect, 500);
    }
    
    // Добавляем кнопку загрузки MP3 (для хоста)
    const controlsContainer = document.querySelector('.host-controls');
    if (controlsContainer) {
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn-control secondary';
        loadBtn.textContent = '📁 Загрузить MP3';
        loadBtn.style.marginTop = '8px';
        loadBtn.addEventListener('click', loadCustomTrack);
        controlsContainer.appendChild(loadBtn);
    }
});

console.log('🎵 Party DJ клиент готов!');
console.log('🔧 Используйте порт:', window.location.port || '80');