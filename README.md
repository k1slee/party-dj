# 🎵 Party DJ - Коллективный музыкальный плеер

<div align="center">

![Party DJ Logo](https://img.shields.io/badge/Party-DJ-orange?style=for-the-badge&logo=spotify)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?style=flat&logo=fastapi)
![Vue](https://img.shields.io/badge/Vue-3.3-brightgreen?style=flat&logo=vue.js)
![Docker](https://img.shields.io/badge/Docker-✓-2496ED?style=flat&logo=docker)

**Управляй музыкой вместе с друзьями!** 🎧

[Демо](#) • [Документация](#) • [Установка](#)

</div>

---

## 📝 Описание

**Party DJ** — это интерактивное веб-приложение, где каждый гость вечеринки может влиять на музыку в реальном времени. Вместо скучного управления плейлистом одним человеком, **все участники** двигают ползунок настроения, а алгоритм усредняет их голоса и меняет **BPM (темп)** и **громкость** трека.

### 🎯 Ключевая идея
> **Не диджей управляет толпой, а толпа управляет диджеем!**

Гости становятся со-авторами музыкальной атмосферы, создавая уникальный опыт каждой вечеринки.

---

## ✨ Возможности

### Для гостей:
- 🎚️ **Ползунок настроения** — от "Расслабон" до "Бешеный движ"
- 📱 **Быстрый вход** — отсканируй QR-код и присоединяйся
- 👥 **Видимость комнаты** — смотри, кто еще в вечеринке
- 🎵 **Реальное время** — музыка меняется мгновенно

### Для хоста (организатора):
- 👑 **Создание комнаты** — один клик и вечеринка готова
- 📊 **Модерация** — фиксируй BPM, если толпа разошлась
- 📁 **Загрузка MP3** — добавляй свои треки
- 🔗 **Приглашения** — QR-коды и ссылки для друзей
- 🎛️ **Полный контроль** — play/pause, переключение треков

### Технические особенности:
- ⚡ **WebSocket** — мгновенная синхронизация всех гостей
- 🎚️ **Web Audio API** — изменение BPM без задержек
- 🐳 **Docker** — простой запуск одной командой
- 🔒 **PWA** — работает как мобильное приложение

---

## 🚀 Быстрый старт

### Требования
- Python 3.11+
- Node.js 18+ (для разработки)
- Docker & Docker Compose (опционально)

### 1. Клонирование
```bash
git clone https://github.com/yourusername/party-dj.git
cd party-dj
2. Запуск через Docker (рекомендуемый)
bash
# Собрать и запустить все сервисы
docker-compose up -d --build

# Посмотреть логи
docker-compose logs -f

# Остановить
docker-compose down
3. Запуск в режиме разработки
Бэкенд:
bash
cd backend
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate (Windows)
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Фронтенд:
bash
cd frontend
npm install
npm run dev
# Открой http://localhost:8080
Или просто открой frontend/index.html в браузере.

🏗️ Архитектура
text
┌──────────────────────────────────────────────────────┐
│                     Клиенты (Гости)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Браузер    │  │   Браузер    │  │  Мобила   │ │
│  │  (Web Audio) │  │  (Web Audio) │  │   (PWA)   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
└─────────┼──────────────────┼─────────────────┼───────┘
          │                  │                 │
          └──────────────────┼─────────────────┘
                             │ (WebSocket WSS)
                             ▼
┌──────────────────────────────────────────────────────┐
│              API Gateway (FastAPI)                   │
│  - Аутентификация комнат                            │
│  - Маршрутизация WebSocket                          │
│  - Broadcast сообщений                              │
└──────────┬────────────────────────────────┬─────────┘
           │                                │
           ▼                                ▼
┌─────────────────────┐         ┌──────────────────────┐
│  Redis (In-Memory)  │         │  PostgreSQL (БД)     │
│  - Активные комнаты  │         │  - История сессий    │
│  - Состояние гостей  │         │  - Плейлисты         │
│  - Текущий BPM       │         │  - Статистика        │
└─────────────────────┘         └──────────────────────┘
🎨 Технологии
Компонент	Технология	Описание
Backend	Python 3.11 + FastAPI	REST API + WebSocket сервер
WebSocket	websockets	Реальное время, комнаты, broadcast
База данных	Redis (in-memory) + PostgreSQL	Кеш и постоянное хранение
Аудио	Web Audio API + pydub	Изменение BPM в реальном времени
Frontend	Vue.js 3 + Vite	SPA + PWA
Сборка	Docker + Docker Compose	Контейнеризация
📊 Алгоритм усреднения
text
1. Гости двигают ползунок (0.0 - 1.0)
   ↓
2. Алгоритм собирает последние 10 голосов
   ↓
3. Вычисляет МЕДИАНУ (устойчиво к выбросам)
   ↓
4. Маппинг: 0.0 → 70 BPM, 1.0 → 180 BPM
   ↓
5. Плавное изменение (сглаживание)
   ↓
6. Новый BPM отправляется всем гостям
🗺️ Roadmap
WebSocket соединение

Управление комнатами

Ползунок настроения

Усреднение BPM

Web Audio API плеер

QR-коды и приглашения

Docker Compose

Поддержка нескольких треков (плейлист)

История сессий

Интеграция со Spotify API

Визуализация (пульсирующий шар)

Telegram бот для управления

🤝 Как внести вклад
Форкните репозиторий

Создайте ветку для фичи (git checkout -b feature/amazing-feature)

Закоммитьте изменения (git commit -m 'Add amazing feature')

Запушьте (git push origin feature/amazing-feature)

Откройте Pull Request

📝 Лицензия
MIT License — свободно используйте для любых целей.

🙏 Благодарности
FastAPI — за невероятный веб-фреймворк

Vue.js — за реактивный фронтенд

Web Audio API — за магию со звуком

📞 Контакты
Автор: [Ваше имя]

Email: your.email@example.com

Telegram: @yourusername

<div align="center"> <sub>Built with ❤️ for awesome parties</sub> </div> ```
📦 Создаем также CONTRIBUTING.md
markdown
# 🤝 Как внести вклад в Party DJ

Спасибо, что хотите помочь сделать Party DJ лучше! Вот руководство для контрибьюторов.

## 🐛 Сообщение об ошибках

Если вы нашли баг, создайте Issue с пометкой `bug`:

1. Опишите **шаги воспроизведения**
2. Укажите **ожидаемое** и **фактическое** поведение
3. Приложите **скриншоты** или **видео** (если возможно)
4. Укажите вашу **ОС** и **версию браузера**

## 💡 Предложение новых фич

Создайте Issue с пометкой `enhancement`:

1. Опишите **проблему**, которую решает фича
2. Предложите **решение** (как это должно работать)
3. Если можно — нарисуйте **макет** или схему

## 🚀 Разработка

### Подготовка окружения

```bash
# Клонируйте репозиторий
git clone https://github.com/yourusername/party-dj.git
cd party-dj

# Установите зависимости
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install
Создание ветки
bash
# Ветка для фичи
git checkout -b feature/название-фичи

# Ветка для исправления бага
git checkout -b fix/название-бага
Стиль кода
Backend (Python):
Используйте PEP 8

Добавляйте docstrings для функций и классов

Используйте type hints (подсказки типов)

Названия переменных: snake_case

Названия классов: PascalCase

python
# ✅ Хорошо
def calculate_bpm(moods: List[float]) -> int:
    """Рассчитать BPM на основе списка настроений."""
    return int(sum(moods) / len(moods))

# ❌ Плохо
def calc(m):
    return int(sum(m)/len(m))
Frontend (Vue/Vue.js):
Используйте Composition API (Vue 3)

Названия компонентов: PascalCase

Названия файлов: camelCase или kebab-case

Стили: SCSS

vue
<!-- ✅ Хорошо -->
<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>

<!-- ❌ Плохо -->
<script>
export default {
  data() {
    return { count: 0 }
  }
}
</script>
Тестирование
Перед отправкой PR убедитесь, что:

bash
# Backend тесты
cd backend
pytest

# Frontend тесты (если есть)
cd frontend
npm run test
Коммиты
Используйте Conventional Commits:

text
feat: добавить ползунок настроения
fix: исправить ошибку WebSocket при отключении
docs: обновить README
style: отформатировать код
refactor: переписать аудио-движок
test: добавить тесты для room_manager
chore: обновить зависимости
Pull Request
Убедитесь, что код работает локально

Напишите описание изменений

Ссылайтесь на Issue (если есть)

Дождитесь ревью

📋 Checklist перед PR
Код следует стилю проекта

Добавлены комментарии для сложных участков

Протестировано локально

Обновлена документация (если нужно)

Нет конфликтов с main веткой

Спасибо за вклад! 🎉

text

---

## 📄 `CHANGELOG.md`

```markdown
# Changelog

Все значимые изменения будут документироваться здесь.

## [1.0.0] - 2026-07-07

### Добавлено
- 🎵 Первый релиз Party DJ
- WebSocket соединение с комнатами
- Ползунок настроения для гостей
- Автоматическое усреднение BPM
- Web Audio API плеер с изменением темпа
- QR-коды для приглашения гостей
- Docker Compose для простого деплоя
- Тестовый тон для демонстрации

### Известные проблемы
- Нет сохранения истории сессий
- Только один трек одновременно
- Нет интеграции со Spotify

## [0.1.0] - 2026-06-01

### Добавлено
- Прототип с одним треком
- Базовое WebSocket соединение

[1.0.0]: https://github.com/yourusername/party-dj/releases/tag/v1.0.0
[0.1.0]: https://github.com/yourusername/party-dj/releases/tag/v0.1.0
✅ Теперь у вас есть:
Файл	Назначение
.gitignore	Игнорирование ненужных файлов в Git
README.md	Полное описание проекта для GitHub
CONTRIBUTING.md	Руководство для контрибьюторов
CHANGELOG.md	История изменений