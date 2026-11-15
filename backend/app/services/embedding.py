import hashlib
import logging
import math
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_model_instance = None

def _deterministic_transformer_fallback(text: str, dim: int = 384) -> List[float]:
    """
    Self-contained, deterministic embedding fallback that produces
    a unit-normalized vector of dimension `dim` using token hashing and n-grams.
    Ensures zero external network dependencies when running tests or in offline environments.
    """
    vec = [0.0] * dim
    clean_text = text.lower().strip()
    words = clean_text.split()
    
    # Token hashing
    for i, word in enumerate(words):
        h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        val = ((h >> 8) % 1000) / 1000.0 - 0.5
        vec[idx] += val * (1.0 / (i + 1.0)**0.3)
        
    # Character 3-grams
    for i in range(len(clean_text) - 2):
        trigram = clean_text[i:i+3]
        h = int(hashlib.md5(trigram.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 0.1

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 1e-12:
        vec = [x / norm for x in vec]
    else:
        vec[0] = 1.0
    return vec

def get_embedding_model():
    """Lazily loads the transformer embedding model if available."""
    global _model_instance
    if _model_instance is not None:
        return _model_instance
    
    try:
        from sentence_transformers import SentenceTransformer
        _model_instance = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        logger.info(f"Loaded sentence transformer model: {settings.EMBEDDING_MODEL_NAME}")
        return _model_instance
    except Exception as e:
        logger.warning(
            f"Could not load sentence_transformers ({e}). Using deterministic self-hosted embedding fallback."
        )
        return None

def generate_embedding(text: str) -> List[float]:
    """Generates a normalized float embedding vector for a single text chunk."""
    model = get_embedding_model()
    if model is not None:
        try:
            emb = model.encode(text, normalize_embeddings=True)
            return emb.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding with model: {e}")
            
    return _deterministic_transformer_fallback(text, dim=settings.EMBEDDING_DIMENSION)

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generates normalized embeddings for multiple text chunks."""
    model = get_embedding_model()
    if model is not None:
        try:
            embs = model.encode(texts, normalize_embeddings=True)
            return embs.tolist()
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            
    return [_deterministic_transformer_fallback(t, dim=settings.EMBEDDING_DIMENSION) for t in texts]
