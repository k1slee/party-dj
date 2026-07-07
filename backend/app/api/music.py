from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from app.services.taste_analyzer import TasteAnalyzer
from app.services.playlist_importer import PlaylistImporter
from app.services.yandex_parser import YandexMusicParser

router = APIRouter()
analyzer = TasteAnalyzer()

@router.post("/taste/analyze")
async def analyze_taste(
    genres: Optional[List[str]] = None,
    mood: Optional[str] = None,
    playlist_file: Optional[UploadFile] = None,
    yandex_url: Optional[str] = None
):
    """Анализирует вкусы пользователя"""
    
    tracks = []
    
    # 1. Если загружен файл
    if playlist_file:
        content = await playlist_file.read()
        content_str = content.decode('utf-8')
        
        if playlist_file.filename.endswith('.json'):
            tracks = PlaylistImporter.import_from_json(content_str)
        elif playlist_file.filename.endswith('.csv'):
            tracks = PlaylistImporter.import_from_csv(content_str)
        else:
            tracks = PlaylistImporter.import_from_txt(content_str)
    
    # 2. Если ссылка на Яндекс
    elif yandex_url:
        tracks = await YandexMusicParser.parse_playlist(yandex_url)
    
    # 3. Анализируем
    if tracks:
        profile = analyzer.analyze_playlist(tracks)
    else:
        # Если нет плейлиста - используем жанры из опросника
        profile = {
            'genres': genres or ['pop', 'rock'],
            'energy_level': {'happy': 0.8, 'energetic': 0.9, 'calm': 0.3, 'sad': 0.2}.get(mood, 0.6),
            'mood': mood or 'neutral',
            'total_tracks': 0
        }
    
    return {
        'success': True,
        'profile': profile,
        'tracks_analyzed': len(tracks)
    }

@router.get("/recommendations")
async def get_recommendations(
    genres: List[str],
    energy: float = 0.5,
    limit: int = 20
):
    """Получить рекомендации на основе профиля"""
    # Здесь будет поиск в Jamendo/YouTube
    # ...
    return {'tracks': []}