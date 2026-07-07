import uuid
import logging
from typing import Dict, Optional, Set
from datetime import datetime
from app.models.room import RoomState, Guest

logger = logging.getLogger(__name__)

class RoomManager:
    """Управление комнатами и гостями"""
    
    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}
        self.guest_counter = 0
        logger.info("✅ RoomManager инициализирован")
    
    def create_room(self, room_id: Optional[str] = None) -> str:
        """Создать новую комнату"""
        if room_id is None:
            room_id = self.generate_room_id()
        
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomState(room_id=room_id)
            logger.info(f"✅ Создана комната: {room_id}")
        else:
            logger.info(f"ℹ️ Комната {room_id} уже существует")
        
        return room_id
    
    def generate_room_id(self) -> str:
        """Сгенерировать уникальный ID комнаты"""
        import random
        words = ["party", "vibe", "beat", "groove", "jam", "dance", "rhythm"]
        return f"{random.choice(words)}-{random.randint(100, 999)}"
    
    def get_room(self, room_id: str) -> Optional[RoomState]:
        """Получить комнату по ID"""
        return self.rooms.get(room_id)
    
    def get_or_create_room(self, room_id: str) -> RoomState:
        """Получить комнату или создать новую"""
        if room_id not in self.rooms:
            logger.info(f"🆕 Комната {room_id} не найдена, создаем...")
            self.create_room(room_id)
        return self.rooms[room_id]
    
    def add_guest(self, room_id: str, name: str, is_host: bool = False) -> Optional[Guest]:
        """Добавить гостя в комнату (создает комнату, если её нет)"""
        # ВАЖНО: СНАЧАЛА получаем или создаем комнату!
        room = self.get_or_create_room(room_id)  # <-- ИСПРАВЛЕНО!
        
        if not room:
            logger.error(f"❌ Не удалось создать/получить комнату {room_id}")
            return None
        
        self.guest_counter += 1
        guest = Guest(
            id=f"guest_{self.guest_counter}",
            name=name or f"Гость {self.guest_counter}",
            is_host=is_host
        )
        room.guests.append(guest)
        
        # Если это первый гость и он хост - он становится хостом
        if len(room.guests) == 1 and is_host:
            guest.is_host = True
            logger.info(f"👑 {guest.name} стал хостом комнаты {room_id}")
        
        logger.info(f"👤 Гость '{guest.name}' (id: {guest.id}) вошел в комнату {room_id}")
        logger.info(f"📊 В комнате {room_id} теперь {len(room.guests)} гостей")
        
        return guest
    
    def remove_guest(self, room_id: str, guest_id: str):
        """Удалить гостя из комнаты"""
        room = self.get_room(room_id)
        if not room:
            return
        
        guest = next((g for g in room.guests if g.id == guest_id), None)
        if guest:
            logger.info(f"👋 Гость '{guest.name}' вышел из комнаты {room_id}")
            room.guests = [g for g in room.guests if g.id != guest_id]
            
            # Если комната пуста - удаляем её
            if not room.guests:
                del self.rooms[room_id]
                logger.info(f"🗑️ Комната {room_id} удалена (пуста)")
    
    def update_guest_mood(self, room_id: str, guest_id: str, mood: float) -> Optional[int]:
        """Обновить настроение гостя и вернуть новый BPM"""
        room = self.get_room(room_id)
        if not room:
            return None
        
        guest = next((g for g in room.guests if g.id == guest_id), None)
        if not guest:
            return None
        
        guest.mood = max(0, min(1, mood))
        guest.last_active = datetime.now()
        
        room.mood_history.append(guest.mood)
        if len(room.mood_history) > 50:
            room.mood_history.pop(0)
        
        new_bpm = room.calculate_bpm()
        room.current_bpm = new_bpm
        
        logger.debug(f"🎵 BPM обновлен: {new_bpm} (гость: {guest.name})")
        return new_bpm
    
    def set_host_override(self, room_id: str, bpm: Optional[int]) -> bool:
        """Установить фиксированный BPM от хоста"""
        room = self.get_room(room_id)
        if not room:
            return False
        
        room.host_override = bpm
        if bpm is not None:
            room.current_bpm = bpm
            logger.info(f"👑 Хост зафиксировал BPM: {bpm}")
        else:
            logger.info(f"👑 Хост отменил фиксацию BPM")
        return True
    
    def set_track(self, room_id: str, track_name: str, track_url: str, bpm: int = 120):
        """Установить текущий трек"""
        room = self.get_room(room_id)
        if not room:
            return
        
        room.current_track = track_name
        room.current_track_url = track_url
        room.original_bpm = bpm
        room.current_bpm = bpm
        
        logger.info(f"🎵 Установлен трек: {track_name} (BPM: {bpm})")
    
    def toggle_play(self, room_id: str) -> bool:
        """Переключить воспроизведение"""
        room = self.get_room(room_id)
        if not room:
            return False
        
        room.is_playing = not room.is_playing
        return room.is_playing
    
    def get_room_info(self, room_id: str) -> dict:
        """Получить информацию о комнате для API"""
        room = self.get_room(room_id)
        if not room:
            return {"error": "Room not found"}
        
        return {
            "room_id": room.room_id,
            "bpm": room.current_bpm,
            "original_bpm": room.original_bpm,
            "guests_count": len(room.guests),
            "guests": [{"id": g.id, "name": g.name, "mood": g.mood} for g in room.guests],
            "is_playing": room.is_playing,
            "current_track": room.current_track,
            "created_at": room.created_at.isoformat()
        }