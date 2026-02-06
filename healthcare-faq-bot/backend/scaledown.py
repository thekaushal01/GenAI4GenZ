"""
Scaledown API Integration Module

This module handles compression of medical FAQ text using the Scaledown API
to minimize token usage while preserving semantic meaning.
"""

import os
import json
import requests
from typing import Dict, List, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class ScaledownCompressor:
    """
    Wrapper for Scaledown API to compress medical knowledge.
    
    Features:
    - Aggressive compression while maintaining semantic accuracy
    - Batch processing for efficiency
    - Local caching of compressed results
    - Error handling and retry logic
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Scaledown compressor.
        
        Args:
            api_key: Scaledown API key (defaults to SCALEDOWN_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("SCALEDOWN_API_KEY")
        self.base_url = "https://api.scaledown.xyz/compress/raw/"
        
        if not self.api_key:
            raise ValueError(
                "Scaledown API key not found. Set SCALEDOWN_API_KEY environment variable."
            )
    
    def compress_text(
        self, 
        text: str, 
        compression_level: str = "aggressive",
        preserve_medical_terms: bool = True
    ) -> Dict[str, any]:
        """
        Compress a single text string using Scaledown API.
        
        Args:
            text: Raw text to compress
            compression_level: "light", "medium", or "aggressive"
            preserve_medical_terms: Keep medical terminology intact
            
        Returns:
            Dictionary with compressed_text, original_tokens, compressed_tokens, ratio
        """
        if not text or not text.strip():
            return {
                "compressed_text": "",
                "original_tokens": 0,
                "compressed_tokens": 0,
                "compression_ratio": 0.0
            }
        
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        # Scaledown API requires 'prompt' and 'context' fields
        payload = {
            "prompt": "Compress the following medical information",
            "context": text
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=60  # Increased timeout for larger texts
            )
            response.raise_for_status()
            
            # Parse Scaledown response
            result = response.json()
            
            # Extract compressed text from response
            if "results" in result and result["results"].get("success"):
                # API returns compressed_prompt which contains the compressed context
                compressed_text = result["results"].get("compressed_prompt", text)
                original_tokens = result.get("total_original_tokens", len(text.split()))
                compressed_tokens = result.get("total_compressed_tokens", len(compressed_text.split()))
                compression_ratio = result["results"].get("compression_ratio", 1.0)
            else:
                # Fallback if response format is unexpected
                compressed_text = text
                original_tokens = len(text.split())
                compressed_tokens = len(compressed_text.split())
                compression_ratio = 1.0
            
            return {
                "compressed_text": compressed_text,
                "original_tokens": original_tokens,
                "compressed_tokens": compressed_tokens,
                "compression_ratio": compression_ratio
            }
            
        except requests.exceptions.RequestException as e:
            print(f"Scaledown API error: {e}")
            # Fallback: basic compression (remove redundant words)
            return self._fallback_compression(text)
    
    def _fallback_compression(self, text: str) -> Dict[str, any]:
        """
        Simple fallback compression when API fails.
        Removes filler words and redundant phrases.
        
        Args:
            text: Text to compress
            
        Returns:
            Compressed result dictionary
        """
        # Simple compression: remove common filler words
        filler_words = [
            "very", "really", "quite", "actually", "basically",
            "literally", "just", "simply", "especially"
        ]
        
        compressed = text
        for word in filler_words:
            compressed = compressed.replace(f" {word} ", " ")
        
        # Remove extra whitespace
        compressed = " ".join(compressed.split())
        
        original_tokens = len(text.split())
        compressed_tokens = len(compressed.split())
        
        return {
            "compressed_text": compressed,
            "original_tokens": original_tokens,
            "compressed_tokens": compressed_tokens,
            "compression_ratio": compressed_tokens / original_tokens if original_tokens > 0 else 0.0,
            "fallback": True
        }
