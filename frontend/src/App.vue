<template>
  <div id="app">
    <div v-if="!connected" class="join-screen">
      <div class="container">
        <div class="logo">🎵</div>
        <h1>Party DJ</h1>
        <p class="subtitle">Управляй музыкой вместе с друзьями</p>
        
        <div class="card">
          <div class="form-group">
            <label>ID комнаты</label>
            <input type="text" v-model="roomId" placeholder="Например: party123">
          </div>
          <div class="form-group">
            <label>Ваше имя</label>
            <input type="text" v-model="guestName" placeholder="Как вас зовут?">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="isHost"> 
              Я хозяин вечеринки (диджей)
            </label>
          </div>
          <button @click="connect" class="btn-primary">🚀 Войти в комнату</button>
          <div class="status">{{ status }}</div>
        </div>
      </div>
    </div>

    <div v-else class="player-screen">
      <div class="container">
        <div class="header">
          <h2>🎵 Комната: {{ roomId }}</h2>
          <div class="room-stats">
            <span>👥 {{ guestsCount }}</span>
            <button @click="disconnect" class="btn-small">✕ Выйти</button>
          </div>
        </div>

        <!-- BPM -->
        <div class="bpm-section">
          <div class="bpm-circle">
            <span>{{ currentBpm }}</span>
            <small>BPM</small>
          </div>
        </div>

        <!-- Трек -->
        <div class="track-section">
          <div class="track-name">{{ currentTrack || 'Нет трека' }}</div>
          <div class="track-status">{{ isPlaying ? '▶️ Играет' : '⏸️ Остановлено' }}</div>
        </div>

        <!-- Mood Slider -->
        <div class="mood-section">
          <div class="mood-labels">
            <span>😴 Расслабон</span>
            <span>🔥 Бешеный движ</span>
          </div>
          <input type="range" v-model="mood" min="0" max="1" step="0.01">
          <div class="mood-value">Настроение: {{ mood.toFixed(2) }}</div>
          <div class="mood-emojis">{{ moodEmoji }}</div>
        </div>

        <!-- Host Controls -->
        <div v-if="isHost" class="host-controls">
          <button @click="togglePlay" class="btn-control">
            {{ isPlaying ? '⏸️ Пауза' : '▶️ Воспроизвести' }}
          </button>
          <button @click="lockBpm" class="btn-control secondary">🔒 Зафиксировать BPM</button>
          <button @click="loadTrack" class="btn-control secondary">📁 Загрузить MP3</button>
        </div>

        <!-- Guests -->
        <div class="guests-section">
          <div class="guests-title">👥 В комнате</div>
          <div class="guests-list">
            <div v-for="guest in guests" :key="guest.id" class="guest-item">
              {{ guest.name }}
              <span v-if="guest.is_host" class="host-badge">👑</span>
              <span class="mood-dot" :style="{ background: `hsl(${guest.mood * 120}, 80%, 50%)` }"></span>
            </div>
          </div>
        </div>

        <!-- QR Code -->
        <div v-if="isHost && qrCode" class="qr-section">
          <div class="qr-container">
            <div class="qr-title">📱 Пригласи друзей</div>
            <div class="qr-code-container">
              <img :src="`data:image/png;base64,${qrCode}`" alt="QR-код">
            </div>
            <div class="qr-link">
              <input type="text" :value="joinLink" readonly>
              <button @click="copyLink" class="btn-small">📋 Копировать</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      connected: false,
      roomId: 'party123',
      guestName: 'Гость',
      isHost: false,
      status: 'Введите ID комнаты для подключения',
      
      ws: null,
      guestId: null,
      currentBpm: 120,
      currentTrack: null,
      isPlaying: false,
      mood: 0.5,
      guests: [],
      guestsCount: 0,
      
      qrCode: null,
      joinLink: '',
      
      // Audio
      audioCtx: null,
      audioBuffer: null,
      audioSource: null,
      trackOriginalBpm: 120,
      isAudioPlaying: false
    }
  },
  computed: {
    moodEmoji() {
      const emojis = ['😴', '🙂', '😊', '😄', '🔥']
      const index = Math.min(Math.floor(this.mood * emojis.length), emojis.length - 1)
      return emojis[index]
    }
  },
  methods: {
    connect() {
      if (!this.roomId) {
        this.status = '❌ Введите ID комнаты'
        return
      }
      
      const wsUrl = `ws://localhost:8000/ws/${this.roomId}?name=${encodeURIComponent(this.guestName)}&host=${this.isHost}`
      this.status = '🔄 Подключение...'
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        this.connected = true
        this.status = '✅ Подключено!'
        
        if (this.isHost) {
          this.loadQRCode()
        }
      }
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      }
      
      this.ws.onerror = () => {
        this.status = '❌ Ошибка подключения'
      }
      
      this.ws.onclose = () => {
        this.connected = false
        this.status = '🔌 Отключено'
      }
    },
    
    disconnect() {
      if (this.ws) {
        this.ws.close()
      }
      this.connected = false
    },
    
    handleMessage(data) {
      switch (data.type) {
        case 'init':
          this.guestId = data.guest_id
          this.isHost = data.is_host || this.isHost
          this.currentBpm = data.bpm
          this.currentTrack = data.current_track
          this.guests = data.guests || []
          this.guestsCount = data.guests_count || 0
          break
          
        case 'state_update':
          this.currentBpm = data.bpm
          this.guestsCount = data.guests_count
          if (data.current_track) {
            this.currentTrack = data.current_track
          }
          break
          
        case 'play_state':
          this.isPlaying = data.is_playing
          this.isAudioPlaying = data.is_playing
          break
          
        case 'track_change':
          this.currentTrack = data.track_name
          this.currentBpm = data.bpm
          break
          
        case 'mood_confirmed':
          // Подтверждение настроения
          break
          
        default:
          console.log('Неизвестное сообщение:', data)
      }
    },
    
    sendMessage(message) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message))
      }
    },
    
    updateMood() {
      this.sendMessage({
        type: 'mood',
        value: this.mood
      })
    },
    
    togglePlay() {
      if (!this.isHost) return
      this.sendMessage({ type: 'play' })
      
      // Локальное аудио
      if (this.isAudioPlaying) {
        this.pauseAudio()
      } else {
        this.playAudio()
      }
    },
    
    lockBpm() {
      if (!this.isHost) return
      const bpm = prompt('Введите фиксированный BPM (60-190):', this.currentBpm)
      if (bpm !== null) {
        const value = parseInt(bpm)
        if (value >= 60 && value <= 190) {
          this.sendMessage({
            type: 'set_bpm',
            bpm: value
          })
        }
      }
    },
    
    loadTrack() {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'audio/*'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        
        const url = URL.createObjectURL(file)
        this.currentTrack = file.name
        this.sendMessage({
          type: 'set_track',
          track_name: file.name,
          track_url: url,
          bpm: 120
        })
        
        // Загружаем в аудио
        this.loadAudioFile(url)
      }
      input.click()
    },
    
    // ========== АУДИО ==========
    initAudio() {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      }
    },
    
    async loadAudioFile(url) {
      try {
        this.initAudio()
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer)
        this.trackOriginalBpm = 120
        console.log('✅ Трек загружен')
      } catch (error) {
        console.error('Ошибка загрузки:', error)
      }
    },
    
    playAudio() {
      if (!this.audioBuffer) {
        // Генерируем тестовый тон
        this.generateTestTone()
      }
      
      if (this.isAudioPlaying) {
        this.pauseAudio()
        return
      }
      
      this.initAudio()
      
      this.audioSource = this.audioCtx.createBufferSource()
      this.audioSource.buffer = this.audioBuffer
      this.audioSource.loop = true
      
      const speed = this.currentBpm / this.trackOriginalBpm
      this.audioSource.playbackRate.value = Math.max(0.5, Math.min(2.0, speed))
      
      this.audioSource.connect(this.audioCtx.destination)
      this.audioSource.start(0)
      
      this.isAudioPlaying = true
      this.isPlaying = true
    },
    
    pauseAudio() {
      if (!this.isAudioPlaying || !this.audioSource) return
      
      this.audioSource.stop()
      this.audioSource.disconnect()
      this.audioSource = null
      this.isAudioPlaying = false
      this.isPlaying = false
    },
    
    generateTestTone() {
      this.initAudio()
      
      const sampleRate = 44100
      const duration = 10
      const bufferSize = sampleRate * duration
      const buffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate)
      const data = buffer.getChannelData(0)
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3
      }
      
      this.audioBuffer = buffer
      this.trackOriginalBpm = 120
      this.currentTrack = '🎵 Тестовый тон 440Hz'
      console.log('✅ Сгенерирован тестовый тон')
    },
    
    // ========== QR ==========
    async loadQRCode() {
      try {
        const response = await fetch(`http://localhost:8000/api/room/${this.roomId}/qr`)
        const data = await response.json()
        
        if (data.success) {
          this.qrCode = data.qr_code
          this.joinLink = data.join_link
        }
      } catch (error) {
        console.error('Ошибка загрузки QR:', error)
      }
    },
    
    copyLink() {
      if (this.joinLink) {
        navigator.clipboard.writeText(this.joinLink)
          .then(() => {
            alert('✅ Ссылка скопирована!')
          })
          .catch(() => {
            // Fallback
            const input = document.querySelector('.qr-link input')
            if (input) {
              input.select()
              document.execCommand('copy')
            }
          })
      }
    }
  },
  watch: {
    mood() {
      this.updateMood()
    }
  }
}
</script>

<style>
/* Стили уже есть в style.css */
</style>