import json
import logging
from typing import Dict, Set
from fastapi import WebSocket
from app.services.room_manager import RoomManager

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Управление WebSocket-соединениями"""
    
    def __init__(self, room_manager: RoomManager):
        self.room_manager = room_manager
        self.connections: Dict[str, Set[WebSocket]] = {}  # room_id -> {websockets}
    
    async def connect(self, room_id: str, websocket: WebSocket) -> bool:
        """Подключить WebSocket к комнате"""
        await websocket.accept()
        
        if room_id not in self.connections:
            self.connections[room_id] = set()
        self.connections[room_id].add(websocket)
        
        logger.info(f"🔗 WebSocket подключен к комнате {room_id}")
        return True
    
    def disconnect(self, room_id: str, websocket: WebSocket):
        """Отключить WebSocket от комнаты"""
        if room_id in self.connections:
            self.connections[room_id].discard(websocket)
            if not self.connections[room_id]:
                del self.connections[room_id]
            logger.info(f"🔌 WebSocket отключен от комнаты {room_id}")
    
    async def broadcast(self, room_id: str, message: dict, exclude: WebSocket = None):
        """Отправить сообщение всем в комнате"""
        if room_id not in self.connections:
            return
        
        data = json.dumps(message)
        disconnected = set()
        
        for websocket in self.connections[room_id]:
            if websocket == exclude:
                continue
            
            try:
                await websocket.send_text(data)
            except:
                disconnected.add(websocket)
        
        # Удаляем отключившиеся соединения
        for ws in disconnected:
            self.connections[room_id].discard(ws)
    
    async def send_to_guest(self, room_id: str, websocket: WebSocket, message: dict):
        """Отправить сообщение конкретному гостю"""
        try:
            await websocket.send_text(json.dumps(message))
        except:
            pass
    
    async def broadcast_state(self, room_id: str, guest_name: str = None, guest_mood: float = None):
        """Отправить обновленное состояние комнаты всем"""
        room = self.room_manager.get_room(room_id)
        if not room:
            return
        
        # Формируем сообщение
        message = {
            "type": "state_update",
            "bpm": room.current_bpm,
            "guests_count": len(room.guests),
            "is_playing": room.is_playing,
            "current_track": room.current_track,
            "timestamp": room.created_at.isoformat()
        }
        
        # Добавляем информацию о последнем действии (если есть)
        if guest_name:
            message["last_guest"] = guest_name
            message["last_mood"] = guest_mood
        
        await self.broadcast(room_id, message)
    
    def get_connections_count(self, room_id: str) -> int:
        """Получить количество подключений в комнате"""
        return len(self.connections.get(room_id, set()))