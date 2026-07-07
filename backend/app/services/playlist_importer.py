import json
import csv
from typing import List, Dict

class PlaylistImporter:
    """Импорт плейлистов из разных форматов"""
    
    @staticmethod
    def import_from_json(content: str) -> List[Dict]:
        """Импорт из JSON"""
        data = json.loads(content)
        tracks = []
        
        # Поддерживаем разные форматы JSON
        if isinstance(data, list):
            for item in data:
                tracks.append({
                    'title': item.get('title') or item.get('name') or item.get('track'),
                    'artist': item.get('artist') or item.get('artists', [''])[0],
                    'album': item.get('album', ''),
                    'duration': item.get('duration', 0)
                })
        elif isinstance(data, dict):
            # Яндекс Музыка формат
            if 'tracks' in data:
                for item in data['tracks']:
                    tracks.append({
                        'title': item.get('title', ''),
                        'artist': item.get('artists', [{'name': ''}])[0].get('name', ''),
                        'album': item.get('album', {}).get('title', ''),
                        'duration': item.get('duration', 0)
                    })
        return tracks
    
    @staticmethod
    def import_from_csv(content: str) -> List[Dict]:
        """Импорт из CSV"""
        tracks = []
        reader = csv.DictReader(content.splitlines())
        for row in reader:
            tracks.append({
                'title': row.get('title') or row.get('Track') or row.get('Name'),
                'artist': row.get('artist') or row.get('Artist'),
                'album': row.get('album') or row.get('Album'),
                'duration': int(row.get('duration', 0))
            })
        return tracks
    
    @staticmethod
    def import_from_txt(content: str) -> List[Dict]:
        """Импорт из текстового файла (артист - трек)"""
        tracks = []
        for line in content.splitlines():
            line = line.strip()
            if not line:
                continue
            
            # Пробуем разные разделители
            for separator in [' - ', ' – ', ' — ', ' | ', '\t']:
                if separator in line:
                    parts = line.split(separator, 1)
                    tracks.append({
                        'artist': parts[0].strip(),
                        'title': parts[1].strip(),
                        'album': '',
                        'duration': 0
                    })
                    break
        return tracks