"""
Retrieval Module

This module handles matching user queries to relevant medical FAQ entries
using semantic similarity and keyword matching.
"""

import json
import re
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from difflib import SequenceMatcher


class MedicalRetriever:
    """
    Retrieves relevant medical information based on user queries.
    
    Features:
    - Keyword-based matching
    - Symptom recognition
    - Disease name matching
    - Semantic similarity scoring
    - Multi-disease context when relevant
    """
    
    def __init__(self, compressed_faq_path: str):
        """
        Initialize retriever with compressed FAQ data.
        
        Args:
            compressed_faq_path: Path to compressed_faq.json
        """
        self.faq_path = Path(compressed_faq_path)
        self.diseases = []
        self.load_faq_data()
        
        # Common symptom keywords for quick matching
        self.symptom_keywords = {
            "fever": ["fever", "temperature", "hot", "burning up"],
            "cough": ["cough", "coughing", "hacking"],
            "pain": ["pain", "ache", "aching", "hurt", "sore"],
            "headache": ["headache", "head pain", "migraine"],
            "fatigue": ["tired", "fatigue", "exhausted", "weakness", "weak"],
            "breathing": ["breath", "breathing", "shortness of breath", "breathe"],
            "nausea": ["nausea", "nauseous", "sick", "vomit"],
            "anxiety": ["anxiety", "anxious", "worry", "panic", "stress"],
            "joint": ["joint", "arthritis", "stiffness"]
        }
    
    def load_faq_data(self):
        """Load FAQ data from file."""
        try:
            with open(self.faq_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.diseases = data.get("diseases", [])
                self.metadata = data.get("metadata", {})
                
            print(f"✅ Loaded {len(self.diseases)} diseases from FAQ database")
            
        except FileNotFoundError:
            print(f"⚠️ Warning: {self.faq_path} not found. Using empty dataset.")
            self.diseases = []
            self.metadata = {}
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing FAQ JSON: {e}")
            self.diseases = []
            self.metadata = {}
    
    def retrieve_relevant_context(
        self,
        user_query: str,
        max_diseases: int = 2,
        min_relevance_score: float = 0.2
    ) -> Dict[str, any]:
        """
        Retrieve most relevant medical information for user query.
        
        Args:
            user_query: User's question
            max_diseases: Maximum number of diseases to include in context
            min_relevance_score: Minimum relevance threshold (0.0 to 1.0)
            
        Returns:
            Dictionary with compressed context and metadata
        """
        if not self.diseases:
            return {
                "compressed_context": "No medical information available.",
                "matched_diseases": [],
                "relevance_scores": [],
                "total_context_tokens": 0
            }
        
        # Score all diseases for relevance
        scored_diseases = []
        for disease in self.diseases:
            score = self._calculate_relevance_score(user_query, disease)
            if score >= min_relevance_score:
                scored_diseases.append((disease, score))
        
        # Sort by score descending
        scored_diseases.sort(key=lambda x: x[1], reverse=True)
        
        # Take top N diseases
        top_diseases = scored_diseases[:max_diseases]
        
        if not top_diseases:
            # No good matches - return general health info
            return {
                "compressed_context": (
                    "I don't have specific information about that topic in my database. "
                    "For personalized medical advice, please consult a healthcare professional."
                ),
                "matched_diseases": [],
                "relevance_scores": [],
                "total_context_tokens": 20
            }
        
        # Build compressed context from top matches
        context_parts = []
        matched_names = []
        scores = []
        total_tokens = 0
        
        for disease, score in top_diseases:
            matched_names.append(disease["name"])
            scores.append(f"{score:.2f}")
            
            # Build context from compressed fields
            disease_context = f"**{disease['name']}**\n"
            
            # Determine which fields to include based on query intent
            intent = self._detect_query_intent(user_query)
            
            if intent == "symptoms" and "symptoms_compressed" in disease:
                disease_context += f"Symptoms: {disease['symptoms_compressed']}\n"
                total_tokens += disease.get("symptoms_tokens", 0)
            
            elif intent == "causes" and "causes_compressed" in disease:
                disease_context += f"Causes: {disease['causes_compressed']}\n"
                total_tokens += disease.get("causes_tokens", 0)
            
            elif intent == "treatment" and "treatments_compressed" in disease:
                disease_context += f"Treatments: {disease['treatments_compressed']}\n"
                total_tokens += disease.get("treatments_tokens", 0)
            
            elif intent == "prevention" and "precautions_compressed" in disease:
                disease_context += f"Precautions: {disease['precautions_compressed']}\n"
                total_tokens += disease.get("precautions_tokens", 0)
            
            else:
                # General query - include all fields
                for field in ["symptoms", "causes", "treatments", "precautions"]:
                    compressed_field = f"{field}_compressed"
                    tokens_field = f"{field}_tokens"
                    
                    if compressed_field in disease:
                        disease_context += f"{field.capitalize()}: {disease[compressed_field]}\n"
                        total_tokens += disease.get(tokens_field, 0)
            
            context_parts.append(disease_context)
        
        compressed_context = "\n\n".join(context_parts)
        
        return {
            "compressed_context": compressed_context,
            "matched_diseases": matched_names,
            "relevance_scores": scores,
            "total_context_tokens": total_tokens,
            "query_intent": intent
        }
    
    def _calculate_relevance_score(self, query: str, disease: Dict) -> float:
        """
        Calculate relevance score between query and disease.
        
        Args:
            query: User query
            disease: Disease dictionary
            
        Returns:
            Relevance score (0.0 to 1.0)
        """
        query_lower = query.lower()
        score = 0.0
        
        # Check disease name match (high weight)
        disease_name = disease["name"].lower()
        if disease_name in query_lower or query_lower in disease_name:
            score += 0.6
        else:
            # Check partial name match
            name_similarity = self._string_similarity(query_lower, disease_name)
            score += name_similarity * 0.4
        
        # Check disease ID match
        if disease["id"] in query_lower:
            score += 0.5
        
        # Check symptom keywords
        symptom_match = self._check_symptom_match(query_lower, disease)
        score += symptom_match * 0.3
        
        # Check for treatment/prevention intent keywords
        intent_keywords = {
            "treat": 0.2, "cure": 0.2, "help": 0.1,
            "prevent": 0.2, "avoid": 0.15,
            "cause": 0.15, "why": 0.1,
            "symptom": 0.15, "sign": 0.1
        }
        
        for keyword, weight in intent_keywords.items():
            if keyword in query_lower:
                score += weight
        
        # Cap at 1.0
        return min(score, 1.0)
    
    def _check_symptom_match(self, query: str, disease: Dict) -> float:
        """
        Check if query mentions symptoms related to disease.
        
        Args:
            query: User query (lowercase)
            disease: Disease dictionary
            
        Returns:
            Match score (0.0 to 1.0)
        """
        # If we have original symptoms (not just compressed), use them
        # For compressed version, we'd need to extract from compressed text
        # This is a simplified version
        
        matched_symptoms = 0
        total_checked = 0
        
        for symptom_category, keywords in self.symptom_keywords.items():
            total_checked += 1
            for keyword in keywords:
                if keyword in query:
                    matched_symptoms += 1
                    break
        
        return matched_symptoms / total_checked if total_checked > 0 else 0.0
    
    def _detect_query_intent(self, query: str) -> str:
        """
        Detect user's intent from query.
        
        Args:
            query: User query
            
        Returns:
            Intent category: symptoms, causes, treatment, prevention, or general
        """
        query_lower = query.lower()
        
        # Symptom intent
        if any(word in query_lower for word in ["symptom", "sign", "feel", "experiencing"]):
            return "symptoms"
        
        # Cause intent
        if any(word in query_lower for word in ["cause", "why", "how do you get", "reason"]):
            return "causes"
        
        # Treatment intent
        if any(word in query_lower for word in ["treat", "cure", "help", "medication", "remedy"]):
            return "treatment"
        
        # Prevention intent
        if any(word in query_lower for word in ["prevent", "avoid", "precaution", "protect"]):
            return "prevention"
        
        return "general"
    
    def _string_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate similarity between two strings.
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Similarity score (0.0 to 1.0)
        """
        return SequenceMatcher(None, s1, s2).ratio()
    
    def get_disease_by_id(self, disease_id: str) -> Optional[Dict]:
        """
        Get specific disease by ID.
        
        Args:
            disease_id: Disease identifier
            
        Returns:
            Disease dictionary or None
        """
        for disease in self.diseases:
            if disease["id"] == disease_id:
                return disease
        return None
    
    def list_all_diseases(self) -> List[str]:
        """
        Get list of all available diseases.
        
        Returns:
            List of disease names
        """
        return [disease["name"] for disease in self.diseases]
