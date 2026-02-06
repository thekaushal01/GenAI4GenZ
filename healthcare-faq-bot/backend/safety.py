"""
Safety Module

This module implements safety filters and disclaimers to ensure
the chatbot provides educational information only and never attempts
to diagnose or prescribe medication.
"""

import re
from typing import Dict, Tuple, List


class SafetyFilter:
    """
    Implements safety checks and content filtering for medical chatbot.
    
    Features:
    - Detects diagnosis-seeking queries
    - Identifies prescription requests
    - Blocks inappropriate medical advice
    - Adds mandatory disclaimers
    - Filters harmful or dangerous content
    """
    
    def __init__(self):
        """Initialize safety filter with keywords and patterns."""
        
        # Patterns that indicate diagnosis-seeking behavior
        self.diagnosis_patterns = [
            r"\bdo i have\b",
            r"\bam i\b.*\b(sick|ill|infected|diseased)\b",
            r"\bwhat('s| is) wrong with me\b",
            r"\bdiagnose\b",
            r"\bwhat (disease|illness|condition) do i have\b",
            r"\bis this\b.*\b(cancer|tumor|serious)\b",
            r"\bshould i (be worried|worry|panic)\b"
        ]
        
        # Patterns for prescription/dosage requests
        self.prescription_patterns = [
            r"\bhow much\b.*\b(medication|medicine|drug|pill)\b",
            r"\bwhat (dosage|dose)\b",
            r"\bcan i take\b.*\b(mg|milligrams|tablets)\b",
            r"\bprescribe\b",
            r"\brecommend.*\b(medication|medicine|drug)\b",
            r"\bshould i (take|use|try)\b.*\b(medication|medicine|drug|antibiotic)\b"
        ]
        
        # Emergency keywords that require immediate medical attention
        self.emergency_keywords = [
            "chest pain", "heart attack", "stroke", "can't breathe",
            "severe bleeding", "unconscious", "overdose", "suicide",
            "severe pain", "emergency", "life threatening"
        ]
        
        # Inappropriate topics to block
        self.blocked_topics = [
            "abortion", "euthanasia", "substance abuse for recreation",
            "self-harm methods", "illegal drugs"
        ]
        
        # Medical disclaimer text
        self.disclaimer = (
            "\n\n⚕️ **Important:** This information is for educational purposes only. "
            "Please consult a qualified healthcare professional for medical advice, "
            "diagnosis, or treatment."
        )
        
        self.emergency_disclaimer = (
            "\n\n🚨 **EMERGENCY:** If you are experiencing a medical emergency, "
            "please call emergency services (911 in US) or go to the nearest "
            "emergency room immediately. This chatbot cannot provide emergency medical care."
        )
    
    def check_query_safety(self, user_query: str) -> Dict[str, any]:
        """
        Check if user query is safe and appropriate.
        
        Args:
            user_query: User's input query
            
        Returns:
            Dictionary with safety status and recommended action
        """
        query_lower = user_query.lower()
        
        # Check for emergency keywords
        if self._contains_emergency_keywords(query_lower):
            return {
                "is_safe": True,
                "requires_special_handling": True,
                "category": "emergency",
                "message": (
                    "I detect you may be experiencing a medical emergency. "
                    "Please seek immediate medical attention by calling emergency "
                    "services or going to the nearest emergency room."
                ),
                "disclaimer": self.emergency_disclaimer
            }
        
        # Check for diagnosis-seeking
        if self._matches_patterns(query_lower, self.diagnosis_patterns):
            return {
                "is_safe": True,
                "requires_special_handling": True,
                "category": "diagnosis_seeking",
                "message": (
                    "I cannot provide medical diagnoses. I can share general "
                    "educational information about symptoms and conditions, but "
                    "a qualified healthcare professional must evaluate your specific "
                    "situation for an accurate diagnosis."
                ),
                "disclaimer": self.disclaimer
            }
        
        # Check for prescription requests
        if self._matches_patterns(query_lower, self.prescription_patterns):
            return {
                "is_safe": True,
                "requires_special_handling": True,
                "category": "prescription_seeking",
                "message": (
                    "I cannot recommend specific medications or dosages. "
                    "Medication decisions should only be made by licensed healthcare "
                    "professionals who can evaluate your medical history and current health status. "
                    "Please consult your doctor or pharmacist."
                ),
                "disclaimer": self.disclaimer
            }
        
        # Check for blocked topics
        if self._contains_blocked_topics(query_lower):
            return {
                "is_safe": False,
                "requires_special_handling": True,
                "category": "blocked_topic",
                "message": (
                    "I'm unable to provide information on this topic. "
                    "For sensitive medical matters, please speak with a "
                    "qualified healthcare professional or counselor."
                ),
                "disclaimer": self.disclaimer
            }
        
        # Query is safe for general educational response
        return {
            "is_safe": True,
            "requires_special_handling": False,
            "category": "general_educational",
            "message": None,
            "disclaimer": self.disclaimer
        }
    
    def add_disclaimer_to_response(self, response: str) -> str:
        """
        Add safety disclaimer to bot response if not already present.
        
        Args:
            response: Bot's response text
            
        Returns:
            Response with disclaimer appended
        """
        # Check if disclaimer already present
        if "educational purposes only" in response.lower():
            return response
        
        # Add disclaimer
        return response + self.disclaimer
    
    def sanitize_response(self, response: str) -> str:
        """
        Remove any potentially harmful content from response.
        
        Args:
            response: Raw response from LLM
            
        Returns:
            Sanitized response
        """
        # Remove any specific dosage information
        response = re.sub(
            r'\b\d+\s*(mg|milligrams?|ml|milliliters?|tablets?|pills?|capsules?)\b',
            '[consult healthcare provider for dosage]',
            response,
            flags=re.IGNORECASE
        )
        
        # Remove phrases that could be interpreted as diagnosis
        diagnosis_phrases = [
            "you have", "you are suffering from", "you've got",
            "you definitely have", "you might have"
        ]
        for phrase in diagnosis_phrases:
            response = response.replace(phrase, "this could be related to")
        
        return response
    
    def _matches_patterns(self, text: str, patterns: List[str]) -> bool:
        """
        Check if text matches any of the given regex patterns.
        
        Args:
            text: Text to check
            patterns: List of regex patterns
            
        Returns:
            True if any pattern matches
        """
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def _contains_emergency_keywords(self, text: str) -> bool:
        """
        Check if text contains emergency keywords.
        
        Args:
            text: Text to check
            
        Returns:
            True if emergency keywords found
        """
        for keyword in self.emergency_keywords:
            if keyword in text:
                return True
        return False
    
    def _contains_blocked_topics(self, text: str) -> bool:
        """
        Check if text contains blocked topics.
        
        Args:
            text: Text to check
            
        Returns:
            True if blocked topics found
        """
        for topic in self.blocked_topics:
            if topic in text:
                return True
        return False
    
    def validate_response_quality(self, response: str) -> Tuple[bool, str]:
        """
        Validate that response meets quality and safety standards.
        
        Args:
            response: Generated response
            
        Returns:
            Tuple of (is_valid, reason)
        """
        # Check minimum length
        if len(response.strip()) < 20:
            return False, "Response too short"
        
        # Check for disclaimer
        if "educational purposes" not in response.lower():
            return False, "Missing disclaimer"
        
        # Check for inappropriate diagnosis language
        diagnosis_words = ["you have", "you are suffering from", "diagnosed with"]
        if any(phrase in response.lower() for phrase in diagnosis_words):
            return False, "Contains diagnostic language"
        
        # Check for specific medication dosages
        if re.search(r'\d+\s*(mg|ml|tablets?)', response, re.IGNORECASE):
            return False, "Contains specific dosage information"
        
        return True, "Valid"
    
    def get_safe_fallback_response(self, category: str = "general") -> str:
        """
        Get a safe fallback response when something goes wrong.
        
        Args:
            category: Type of fallback needed
            
        Returns:
            Safe fallback message
        """
        fallbacks = {
            "general": (
                "I apologize, but I'm unable to provide a complete answer to your question. "
                "For personalized medical advice, please consult a qualified healthcare professional."
            ),
            "emergency": (
                "If you are experiencing a medical emergency, please call emergency services "
                "immediately or go to the nearest emergency room. Do not rely on this chatbot "
                "for emergency medical care."
            ),
            "error": (
                "I'm experiencing technical difficulties. Please try again later. "
                "If you have urgent medical concerns, please contact a healthcare provider."
            )
        }
        
        return fallbacks.get(category, fallbacks["general"]) + self.disclaimer
