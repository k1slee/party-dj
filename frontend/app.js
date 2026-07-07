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

            setTimeout(() => {
            if (typeof showOnboarding === 'function') {
                showOnboarding();
            }
        }, 500);
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

// ============================================================
// 📋 ОПРОСНИК (РАБОЧАЯ ВЕРСИЯ)
// ============================================================

const GENRES_LIST = [
    { id: 'rock', icon: '🎸', name: 'Рок' },
    { id: 'pop', icon: '🎤', name: 'Поп' },
    { id: 'electronic', icon: '🎧', name: 'Электроника' },
    { id: 'hiphop', icon: '🎵', name: 'Хип-хоп' },
    { id: 'jazz', icon: '🎷', name: 'Джаз' },
    { id: 'classical', icon: '🎹', name: 'Классика' },
    { id: 'indie', icon: '🎸', name: 'Инди' },
    { id: 'rnb', icon: '🎤', name: 'R&B' },
    { id: 'metal', icon: '🤘', name: 'Металл' },
    { id: 'folk', icon: '🪕', name: 'Фолк' },
    { id: 'lofi', icon: '☕', name: 'Lo-Fi' },
    { id: 'disco', icon: '🕺', name: 'Диско' }
];

let onboardingState = {
    step: 1,
    genres: [],
    mood: null,
    playlistTracks: []
};

function createOnboardingModal() {
    // Проверяем, есть ли уже модалка
    if (document.getElementById('onboardingModal')) {
        return;
    }
    
    console.log('📋 Создаём опросник...');
    
    // Создаём модалку с полным содержимым
    const modal = document.createElement('div');
    modal.id = 'onboardingModal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(10px);
        z-index: 999999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(145deg, #1a1a2e, #2d2b55);
            border-radius: 24px;
            max-width: 700px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 40px 36px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 40px 80px rgba(0,0,0,0.6);
            position: relative;
        ">
            <!-- Header -->
            <div style="text-align:center;margin-bottom:30px;">
                <span style="font-size:48px;display:block;margin-bottom:8px;">🎵</span>
                <h2 style="font-size:28px;font-weight:700;background:linear-gradient(45deg,#f7971e,#ffd200);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0;">Настроим музыку под тебя</h2>
                <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:4px;">Выбери то, что тебе нравится — и мы подберем треки</p>
            </div>
            
            <!-- Progress -->
            <div style="display:flex;justify-content:center;gap:10px;margin-bottom:28px;">
                <span class="progress-dot" data-step="1" style="width:40px;height:4px;border-radius:2px;background:linear-gradient(90deg,#f7971e,#ffd200);"></span>
                <span class="progress-dot" data-step="2" style="width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);"></span>
                <span class="progress-dot" data-step="3" style="width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);"></span>
            </div>
            
            <!-- STEP 1: Genres -->
            <div class="onboarding-step" data-step="1">
                <h3 style="font-size:18px;font-weight:600;margin-bottom:16px;color:white;">🎸 Какие жанры тебе близки?</h3>
                <p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:20px;">Выбери 2-4 жанра, которые тебе нравятся</p>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;" id="genreGrid">
                    ${GENRES_LIST.map(g => `
                        <div class="genre-card" data-genre="${g.id}" style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 10px;text-align:center;cursor:pointer;transition:all 0.3s;user-select:none;">
                            <span style="font-size:28px;display:block;margin-bottom:4px;">${g.icon}</span>
                            <div style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;">${g.name}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align:center;font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:12px;">
                    Выбрано: <span id="genreCount">0</span>
                </div>
                <button id="nextStep1" disabled style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(45deg,#f7971e,#ffd200);color:#1a1a2e;font-weight:700;font-size:16px;cursor:pointer;transition:all 0.3s;margin-top:8px;opacity:0.4;cursor:not-allowed;">Продолжить →</button>
            </div>
            
            <!-- STEP 2: Mood -->
            <div class="onboarding-step" data-step="2" style="display:none;">
                <h3 style="font-size:18px;font-weight:600;margin-bottom:16px;color:white;">😊 Какое у тебя настроение сейчас?</h3>
                <p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:20px;">Это поможет подобрать музыку под твой вайб</p>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
                    <div class="mood-card" data-mood="happy" style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;text-align:center;cursor:pointer;transition:all 0.3s;font-size:16px;color:rgba(255,255,255,0.7);">
                        <span style="font-size:32px;display:block;margin-bottom:4px;">😊</span>
                        Веселое
                    </div>
                    <div class="mood-card" data-mood="sad" style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;text-align:center;cursor:pointer;transition:all 0.3s;font-size:16px;color:rgba(255,255,255,0.7);">
                        <span style="font-size:32px;display:block;margin-bottom:4px;">😢</span>
                        Меланхоличное
                    </div>
                    <div class="mood-card" data-mood="energetic" style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;text-align:center;cursor:pointer;transition:all 0.3s;font-size:16px;color:rgba(255,255,255,0.7);">
                        <span style="font-size:32px;display:block;margin-bottom:4px;">🔥</span>
                        Энергичное
                    </div>
                    <div class="mood-card" data-mood="calm" style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;text-align:center;cursor:pointer;transition:all 0.3s;font-size:16px;color:rgba(255,255,255,0.7);">
                        <span style="font-size:32px;display:block;margin-bottom:4px;">😌</span>
                        Спокойное
                    </div>
                </div>
                <button id="nextStep2" disabled style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(45deg,#f7971e,#ffd200);color:#1a1a2e;font-weight:700;font-size:16px;cursor:pointer;transition:all 0.3s;margin-top:8px;opacity:0.4;cursor:not-allowed;">Продолжить →</button>
            </div>
            
            <!-- STEP 3: Import -->
            <div class="onboarding-step" data-step="3" style="display:none;">
                <h3 style="font-size:18px;font-weight:600;margin-bottom:16px;color:white;">📂 Хочешь загрузить свой плейлист?</h3>
                <p style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:20px;">Это поможет нам точнее подобрать музыку (опционально)</p>
                
                <div style="margin:16px 0;">
                    <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:14px 16px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);">
                        <label style="display:block;font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:6px;">📁 Загрузить файл (JSON, CSV, TXT)</label>
                        <input type="file" id="playlistFile" accept=".json,.csv,.txt" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;font-size:13px;">
                        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:6px;" id="fileStatus">Файл не выбран</div>
                    </div>
                </div>
                
                <button id="finishOnboardingBtn" style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(45deg,#f7971e,#ffd200);color:#1a1a2e;font-weight:700;font-size:18px;cursor:pointer;transition:all 0.3s;">
                    🚀 Начать вечеринку!
                </button>
                <div style="text-align:center;margin-top:8px;">
                    <button id="skipOnboardingBtn" style="padding:10px 20px;border:1px solid rgba(255,255,255,0.15);border-radius:10px;background:transparent;color:rgba(255,255,255,0.6);cursor:pointer;font-size:13px;transition:all 0.3s;">
                        Пропустить → 
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Привязываем события
    bindOnboardingEvents();
    
    console.log('✅ Опросник создан!');
}

function bindOnboardingEvents() {
    // --- Жанры ---
    document.querySelectorAll('.genre-card').forEach(card => {
        card.addEventListener('click', function() {
            const genre = this.dataset.genre;
            const index = onboardingState.genres.indexOf(genre);
            
            if (index >= 0) {
                onboardingState.genres.splice(index, 1);
                this.style.borderColor = 'rgba(255,255,255,0.08)';
                this.style.background = 'rgba(255,255,255,0.05)';
            } else {
                if (onboardingState.genres.length >= 4) return;
                onboardingState.genres.push(genre);
                this.style.borderColor = '#f7971e';
                this.style.background = 'rgba(247,151,30,0.15)';
            }
            
            const countEl = document.getElementById('genreCount');
            if (countEl) countEl.textContent = onboardingState.genres.length;
            
            const nextBtn = document.getElementById('nextStep1');
            if (nextBtn) {
                if (onboardingState.genres.length >= 2) {
                    nextBtn.disabled = false;
                    nextBtn.style.opacity = '1';
                    nextBtn.style.cursor = 'pointer';
                } else {
                    nextBtn.disabled = true;
                    nextBtn.style.opacity = '0.4';
                    nextBtn.style.cursor = 'not-allowed';
                }
            }
        });
    });
    
    // --- Настроение ---
    document.querySelectorAll('.mood-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.mood-card').forEach(c => {
                c.style.borderColor = 'rgba(255,255,255,0.08)';
                c.style.background = 'rgba(255,255,255,0.05)';
            });
            this.style.borderColor = '#f7971e';
            this.style.background = 'rgba(247,151,30,0.15)';
            onboardingState.mood = this.dataset.mood;
            
            const nextBtn = document.getElementById('nextStep2');
            if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.style.opacity = '1';
                nextBtn.style.cursor = 'pointer';
            }
        });
    });
    
    // --- Кнопка "Далее" Step 1 ---
    const next1 = document.getElementById('nextStep1');
    if (next1) {
        next1.addEventListener('click', function() {
            if (onboardingState.genres.length >= 2) {
                goToStep(2);
            }
        });
    }
    
    // --- Кнопка "Далее" Step 2 ---
    const next2 = document.getElementById('nextStep2');
    if (next2) {
        next2.addEventListener('click', function() {
            if (onboardingState.mood) {
                goToStep(3);
            }
        });
    }
    
    // --- Загрузка файла ---
    const fileInput = document.getElementById('playlistFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const status = document.getElementById('fileStatus');
            if (status) {
                status.textContent = `✅ Загружено: ${file.name}`;
                status.style.color = '#4caf50';
            }
        });
    }
    
    // --- Финиш ---
    const finishBtn = document.getElementById('finishOnboardingBtn');
    if (finishBtn) {
        finishBtn.addEventListener('click', finishOnboarding);
    }
    
    // --- Пропустить ---
    const skipBtn = document.getElementById('skipOnboardingBtn');
    if (skipBtn) {
        skipBtn.addEventListener('click', skipOnboarding);
    }
}

function goToStep(step) {
    onboardingState.step = step;
    
    document.querySelectorAll('.onboarding-step').forEach(s => {
        s.style.display = 'none';
    });
    const target = document.querySelector(`.onboarding-step[data-step="${step}"]`);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.progress-dot').forEach(d => {
        const s = parseInt(d.dataset.step);
        if (s === step) {
            d.style.background = 'linear-gradient(90deg, #f7971e, #ffd200)';
        } else if (s < step) {
            d.style.background = 'rgba(247,151,30,0.4)';
        } else {
            d.style.background = 'rgba(255,255,255,0.15)';
        }
    });
}

function showOnboarding() {
    console.log('📋 Показываем опросник...');
    let modal = document.getElementById('onboardingModal');
    if (!modal) {
        createOnboardingModal();
        modal = document.getElementById('onboardingModal');
    }
    if (modal) {
        modal.style.display = 'flex';
        goToStep(1);
        console.log('✅ Опросник показан');
    }
}

function closeOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function finishOnboarding() {
    console.log('🎉 Завершаем опросник!');
    console.log('📊 Выбрано жанров:', onboardingState.genres);
    console.log('📊 Настроение:', onboardingState.mood);
    
    closeOnboarding();
    showStatus('🎵 Музыка подобрана! Наслаждайся!', 'success');
    
    if (!audioBuffer) {
        generateTestTone();
    }
}

function skipOnboarding() {
    console.log('⏭️ Пропускаем опросник');
    closeOnboarding();
    showStatus('🎵 Начинаем вечеринку!', 'success');
    
    if (!audioBuffer) {
        generateTestTone();
    }
}

// Экспортируем в глобальную область
window.showOnboarding = showOnboarding;
window.closeOnboarding = closeOnboarding;
window.finishOnboarding = finishOnboarding;
window.skipOnboarding = skipOnboarding;