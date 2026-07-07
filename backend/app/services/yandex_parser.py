import re
import httpx
from bs4 import BeautifulSoup

class YandexMusicParser:
    """Парсинг плейлистов Яндекс Музыки (без API)"""
    
    @staticmethod
    async def parse_playlist(url: str) -> List[Dict]:
        """Парсит плейлист по ссылке"""
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Ищем скрипт с данными
            script = soup.find('script', string=re.compile(r'window\.__INITIAL_STATE__'))
            if script:
                import json
                data = json.loads(re.search(r'({.*})', script.string).group(1))
                
                tracks = []
                for track in data.get('playlist', {}).get('tracks', []):
                    tracks.append({
                        'title': track.get('title', ''),
                        'artist': track.get('artists', [{}])[0].get('name', ''),
                        'album': track.get('album', {}).get('title', ''),
                        'duration': track.get('duration', 0),
                        'genre': track.get('genre', '')
                    })
                return tracks
        return []