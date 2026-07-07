from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import logging
from typing import Optional
from app.utils.qr_generator import QRGenerator, get_qr_data
from app.services.room_manager import RoomManager
from app.websocket.manager import WebSocketManager

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создаем приложение
app = FastAPI(
    title="🎵 Party DJ",
    description="Коллективный музыкальный плеер с управлением через настроение",
    version="1.0.0"
)

# CORS (разрешаем все для разработки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализируем менеджеры
room_manager = RoomManager()
ws_manager = WebSocketManager(room_manager)

# ==================== WebSocket ENDPOINT ====================

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """WebSocket эндпоинт для подключения к комнате"""
    
    # Получаем параметры из query (передаем имя гостя)
    guest_name = websocket.query_params.get("name", "Аноним")
    is_host = websocket.query_params.get("host", "false").lower() == "true"
    
    # Подключаем WebSocket
    await ws_manager.connect(room_id, websocket)
    
    # Добавляем гостя в комнату
    guest = room_manager.add_guest(room_id, guest_name, is_host)
    if not guest:
        await websocket.close(code=1008, reason="Комната не найдена")
        return
    
    try:
        # Отправляем начальное состояние
        room = room_manager.get_room(room_id)
        await ws_manager.send_to_guest(room_id, websocket, {
            "type": "init",
            "guest_id": guest.id,
            "is_host": guest.is_host,
            "bpm": room.current_bpm,
            "current_track": room.current_track,
            "guests_count": len(room.guests),
            "guests": [{"name": g.name, "mood": g.mood} for g in room.guests]
        })
        
        logger.info(f"✅ Гость '{guest.name}' подключился к комнате {room_id}")
        
        # Уведомляем остальных
        await ws_manager.broadcast_state(room_id, f"{guest.name} присоединился")
        
        # Основной цикл обработки сообщений
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "mood":
                # Обновление настроения
                mood = float(message.get("value", 0.5))
                new_bpm = room_manager.update_guest_mood(room_id, guest.id, mood)
                
                if new_bpm is not None:
                    # Отправляем обновление всем в комнате
                    await ws_manager.broadcast_state(room_id, guest.name, mood)
                    
                    # Отправляем подтверждение гостю
                    await ws_manager.send_to_guest(room_id, websocket, {
                        "type": "mood_confirmed",
                        "mood": mood,
                        "bpm": new_bpm
                    })
            
            elif message_type == "play":
                # Воспроизведение (только для хоста)
                if guest.is_host:
                    is_playing = room_manager.toggle_play(room_id)
                    await ws_manager.broadcast(room_id, {
                        "type": "play_state",
                        "is_playing": is_playing
                    })
            
            elif message_type == "set_track":
                # Установка трека (только для хоста)
                if guest.is_host:
                    track_name = message.get("track_name", "Неизвестный трек")
                    track_url = message.get("track_url", "")
                    bpm = int(message.get("bpm", 120))
                    
                    room_manager.set_track(room_id, track_name, track_url, bpm)
                    await ws_manager.broadcast(room_id, {
                        "type": "track_change",
                        "track_name": track_name,
                        "bpm": bpm
                    })
            
            elif message_type == "set_bpm":
                # Фиксация BPM (только для хоста)
                if guest.is_host:
                    bpm = message.get("bpm")
                    if bpm is not None:
                        room_manager.set_host_override(room_id, bpm)
                        await ws_manager.broadcast(room_id, {
                            "type": "bpm_override",
                            "bpm": bpm,
                            "by": "host"
                        })
            
            elif message_type == "release_bpm":
                # Отмена фиксации BPM (только для хоста)
                if guest.is_host:
                    room_manager.set_host_override(room_id, None)
                    room = room_manager.get_room(room_id)
                    await ws_manager.broadcast(room_id, {
                        "type": "bpm_release",
                        "bpm": room.current_bpm
                    })
    
    except WebSocketDisconnect:
        # Обработка отключения
        logger.info(f"🔌 Гость '{guest.name}' отключился от комнаты {room_id}")
        ws_manager.disconnect(room_id, websocket)
        room_manager.remove_guest(room_id, guest.id)
        
        # Уведомляем остальных
        room = room_manager.get_room(room_id)
        if room:
            await ws_manager.broadcast_state(room_id, f"{guest.name} покинул комнату")
    
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        ws_manager.disconnect(room_id, websocket)
        room_manager.remove_guest(room_id, guest.id)

# ==================== HTTP ENDPOINTS ====================

@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "🎵 Party DJ Server",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/rooms")
async def list_rooms():
    """Список всех активных комнат"""
    rooms = []
    for room_id, room in room_manager.rooms.items():
        rooms.append({
            "room_id": room.room_id,
            "guests": len(room.guests),
            "bpm": room.current_bpm,
            "is_playing": room.is_playing,
            "created_at": room.created_at.isoformat()
        })
    
    return {
        "total": len(rooms),
        "rooms": rooms
    }

@app.get("/api/room/{room_id}")
async def get_room(room_id: str):
    """Информация о конкретной комнате"""
    info = room_manager.get_room_info(room_id)
    if "error" in info:
        raise HTTPException(status_code=404, detail=info["error"])
    return info

@app.post("/api/room/{room_id}/track")
async def set_track(room_id: str, track_name: str, track_url: str = "", bpm: int = 120):
    """Установить трек (API для управления)"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    
    room_manager.set_track(room_id, track_name, track_url, bpm)
    await ws_manager.broadcast(room_id, {
        "type": "track_change",
        "track_name": track_name,
        "bpm": bpm
    })
    
    return {"success": True, "track": track_name, "bpm": bpm}

# ==================== QR-КОДЫ ====================

@app.get("/api/room/{room_id}/qr")
async def get_room_qr(room_id: str, base_url: str = "http://localhost:8080"):
    """Получить QR-код для комнаты"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    
    qr_data = get_qr_data(room_id, base_url)
    return {
        "success": True,
        **qr_data
    }

@app.get("/api/room/{room_id}/join-link")
async def get_join_link(room_id: str, base_url: str = "http://localhost:8080"):
    """Получить ссылку для входа в комнату"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    
    return {
        "success": True,
        "room_id": room_id,
        "join_link": QRGenerator.generate_join_link(room_id, base_url),
        "qr_code": QRGenerator.generate_qr(room_id, base_url)
    }
# ==================== ЗАПУСК ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )