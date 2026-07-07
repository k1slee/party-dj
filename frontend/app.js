// ============================================================
// 🎵 PARTY DJ - Клиентская логика
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

// ---------- AUDIO (Web Audio API) ----------
let audioContext = null;
let audioBuffer = null;
let sourceNode = null;
let gainNode = null;
let isPlaying = false;
let originalBpm = 120;
let audioFileUrl = null;

// ---------- UI HELPERS ----------
function showStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
}

function updateBpm(bpm) {
    currentBpm = Math.round(bpm);
    bpmText.textContent = currentBpm;
    
    // Анимация пульса
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

// ---------- WEBSOCKET ----------
function connect() {
    roomId = roomInput.value.trim() || 'party123';
    const name = nameInput.value.trim() || 'Гость';
    isHost = hostCheckbox.checked;
    
    if (!roomId) {
        showStatus('❌ Введите ID комнаты', 'error');
        return;
    }
    
    // URL для WebSocket
    const wsUrl = `ws://localhost:8000/ws/${roomId}?name=${encodeURIComponent(name)}&host=${isHost}`;
    
    showStatus('🔄 Подключение...', '');
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        isConnected = true;
        showStatus('✅ Подключено к комнате', 'success');
        
        // Показываем плеер
        joinScreen.classList.remove('active');
        playerScreen.classList.add('active');
        
        roomTitle.textContent = `🎵 Комната: ${roomId}`;
        
        // Показываем хост-контролы
        if (isHost) {
            hostControls.style.display = 'flex';
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('Ошибка парсинга:', e);
        }
    };
    
    ws.onerror = () => {
        showStatus('❌ Ошибка подключения к серверу', 'error');
    };
    
    ws.onclose = () => {
        isConnected = false;
        showStatus('🔌 Отключено от сервера', 'error');
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'init':
            // Инициализация
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
            }
            break;
            
        case 'state_update':
            // Обновление состояния
            updateBpm(data.bpm);
            updateGuestsCount(data.guests_count);
            
            if (data.current_track) {
                trackName.textContent = data.current_track;
            }
            
            // Обновляем список гостей (если есть)
            if (data.guests) {
                updateGuests(data.guests);
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
            // Подтверждение настроения
            break;
            
        case 'play_state':
            isPlaying = data.is_playing;
            trackStatus.textContent = isPlaying ? '▶️ Играет' : '⏸️ Остановлено';
            playBtn.textContent = isPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести';
            break;
            
        case 'track_change':
            trackName.textContent = data.track_name;
            updateBpm(data.bpm);
            break;
            
        default:
            console.log('Неизвестное сообщение:', data);
    }
}

// ---------- ОТПРАВКА СООБЩЕНИЙ ----------
function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// ---------- УПРАВЛЕНИЕ НАСТРОЕНИЕМ ----------
moodSlider.addEventListener('input', () => {
    const value = parseFloat(moodSlider.value);
    moodValue.textContent = `Настроение: ${value.toFixed(2)}`;
    updateMoodEmojis(value);
    
    if (isConnected) {
        sendMessage({
            type: 'mood',
            value: value
        });
    }
});

// ---------- УПРАВЛЕНИЕ ХОСТА ----------
playBtn.addEventListener('click', () => {
    if (isHost && isConnected) {
        sendMessage({ type: 'play' });
    }
});

lockBpmBtn.addEventListener('click', () => {
    if (isHost && isConnected) {
        const bpm = prompt('Введите фиксированный BPM (60-190):', currentBpm);
        if (bpm !== null) {
            const value = parseInt(bpm);
            if (value >= 60 && value <= 190) {
                sendMessage({
                    type: 'set_bpm',
                    bpm: value
                });
            } else {
                alert('BPM должен быть от 60 до 190');
            }
        }
    }
});

// ---------- ВЫХОД ----------
leaveBtn.addEventListener('click', () => {
    if (ws) {
        ws.close();
    }
    isConnected = false;
    playerScreen.classList.remove('active');
    joinScreen.classList.add('active');
    showStatus('👋 Вы вышли из комнаты', '');
});

// ---------- ПОДКЛЮЧЕНИЕ ----------
connectBtn.addEventListener('click', connect);

// Enter для быстрого подключения
roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connect();
});
nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connect();
});

// ============================================================
// 🎵 АУДИО-ДВИЖОК (Web Audio API)
// ============================================================

// ---------- АУДИО СОСТОЯНИЕ ----------
let audioCtx = null;
let audioBuffer = null;
let audioSource = null;
let gainNode = null;
let isAudioPlaying = false;
let currentTrackUrl = null;
let trackOriginalBpm = 120;
let trackStartTime = 0;
let trackPauseTime = 0;
let audioFiles = [];

// ---------- ИНИЦИАЛИЗАЦИЯ АУДИО ----------
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 0.8;
        console.log('🎵 AudioContext инициализирован');
    }
}

// ---------- ЗАГРУЗКА ТРЕКА ----------
async function loadTrack(url) {
    try {
        initAudio();
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        // Определяем BPM (пока жестко задаем, позже можно добавить анализ)
        trackOriginalBpm = 120; // По умолчанию
        
        console.log(`✅ Трек загружен: ${url}, длина: ${audioBuffer.duration}s`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка загрузки трека:', error);
        return false;
    }
}

// ---------- ВОСПРОИЗВЕДЕНИЕ ----------
function playTrack() {
    if (!audioBuffer) {
        console.warn('Нет загруженного трека');
        return;
    }
    
    if (isAudioPlaying) {
        // Если уже играет - пауза
        pauseTrack();
        return;
    }
    
    initAudio();
    
    // Создаем источник
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.loop = true;
    
    // Подключаем к усилителю
    audioSource.connect(gainNode);
    
    // Вычисляем скорость на основе текущего BPM
    const speed = currentBpm / trackOriginalBpm;
    audioSource.playbackRate.value = Math.max(0.5, Math.min(2.0, speed));
    
    // Запоминаем время начала
    trackStartTime = audioCtx.currentTime - trackPauseTime;
    
    // Стартуем
    audioSource.start(0, trackPauseTime);
    isAudioPlaying = true;
    trackStatus.textContent = '▶️ Играет';
    playBtn.textContent = '⏸️ Пауза';
    
    console.log(`▶️ Воспроизведение: ${currentBpm}BPM (скорость: ${speed.toFixed(2)})`);
    
    // Обработка окончания
    audioSource.onended = () => {
        if (isAudioPlaying) {
            // Если трек закончился и loop отключен
            isAudioPlaying = false;
            trackStatus.textContent = '⏹️ Закончился';
            playBtn.textContent = '▶️ Воспроизвести';
        }
    };
}

// ---------- ПАУЗА ----------
function pauseTrack() {
    if (!isAudioPlaying || !audioSource) return;
    
    // Сохраняем позицию
    trackPauseTime = audioCtx.currentTime - trackStartTime;
    
    // Останавливаем
    audioSource.stop();
    audioSource.disconnect();
    audioSource = null;
    isAudioPlaying = false;
    trackStatus.textContent = '⏸️ На паузе';
    playBtn.textContent = '▶️ Воспроизвести';
    
    console.log(`⏸️ Пауза на ${trackPauseTime.toFixed(2)}с`);
}

// ---------- ИЗМЕНЕНИЕ BPM (скорости) ----------
function updateAudioSpeed(bpm) {
    if (!isAudioPlaying || !audioSource) return;
    
    const speed = bpm / trackOriginalBpm;
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    audioSource.playbackRate.value = clampedSpeed;
    
    console.log(`🎵 Скорость изменена: ${clampedSpeed.toFixed(2)} (${bpm}BPM)`);
}

// ---------- ЗАГРУЗКА ИЗ URL ----------
async function loadTrackFromUrl(url) {
    const success = await loadTrack(url);
    if (success) {
        currentTrackUrl = url;
        trackName.textContent = url.split('/').pop() || 'Трек';
        
        // Если хост - показываем кнопку воспроизведения
        if (isHost) {
            playBtn.textContent = '▶️ Воспроизвести';
        }
        
        // Автоматически не воспроизводим, ждем команды от хоста
    }
    return success;
}

// ---------- ТЕСТОВЫЙ ТРЕК (генерация простого тона) ----------
function generateTestTone() {
    initAudio();
    
    const sampleRate = 44100;
    const duration = 10; // секунд
    const bufferSize = sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    const frequency = 440; // Ля
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        // Добавляем небольшие биения для эффекта
        if (i > 0 && i % 1000 === 0) {
            data[i] *= 1.2;
        }
    }
    
    audioBuffer = buffer;
    trackOriginalBpm = 120;
    trackName.textContent = '🎵 Тестовый тон 440Hz';
    currentTrackUrl = 'generated';
    
    console.log('✅ Сгенерирован тестовый тон');
    return true;
}

// ---------- ОБНОВЛЕНИЕ ПРИ ИЗМЕНЕНИИ BPM ----------
// Переопределяем функцию updateBpm для аудио
const originalUpdateBpm = updateBpm;
updateBpm = function(bpm) {
    originalUpdateBpm(bpm);
    
    // Обновляем скорость воспроизведения
    if (isAudioPlaying && audioSource) {
        const speed = bpm / trackOriginalBpm;
        audioSource.playbackRate.value = Math.max(0.5, Math.min(2.0, speed));
    }
};

// ---------- ПОДКЛЮЧЕНИЕ К КНОПКАМ ----------
// Переопределяем playBtn
playBtn.addEventListener('click', () => {
    if (isHost) {
        // Если трек не загружен - генерируем тестовый
        if (!audioBuffer) {
            generateTestTone();
        }
        
        if (isAudioPlaying) {
            pauseTrack();
        } else {
            playTrack();
        }
        
        // Отправляем состояние хоста всем
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'play_state',
                is_playing: isAudioPlaying
            }));
        }
    }
});

// ---------- АВТОЗАГРУЗКА ТРЕКА ПРИ ВХОДЕ ----------
// Добавляем в connect
const originalConnect = connect;
connect = function() {
    originalConnect();
    
    // После подключения загружаем тестовый трек
    setTimeout(() => {
        if (isHost) {
            generateTestTone();
        }
    }, 500);
};

// ---------- ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ЗАГРУЗКИ MP3 ----------
// Добавляем возможность загрузить свой MP3
function loadCustomTrack() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const url = URL.createObjectURL(file);
        const success = await loadTrackFromUrl(url);
        if (success && isHost) {
            trackName.textContent = file.name;
            // Отправляем информацию о треке
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'set_track',
                    track_name: file.name,
                    track_url: url,
                    bpm: 120
                }));
            }
        }
    };
    input.click();
}

// ---------- ДОБАВЛЯЕМ КНОПКУ ЗАГРУЗКИ ----------
// Добавляем в DOM после загрузки
document.addEventListener('DOMContentLoaded', () => {
    // Создаем кнопку загрузки (только для хоста)
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

console.log('🎵 Аудио-движок готов!');

// ============================================================
// 🔗 QR-КОДЫ И ПРИГЛАШЕНИЯ
// ============================================================

const qrSection = document.getElementById('qrSection');
const qrCodeImage = document.getElementById('qrCodeImage');
const qrLoading = document.getElementById('qrLoading');
const joinLinkInput = document.getElementById('joinLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');

// ---------- ЗАГРУЗКА QR-КОДА ----------
async function loadQRCode(roomId) {
    if (!isHost) return;
    
    try {
        qrSection.style.display = 'block';
        qrLoading.style.display = 'block';
        qrCodeImage.style.display = 'none';
        
        const response = await fetch(`http://localhost:8000/api/room/${roomId}/qr`);
        const data = await response.json();
        
        if (data.success) {
            // Показываем QR-код
            qrCodeImage.src = `data:image/png;base64,${data.qr_code}`;
            qrCodeImage.style.display = 'block';
            qrLoading.style.display = 'none';
            
            // Показываем ссылку
            joinLinkInput.value = data.join_link;
        }
    } catch (error) {
        console.error('Ошибка загрузки QR-кода:', error);
        qrLoading.textContent = '❌ Ошибка загрузки';
    }
}

// ---------- КОПИРОВАНИЕ ССЫЛКИ ----------
copyLinkBtn.addEventListener('click', () => {
    const link = joinLinkInput.value;
    if (link) {
        navigator.clipboard.writeText(link)
            .then(() => {
                const originalText = copyLinkBtn.textContent;
                copyLinkBtn.textContent = '✅ Скопировано!';
                setTimeout(() => {
                    copyLinkBtn.textContent = originalText;
                }, 2000);
            })
            .catch(() => {
                // Если clipboard не работает - выделяем текст
                joinLinkInput.select();
                document.execCommand('copy');
            });
    }
});

// ---------- ДОПОЛНИТЕЛЬНАЯ СТРАНИЦА ВХОДА ----------
// Обработка URL вида /join/room_id
// В реальном проекте нужно настроить роутинг
// Здесь добавляем простую проверку при загрузке
window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const match = path.match(/\/join\/(.+)/);
    if (match) {
        const roomId = match[1];
        roomInput.value = roomId;
        // Автоматически подключаемся
        setTimeout(connect, 500);
    }
});

// Загружаем QR после подключения
// Модифицируем обработчик init
const originalHandleMessage = handleWebSocketMessage;
handleWebSocketMessage = function(data) {
    originalHandleMessage(data);
    
    if (data.type === 'init' && isHost) {
        // Загружаем QR-код для хоста
        setTimeout(() => {
            loadQRCode(roomId);
        }, 1000);
    }
};