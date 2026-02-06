"""
Gemini 2.5 Flash API Integration Module

This module provides a clean wrapper around Google's Gemini 2.5 Flash API
for fast, cost-effective response generation.
"""

import os
import json
from typing import Dict, List, Optional
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()


class GeminiFlashClient:
    """
    Wrapper for Gemini 2.5 Flash API.
    
    Features:
    - Fast response generation
    - Safety settings configured for medical content
    - Streaming support
    - Temperature control for consistent responses
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini Flash client.
        
        Args:
            api_key: Google AI API key (defaults to GEMINI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        
        if not self.api_key:
            raise ValueError(
                "Gemini API key not found. Set GEMINI_API_KEY environment variable."
            )
        
        # Configure the API
        genai.configure(api_key=self.api_key)
        
        # Initialize model with safety settings
        self.model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",  # Using Gemini 2.5 Flash (latest stable)
            safety_settings=self._get_safety_settings(),
            generation_config=self._get_generation_config()
        )
    
    def _get_safety_settings(self) -> List[Dict]:
        """
        Configure safety settings for medical content.
        
        Returns:
            Safety settings configuration
        """
        return [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    
    def _get_generation_config(self) -> Dict:
        """
        Configure generation parameters for consistent, factual responses.
        
        Returns:
            Generation configuration
        """
        return {
            "temperature": 0.3,  # Low temperature for factual, consistent responses
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 1024,  # Reasonable limit for FAQ responses
        }
    
    def generate_response(
        self,
        user_query: str,
        compressed_context: str,
        chat_history: Optional[List[Dict]] = None
    ) -> Dict[str, any]:
        """
        Generate a response to user query using compressed medical context.
        
        Args:
            user_query: User's question
            compressed_context: Compressed medical information
            chat_history: Optional chat history for context
            
        Returns:
            Dictionary with response, token usage, and metadata
        """
        # Build the prompt
        prompt = self._build_prompt(user_query, compressed_context, chat_history)
        
        try:
            # Generate response
            response = self.model.generate_content(prompt)
            
            # Extract response text
            response_text = response.text
            
            # Count tokens (approximate)
            prompt_tokens = self._estimate_tokens(prompt)
            response_tokens = self._estimate_tokens(response_text)
            
            return {
                "response": response_text,
                "prompt_tokens": prompt_tokens,
                "response_tokens": response_tokens,
                "total_tokens": prompt_tokens + response_tokens,
                "model": "gemini-2.5-flash",
                "finish_reason": response.candidates[0].finish_reason.name if response.candidates else "UNKNOWN"
            }
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            return {
                "response": self._get_error_response(),
                "error": str(e),
                "prompt_tokens": 0,
                "response_tokens": 0,
                "total_tokens": 0
            }
    
    def _build_prompt(
        self,
        user_query: str,
        compressed_context: str,
        chat_history: Optional[List[Dict]] = None
    ) -> str:
        """
        Build the complete prompt for Gemini.
        
        Args:
            user_query: User's question
            compressed_context: Compressed medical knowledge
            chat_history: Previous conversation turns
            
        Returns:
            Formatted prompt string
        """
        # System instructions
        system_prompt = """You are a helpful Healthcare FAQ Assistant that provides educational medical information.

IMPORTANT RULES:
1. Provide EDUCATIONAL information ONLY - never diagnose or prescribe
2. Use clear, simple language that patients can understand
3. Be empathetic and supportive in tone
4. Always end responses with the safety disclaimer
5. If unsure or question is outside scope, recommend seeing a healthcare professional
6. Never recommend specific medication dosages
7. Focus on general wellness and prevention

FORMATTING REQUIREMENTS:
- Use bullet points (•) for lists of symptoms, causes, treatments, or precautions
- Structure your response with clear sections when relevant
- Keep each point concise (1-2 sentences maximum)
- Use line breaks between sections for readability
- Avoid long paragraphs - break information into digestible chunks
- Use bold headers (e.g., **Symptoms:** or **Treatment:**) to organize information

Your responses should:
- Be factual and evidence-based
- Explain medical concepts in simple terms
- Encourage professional medical consultation when appropriate
- Be well-organized and easy to scan"""

        # Build context section
        context_section = f"\n\nRELEVANT MEDICAL INFORMATION:\n{compressed_context}\n"
        
        # Build chat history section
        history_section = ""
        if chat_history:
            history_section = "\n\nCONVERSATION HISTORY:\n"
            for turn in chat_history[-3:]:  # Include last 3 turns for context
                history_section += f"User: {turn.get('user', '')}\n"
                history_section += f"Assistant: {turn.get('assistant', '')}\n\n"
        
        # Build user query section
        query_section = f"\n\nCURRENT USER QUESTION:\n{user_query}\n"
        
        # Disclaimer reminder
        disclaimer_reminder = """

REMEMBER: Always end your response with this disclaimer:
"⚕️ This information is for educational purposes only. Please consult a qualified healthcare professional for medical advice, diagnosis, or treatment."
"""
        
        # Combine all sections
        full_prompt = (
            system_prompt +
            context_section +
            history_section +
            query_section +
            disclaimer_reminder
        )
        
        return full_prompt
    
    def _estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for text.
        Rough approximation: 1 token ≈ 4 characters.
        
        Args:
            text: Text to count tokens for
            
        Returns:
            Estimated token count
        """
        return len(text) // 4
    
    def _get_error_response(self) -> str:
        """
        Return a safe error response.
        
        Returns:
            Error message for users
        """
        return (
            "I apologize, but I'm currently unable to process your request. "
            "Please try again in a moment. If you have urgent medical concerns, "
            "please contact a healthcare professional or emergency services immediately.\n\n"
            "⚕️ This information is for educational purposes only. Please consult a "
            "qualified healthcare professional for medical advice, diagnosis, or treatment."
        )
    
    def stream_response(
        self,
        user_query: str,
        compressed_context: str,
        chat_history: Optional[List[Dict]] = None
    ):
        """
        Generate streaming response for real-time display.
        
        Args:
            user_query: User's question
            compressed_context: Compressed medical information
            chat_history: Optional chat history
            
        Yields:
            Response chunks as they're generated
        """
        prompt = self._build_prompt(user_query, compressed_context, chat_history)
        
        try:
            response = self.model.generate_content(prompt, stream=True)
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            print(f"Streaming error: {e}")
            yield self._get_error_response()
