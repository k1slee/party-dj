from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Guest(BaseModel):
    """Модель гостя в комнате"""
    id: str
    name: str
    mood: float = 0.5  # 0 - расслабон, 1 - бешеный движ
    last_active: datetime = datetime.now()
    is_host: bool = False
    
class RoomState(BaseModel):
    """Состояние комнаты"""
    room_id: str
    current_bpm: int = 120
    original_bpm: int = 120  # Изначальный BPM текущего трека
    current_track: Optional[str] = None
    current_track_url: Optional[str] = None
    guests: List[Guest] = []
    is_playing: bool = False
    mood_history: List[float] = []
    created_at: datetime = datetime.now()
    host_override: Optional[int] = None  # Если хост зафиксировал BPM
    
    def get_average_mood(self) -> float:
        """Получить среднее настроение всех гостей"""
        if not self.guests:
            return 0.5
        moods = [g.mood for g in self.guests]
        return sum(moods) / len(moods)
    
    def get_median_mood(self) -> float:
        """Получить медианное настроение (устойчиво к выбросам)"""
        if not self.guests:
            return 0.5
        moods = sorted([g.mood for g in self.guests])
        return moods[len(moods) // 2]
    
    def calculate_bpm(self) -> int:
        """Рассчитать BPM на основе настроений гостей"""
        # Если хост зафиксировал BPM - используем его
        if self.host_override is not None:
            return self.host_override
        
        if not self.guests:
            return self.current_bpm
        
        # Используем медиану для устойчивости
        median_mood = self.get_median_mood()
        
        # Маппинг: 0 -> 70 BPM, 1 -> 180 BPM
        new_bpm = int(70 + median_mood * 110)
        
        # Плавное изменение (сглаживание)
        target_bpm = int(self.current_bpm * 0.7 + new_bpm * 0.3)
        
        # Ограничиваем диапазон
        return max(60, min(190, target_bpm))