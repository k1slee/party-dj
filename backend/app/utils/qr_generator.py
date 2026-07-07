import qrcode
import base64
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

class QRGenerator:
    """Генерация QR-кодов для комнат"""
    
    @staticmethod
    def generate_qr(room_id: str, base_url: str = "http://localhost:8081") -> str:
        """Сгенерировать QR-код для комнаты"""
        try:
            join_url = f"{base_url}/join/{room_id}"
            
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(join_url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            logger.info(f"✅ QR-код сгенерирован для комнаты {room_id}")
            return img_str
            
        except Exception as e:
            logger.error(f"❌ Ошибка генерации QR-кода: {e}")
            return None
    
    @staticmethod
    def generate_join_link(room_id: str, base_url: str = "http://localhost:8081") -> str:
        """Сгенерировать ссылку для входа в комнату"""
        return f"{base_url}/join/{room_id}"


# ============================================================
# ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ (добавляем!)
# ============================================================

def get_qr_data(room_id: str, base_url: str = "http://localhost:8081") -> dict:
    """
    Получить данные для QR-кода и ссылки
    
    Args:
        room_id: ID комнаты
        base_url: Базовый URL для фронтенда
    
    Returns:
        dict: Словарь с room_id, join_link и qr_code
    """
    return {
        "room_id": room_id,
        "join_link": QRGenerator.generate_join_link(room_id, base_url),
        "qr_code": QRGenerator.generate_qr(room_id, base_url)
    }