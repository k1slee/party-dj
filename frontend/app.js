// ============================================================
// 🎵 PARTY DJ - РАБОЧАЯ ВЕРСИЯ (100%)
// ============================================================

console.log('🚀 Party DJ загружается...');

// ---------- КОНФИГ ----------
const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

// ---------- STATE ----------
let ws = null;
let roomId = null;
let guestId = null;
let isHost = false;
let currentBpm = 120;
let isConnected = false;

// ---------- АУДИО ----------
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let isAudioPlaying = false;
let trackOriginalBpm = 120;

// ============================================================
// ДОМ ЭЛЕМЕНТЫ
// ============================================================

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

const qrSection = document.getElementById('qrSection');
const qrCodeImage = document.getElementById('qrCodeImage');
const qrLoading = document.getElementById('qrLoading');
const joinLinkInput = document.getElementById('joinLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');

// ============================================================
// UI ФУНКЦИИ
// ============================================================

function showStatus(msg, type = '') {
    if (statusDiv) {
        statusDiv.textContent = msg;
        statusDiv.className = 'status ' + type;
    }
}

function updateBpm(bpm) {
    currentBpm = Math.round(bpm);
    if (bpmText) bpmText.textContent = currentBpm;
    if (bpmCircle) {
        bpmCircle.style.transform = 'scale(1.05)';
        setTimeout(() => { bpmCircle.style.transform = 'scale(1)'; }, 300);
    }
}

function updateGuests(guests) {
    if (!guestsList) return;
    if (!guests || guests.length === 0) {
        guestsList.innerHTML = '<div class="guest-item" style="color:rgba(255,255,255,0.4);">Нет гостей</div>';
        return;
    }
    guestsList.innerHTML = guests.map(g => `
        <div class="guest-item">
            ${g.name}${g.is_host ? ' 👑' : ''}
            <span class="mood-dot" style="background: hsl(${g.mood * 120}, 80%, 50%);"></span>
        </div>
    `).join('');
}

function updateGuestsCount(count) {
    if (guestsCount) guestsCount.textContent = `👥 ${count}`;
}

function updateMoodEmojis(value) {
    if (!moodEmojis) return;
    const emojis = ['😴', '🙂', '😊', '😄', '🔥'];
    const idx = Math.min(Math.floor(value * emojis.length), emojis.length - 1);
    moodEmojis.textContent = emojis[idx];
}

// ============================================================
// WEBSOCKET
// ============================================================

function connect() {
    console.log('🟢 connect() вызвана!');
    
    roomId = roomInput ? roomInput.value.trim() : 'party123';
    const name = nameInput ? nameInput.value.trim() : 'Гость';
    isHost = hostCheckbox ? hostCheckbox.checked : false;
    
    console.log(`🟢 roomId: "${roomId}", name: "${name}", isHost: ${isHost}`);
    
    if (!roomId) {
        showStatus('❌ Введите ID комнаты', 'error');
        return;
    }
    
    const wsUrl = `${WS_URL}/ws/${roomId}?name=${encodeURIComponent(name)}&host=${isHost}`;
    console.log(`🔗 WebSocket: ${wsUrl}`);
    showStatus('🔄 Подключение...', '');
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('✅ WebSocket ОТКРЫТ!');
        isConnected = true;
        showStatus('✅ Подключено!', 'success');
        
        if (joinScreen) joinScreen.classList.remove('active');
        if (playerScreen) playerScreen.classList.add('active');
        if (roomTitle) roomTitle.textContent = `🎵 Комната: ${roomId}`;
        
        if (isHost) {
            console.log('👑 Режим хоста');
            if (hostControls) hostControls.style.display = 'flex';
            loadQRCode();
        }
        
        initAudio();
    };
    
    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Получено:', data);
            
            if (data.type === 'init') {
                guestId = data.guest_id;
                isHost = data.is_host || isHost;
                updateBpm(data.bpm);
                updateGuests(data.guests || []);
                updateGuestsCount(data.guests_count || 0);
                if (data.current_track && trackName) trackName.textContent = data.current_track;
                if (isHost && hostControls) {
                    hostControls.style.display = 'flex';
                    loadQRCode();
                }
            }
            else if (data.type === 'state_update') {
                updateBpm(data.bpm);
                updateGuestsCount(data.guests_count);
                if (data.current_track && trackName) trackName.textContent = data.current_track;
            }
            else if (data.type === 'play_state') {
                isAudioPlaying = data.is_playing;
                if (trackStatus) trackStatus.textContent = isAudioPlaying ? '▶️ Играет' : '⏸️ Остановлено';
                if (playBtn) playBtn.textContent = isAudioPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести';
            }
            else if (data.type === 'track_change') {
                if (trackName) trackName.textContent = data.track_name;
                updateBpm(data.bpm);
            }
            else if (data.type === 'bpm_override') {
                updateBpm(data.bpm);
                showStatus(`👑 Хост зафиксировал BPM: ${data.bpm}`, 'success');
            }
        } catch(e) {
            console.error('Ошибка парсинга:', e);
        }
    };
    
    ws.onerror = function(error) {
        console.error('❌ WebSocket ОШИБКА:', error);
        showStatus('❌ Ошибка WebSocket', 'error');
    };
    
    ws.onclose = function() {
        console.log('🔴 WebSocket закрыт');
        isConnected = false;
        showStatus('🔌 Отключено', 'error');
    };
}

function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        console.log('📤 Отправлено:', msg);
    } else {
        console.log('❌ WebSocket не открыт');
    }
}

// ============================================================
// ПРИВЯЗКА КНОПОК (ГЛАВНОЕ!)
// ============================================================

// Функция для привязки всех кнопок
function bindButtons() {
    console.log('🔧 Привязываем кнопки...');
    
    // Кнопка "Войти"
    const btn = document.getElementById('connectBtn');
    if (btn) {
        // Удаляем старые обработчики
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Добавляем новый
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔘 Кнопка "Войти" НАЖАТА!');
            connect();
        });
        console.log('✅ Кнопка "Войти" привязана');
    } else {
        console.log('❌ Кнопка "Войти" не найдена!');
    }
    
    // Кнопка "Выход"
    if (leaveBtn) {
        leaveBtn.addEventListener('click', function() {
            if (ws) ws.close();
            isConnected = false;
            if (playerScreen) playerScreen.classList.remove('active');
            if (joinScreen) joinScreen.classList.add('active');
            showStatus('👋 Вы вышли', '');
        });
    }
    
    // Ползунок настроения
    if (moodSlider) {
        moodSlider.addEventListener('input', function() {
            const val = parseFloat(this.value);
            if (moodValue) moodValue.textContent = `Настроение: ${val.toFixed(2)}`;
            updateMoodEmojis(val);
            if (isConnected) {
                sendMessage({ type: 'mood', value: val });
            }
        });
    }
    
    // Кнопка "Воспроизвести"
    if (playBtn) {
        playBtn.addEventListener('click', function() {
            console.log('🔘 Кнопка "Воспроизвести" нажата');
            if (!isHost) {
                showStatus('❌ Только хост может управлять', 'error');
                return;
            }
            if (!isConnected) {
                showStatus('❌ Нет подключения', 'error');
                return;
            }
            
            if (!audioBuffer) {
                console.log('🎵 Создаем тестовый тон...');
                generateTestTone();
                if (!audioBuffer) {
                    showStatus('❌ Ошибка создания аудио', 'error');
                    return;
                }
            }
            
            if (isAudioPlaying) {
                pauseAudio();
            } else {
                playAudio();
            }
            
            sendMessage({ type: 'play' });
        });
    }
    
    // Кнопка "Зафиксировать BPM"
    if (lockBpmBtn) {
        lockBpmBtn.addEventListener('click', function() {
            console.log('🔘 Кнопка "Зафиксировать BPM" нажата');
            if (!isHost || !isConnected) return;
            
            const bpm = prompt('Введите BPM (60-190):', currentBpm);
            if (bpm) {
                const val = parseInt(bpm);
                if (val >= 60 && val <= 190) {
                    sendMessage({ type: 'set_bpm', bpm: val });
                } else {
                    alert('BPM должен быть от 60 до 190');
                }
            }
        });
    }
    
    // Копирование ссылки
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', function() {
            if (joinLinkInput && joinLinkInput.value) {
                navigator.clipboard.writeText(joinLinkInput.value)
                    .then(() => {
                        const orig = this.textContent;
                        this.textContent = '✅ Скопировано!';
                        setTimeout(() => { this.textContent = orig; }, 2000);
                    });
            }
        });
    }
}

// ============================================================
// АУДИО
// ============================================================

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🎵 AudioContext создан');
    }
}

function generateTestTone() {
    try {
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
        if (trackName) trackName.textContent = '🎵 Тестовый тон 440Hz';
        console.log('✅ Тестовый тон создан');
    } catch(e) {
        console.error('Ошибка создания тона:', e);
    }
}

function playAudio() {
    if (!audioBuffer) return;
    if (isAudioPlaying) { pauseAudio(); return; }
    
    try {
        initAudio();
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.loop = true;
        const speed = currentBpm / trackOriginalBpm;
        sourceNode.playbackRate.value = Math.max(0.5, Math.min(2.0, speed));
        sourceNode.connect(audioContext.destination);
        sourceNode.start(0);
        isAudioPlaying = true;
        if (trackStatus) trackStatus.textContent = '▶️ Играет';
        if (playBtn) playBtn.textContent = '⏸️ Пауза';
        console.log('▶️ Воспроизведение запущено');
    } catch(e) {
        console.error('Ошибка воспроизведения:', e);
    }
}

function pauseAudio() {
    if (!isAudioPlaying || !sourceNode) return;
    try {
        sourceNode.stop();
        sourceNode.disconnect();
        sourceNode = null;
        isAudioPlaying = false;
        if (trackStatus) trackStatus.textContent = '⏸️ На паузе';
        if (playBtn) playBtn.textContent = '▶️ Воспроизвести';
        console.log('⏸️ Пауза');
    } catch(e) {
        console.error('Ошибка паузы:', e);
    }
}

function loadCustomTrack() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const url = URL.createObjectURL(file);
            initAudio();
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            trackOriginalBpm = 120;
            if (trackName) trackName.textContent = file.name;
            if (isHost) {
                sendMessage({
                    type: 'set_track',
                    track_name: file.name,
                    track_url: url,
                    bpm: 120
                });
            }
            console.log('✅ Трек загружен:', file.name);
        } catch(err) {
            console.error('Ошибка загрузки:', err);
        }
    };
    input.click();
}

// ============================================================
// QR-КОД
// ============================================================

async function loadQRCode() {
    if (!isHost) return;
    try {
        if (qrSection) qrSection.style.display = 'block';
        if (qrLoading) qrLoading.style.display = 'block';
        if (qrCodeImage) qrCodeImage.style.display = 'none';
        
        const frontendPort = window.location.port || '80';
        const frontendUrl = `http://localhost:${frontendPort}`;
        const url = `${API_URL}/api/room/${roomId}/qr?base_url=${encodeURIComponent(frontendUrl)}`;
        
        console.log('📡 Запрос QR:', url);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            if (qrCodeImage) {
                qrCodeImage.src = `data:image/png;base64,${data.qr_code}`;
                qrCodeImage.style.display = 'block';
            }
            if (qrLoading) qrLoading.style.display = 'none';
            if (joinLinkInput) joinLinkInput.value = data.join_link;
        }
    } catch (error) {
        console.error('Ошибка QR:', error);
        if (qrLoading) qrLoading.textContent = '❌ Ошибка';
    }
}

// ============================================================
// ДОБАВЛЯЕМ КНОПКУ ЗАГРУЗКИ MP3
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен!');
    
    // Привязываем все кнопки
    bindButtons();
    
    // Добавляем кнопку загрузки MP3
    const container = document.querySelector('.host-controls');
    if (container) {
        const btn = document.createElement('button');
        btn.className = 'btn-control secondary';
        btn.textContent = '📁 Загрузить MP3';
        btn.style.marginTop = '8px';
        btn.addEventListener('click', loadCustomTrack);
        container.appendChild(btn);
    }
    
    // Автовход по ссылке
    const path = window.location.pathname;
    const match = path.match(/\/join\/(.+)/);
    if (match && roomInput) {
        roomInput.value = match[1];
        console.log(`🔗 Автовход в комнату: ${match[1]}`);
        setTimeout(connect, 500);
    }
    
    console.log('✅ Party DJ полностью загружен!');
    console.log('👉 Нажмите кнопку "Войти" для подключения');
});