from typing import List, Dict
import random
from collections import Counter

class TasteAnalyzer:
    """Анализирует плейлист для определения музыкальных предпочтений"""
    
    # База артистов по жанрам (можно расширять через Last.fm)
    GENRE_DB = {
        'rock': ['ac/dc', 'nirvana', 'queen', 'led zeppelin', 'rolling stones', 
                 'coldplay', 'red hot chili peppers', 'the beatles', 'green day',
                 'pink floyd', 'the who', 'deep purple', 'guns n roses'],
        'pop': ['taylor swift', 'ed sheeran', 'ariana grande', 'dua lipa',
                'harry styles', 'billie eilish', 'justin bieber', 'katy perry',
                'lady gaga', 'rihanna', 'bruno mars', 'adele'],
        'electronic': ['daft punk', 'the prodigy', 'massive attack', 'justice',
                       'deadmau5', 'skrillex', 'calvin harris', 'david guetta',
                       'kraftwerk', 'aphex twin', 'chemical brothers'],
        'hiphop': ['eminem', 'kendrick lamar', 'drake', 'j. cole',
                   'travis scott', 'post malone', 'kanye west', 'tyler the creator',
                   'wu-tang clan', 'nas', 'snoop dogg', 'dr. dre'],
        'jazz': ['miles davis', 'john coltrane', 'billie holiday', 'louis armstrong',
                 'ella fitzgerald', 'charlie parker', 'duke ellington', 'chett baker'],
        'classical': ['beethoven', 'mozart', 'bach', 'tchaikovsky',
                      'vivaldi', 'chopin', 'schubert', 'rachmaninoff'],
        'indie': ['arctic monkeys', 'the strokes', 'bon iver', 'vampire weekend',
                  'tame impala', 'mgmt', 'the 1975', 'glass animals',
                  'alt-j', 'the national', 'arcade fire'],
        'rnb': ['beyoncé', 'frank ocean', 'sza', 'the weeknd',
                'bruno mars', 'anderson .paak', 'h.e.r.', 'daniel caesar',
                'usher', 'alicia keys', 'mariah carey'],
        'metal': ['metallica', 'iron maiden', 'slipknot', 'system of a down',
                  'tool', 'avenged sevenfold', 'rammstein', 'bullet for my valentine',
                  'black sabbath', 'judas priest', 'megadeth'],
        'folk': ['bob dylan', 'joan baez', 'joni mitchell', 'neil young',
                 'leonard cohen', 'nick drake', 'fleet foxes', 'mumford & sons',
                 'simon & garfunkel', 'woody guthrie'],
        'lofi': ['jinsang', 'saib', 'eevee', 'a l e x', 'masked man',
                 'mishashi', 'j^p^r^', 'idealism', 'ambient'],
        'disco': ['bee gees', 'chic', 'donna summer', 'gloria gaynor',
                  'abba', 'michael jackson', 'earth wind & fire', 'village people',
                  'candi staton', 'tina turner']
    }
    
    def __init__(self):
        self.artist_genre_cache = {}
    
    def analyze_playlist(self, tracks: List[Dict]) -> Dict:
        """Анализирует плейлист и возвращает профиль вкусов"""
        if not tracks:
            return self._get_default_profile()
        
        # 1. Определяем жанры по артистам
        genre_scores = self._detect_genres(tracks)
        
        # 2. Определяем энергетику (по жанрам и артистам)
        energy = self._detect_energy(tracks)
        
        # 3. Определяем эпоху (по артистам)
        era = self._detect_era(tracks)
        
        # 4. Определяем предпочтение по вокалу/инструменталу
        vocal_preference = self._detect_vocal_preference(tracks)
        
        # 5. Выбираем топ-жанры
        top_genres = sorted(genre_scores.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return {
            'genres': [g[0] for g in top_genres],
            'genre_scores': genre_scores,
            'energy_level': energy,
            'era_preference': era,
            'vocal_preference': vocal_preference,
            'top_artists': self._get_top_artists(tracks, 10),
            'total_tracks': len(tracks)
        }
    
    def _detect_genres(self, tracks: List[Dict]) -> Dict[str, int]:
        """Определяет жанры на основе артистов"""
        genre_scores = {genre: 0 for genre in self.GENRE_DB.keys()}
        
        for track in tracks:
            artist = track.get('artist', '').lower().strip()
            if not artist:
                continue
            
            for genre, artists in self.GENRE_DB.items():
                for genre_artist in artists:
                    if genre_artist in artist or artist in genre_artist:
                        genre_scores[genre] += 1
                        break
        
        return genre_scores
    
    def _detect_energy(self, tracks: List[Dict]) -> float:
        """Определяет энергетику плейлиста (0-1)"""
        # Упрощенная логика: по жанрам
        energy_map = {
            'metal': 0.9, 'rock': 0.8, 'hiphop': 0.8, 'electronic': 0.7,
            'disco': 0.8, 'pop': 0.6, 'indie': 0.5, 'rnb': 0.5,
            'jazz': 0.3, 'classical': 0.2, 'folk': 0.3, 'lofi': 0.2
        }
        
        genre_scores = self._detect_genres(tracks)
        if not genre_scores:
            return 0.5
        
        total_weight = sum(genre_scores.values())
        if total_weight == 0:
            return 0.5
        
        energy = 0
        for genre, score in genre_scores.items():
            energy += energy_map.get(genre, 0.5) * score
        
        return round(energy / total_weight, 2)
    
    def _detect_era(self, tracks: List[Dict]) -> float:
        """Определяет эпоху (0 - классика, 1 - новинки)"""
        # Упрощенная логика
        classic_artists = ['beatles', 'bob dylan', 'miles davis', 'beethoven', 
                           'mozart', 'bach', 'led zeppelin', 'pink floyd']
        
        modern_artists = ['taylor swift', 'ed sheeran', 'billie eilish', 
                          'drake', 'post malone', 'the weeknd']
        
        classic_count = 0
        modern_count = 0
        
        for track in tracks:
            artist = track.get('artist', '').lower()
            for ca in classic_artists:
                if ca in artist:
                    classic_count += 1
                    break
            for ma in modern_artists:
                if ma in artist:
                    modern_count += 1
                    break
        
        total = classic_count + modern_count
        if total == 0:
            return 0.5
        
        return modern_count / total
    
    def _detect_vocal_preference(self, tracks: List[Dict]) -> float:
        """Определяет предпочтение вокала (0 - инструментал, 1 - вокал)"""
        # Упрощенная логика: инструментальные жанры vs вокальные
        instrumental_genres = ['classical', 'jazz', 'lofi', 'electronic']
        vocal_genres = ['pop', 'rock', 'hiphop', 'rnb', 'indie', 'metal', 'folk']
        
        instrumental_count = 0
        vocal_count = 0
        
        genre_scores = self._detect_genres(tracks)
        for genre, score in genre_scores.items():
            if genre in instrumental_genres:
                instrumental_count += score
            elif genre in vocal_genres:
                vocal_count += score
        
        total = instrumental_count + vocal_count
        if total == 0:
            return 0.5
        
        return vocal_count / total
    
    def _get_top_artists(self, tracks: List[Dict], limit: int = 10) -> List[str]:
        """Получает топ-артистов из плейлиста"""
        artist_counts = Counter()
        for track in tracks:
            artist = track.get('artist', 'Неизвестный')
            if artist:
                artist_counts[artist] += 1
        return [artist for artist, _ in artist_counts.most_common(limit)]
    
    def _get_default_profile(self) -> Dict:
        """Возвращает профиль по умолчанию"""
        return {
            'genres': ['pop', 'rock', 'electronic'],
            'genre_scores': {g: 1 for g in ['pop', 'rock', 'electronic']},
            'energy_level': 0.6,
            'era_preference': 0.5,
            'vocal_preference': 0.7,
            'top_artists': [],
            'total_tracks': 0
        }