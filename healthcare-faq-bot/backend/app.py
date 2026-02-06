"""
FastAPI Application - Healthcare FAQ Chatbot

This is the main backend server that orchestrates all components:
- Safety filtering
- Medical FAQ retrieval
- Response generation with Gemini
- Token optimization with Scaledown
"""

import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

# Import our custom modules
from retrieval import MedicalRetriever
from gemini import GeminiFlashClient
from safety import SafetyFilter
from scaledown import ScaledownCompressor


# Pydantic models for request/response validation
class ChatMessage(BaseModel):
    """Single chat message."""
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[str] = Field(None, description="ISO timestamp")


class ChatRequest(BaseModel):
    """Chat request from frontend."""
    message: str = Field(..., min_length=1, max_length=1000, description="User's question")
    chat_history: Optional[List[ChatMessage]] = Field(default=[], description="Previous messages")
    session_id: Optional[str] = Field(None, description="Session identifier")


class ChatResponse(BaseModel):
    """Chat response to frontend."""
    response: str = Field(..., description="Bot's response")
    matched_diseases: List[str] = Field(default=[], description="Diseases referenced")
    safety_category: str = Field(..., description="Safety classification")
    token_usage: dict = Field(..., description="Token consumption stats")
    session_id: str = Field(..., description="Session identifier")


class HealthCheck(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    components: dict


# Initialize FastAPI app
app = FastAPI(
    title="Healthcare FAQ Chatbot API",
    description="Educational medical information chatbot with token optimization",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global components (initialized on startup)
retriever: Optional[MedicalRetriever] = None
gemini_client: Optional[GeminiFlashClient] = None
safety_filter: SafetyFilter = SafetyFilter()
scaledown_compressor: Optional[ScaledownCompressor] = None

# Session storage (in production, use Redis or database)
sessions = {}


@app.on_event("startup")
async def startup_event():
    """
    Initialize components on server startup.
    """
    global retriever, gemini_client, scaledown_compressor
    
    print("🚀 Starting Healthcare FAQ Chatbot API...")
    
    # Initialize retriever
    data_dir = Path(__file__).parent.parent / "data"
    
    # Use uncompressed FAQ for retrieval (we'll compress on-the-fly)
    regular_faq = data_dir / "medical_faq.json"
    
    if regular_faq.exists():
        print(f"📚 Loading medical FAQ from {regular_faq}")
        retriever = MedicalRetriever(str(regular_faq))
    else:
        print("⚠️ WARNING: No FAQ data found! Bot will have limited functionality.")
        retriever = None
    
    # Initialize Gemini client
    try:
        gemini_client = GeminiFlashClient()
        print("✅ Gemini 2.5 Flash client initialized")
    except ValueError as e:
        print(f"⚠️ WARNING: {e}")
        print("   Bot will use fallback responses")
        gemini_client = None
    
    # Initialize Scaledown compressor
    try:
        scaledown_compressor = ScaledownCompressor()
        print("✅ Scaledown API initialized for real-time compression")
    except ValueError as e:
        print(f"⚠️ WARNING: {e}")
        print("   Bot will use fallback compression")
        scaledown_compressor = None
    
    print("✅ Server ready!")


@app.get("/", include_in_schema=False)
async def root():
    """Redirect to frontend or API docs."""
    return {
        "message": "Healthcare FAQ Chatbot API",
        "docs": "/api/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthCheck)
async def health_check():
    """
    Health check endpoint for monitoring.
    """
    components = {
        "retriever": "operational" if retriever else "unavailable",
        "gemini": "operational" if gemini_client else "unavailable",
        "scaledown": "operational" if scaledown_compressor else "fallback",
        "safety_filter": "operational"
    }
    
    overall_status = "healthy" if all(
        v == "operational" for k, v in components.items() if k != "safety_filter"
    ) else "degraded"
    
    return HealthCheck(
        status=overall_status,
        timestamp=datetime.utcnow().isoformat(),
        components=components
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint - processes user queries and returns responses.
    
    Flow:
    1. Safety check on user query
    2. Retrieve relevant medical context
    3. Generate response with Gemini
    4. Add safety disclaimer
    5. Return structured response
    """
    try:
        # Step 1: Safety check
        safety_result = safety_filter.check_query_safety(request.message)
        
        # Handle special cases (emergency, diagnosis-seeking, etc.)
        if safety_result.get("requires_special_handling"):
            if not safety_result["is_safe"]:
                # Blocked content
                return ChatResponse(
                    response=safety_result["message"] + safety_result["disclaimer"],
                    matched_diseases=[],
                    safety_category=safety_result["category"],
                    token_usage={"prompt_tokens": 0, "response_tokens": 0, "total_tokens": 0},
                    session_id=request.session_id or "default"
                )
            
            # Emergency or special handling
            if safety_result["category"] == "emergency":
                return ChatResponse(
                    response=safety_result["message"] + safety_result["disclaimer"],
                    matched_diseases=[],
                    safety_category="emergency",
                    token_usage={"prompt_tokens": 0, "response_tokens": 0, "total_tokens": 0},
                    session_id=request.session_id or "default"
                )
            
            # Diagnosis or prescription seeking - provide educational response with warning
            special_message = safety_result["message"]
        else:
            special_message = None
        
        # Step 2: Retrieve relevant context
        if not retriever:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Medical FAQ database not available"
            )
        
        retrieval_result = retriever.retrieve_relevant_context(request.message)
        compressed_context = retrieval_result["compressed_context"]
        matched_diseases = retrieval_result["matched_diseases"]
        
        # Step 2.5: Compress context with Scaledown API in real-time
        original_context_tokens = len(compressed_context.split())
        if scaledown_compressor and compressed_context:
            try:
                print(f"🔄 Compressing context with Scaledown API...")
                compression_result = scaledown_compressor.compress_text(compressed_context)
                compressed_context = compression_result["compressed_text"]
                compressed_tokens = compression_result["compressed_tokens"]
                compression_ratio = compression_result["compression_ratio"]
                print(f"✅ Compressed: {original_context_tokens} → {compressed_tokens} tokens ({compression_ratio:.1%})")
            except Exception as e:
                print(f"⚠️ Scaledown compression failed: {e}, using original context")
                compressed_tokens = original_context_tokens
        else:
            compressed_tokens = original_context_tokens
        
        # Step 3: Generate response with Gemini
        if not gemini_client:
            # Fallback response without LLM
            response_text = (
                f"Based on your query about {', '.join(matched_diseases) if matched_diseases else 'health'},\n\n"
                f"{compressed_context}\n\n"
                "For personalized medical advice, please consult a healthcare professional."
            )
            token_usage = {
                "prompt_tokens": 0,
                "response_tokens": 0,
                "total_tokens": 0,
                "context_tokens": compressed_tokens,
                "original_context_tokens": original_context_tokens
            }
        else:
            # Convert chat history to format Gemini expects
            history = []
            if request.chat_history:
                for msg in request.chat_history[-3:]:  # Last 3 turns
                    history.append({
                        "user": msg.content if msg.role == "user" else "",
                        "assistant": msg.content if msg.role == "assistant" else ""
                    })
            
            # Generate response
            gemini_result = gemini_client.generate_response(
                user_query=request.message,
                compressed_context=compressed_context,
                chat_history=history
            )
            
            response_text = gemini_result["response"]
            token_usage = {
                "prompt_tokens": gemini_result.get("prompt_tokens", 0),
                "response_tokens": gemini_result.get("response_tokens", 0),
                "total_tokens": gemini_result.get("total_tokens", 0),
                "context_tokens": compressed_tokens,
                "original_context_tokens": original_context_tokens,
                "tokens_saved": original_context_tokens - compressed_tokens
            }
            
            # Step 4: Sanitize and add disclaimer
            response_text = safety_filter.sanitize_response(response_text)
        
        # Add special message if needed (diagnosis/prescription warning)
        if special_message:
            response_text = special_message + "\n\n" + response_text
        
        # Ensure disclaimer is present
        response_text = safety_filter.add_disclaimer_to_response(response_text)
        
        # Step 5: Return response
        return ChatResponse(
            response=response_text,
            matched_diseases=matched_diseases,
            safety_category=safety_result["category"],
            token_usage=token_usage,
            session_id=request.session_id or "default"
        )
        
    except Exception as e:
        print(f"❌ Error in chat endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred: {str(e)}"
        )


@app.get("/api/diseases")
async def list_diseases():
    """
    List all available diseases in the FAQ database.
    """
    if not retriever:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Medical FAQ database not available"
        )
    
    diseases = retriever.list_all_diseases()
    return {
        "total": len(diseases),
        "diseases": diseases
    }


@app.get("/api/disease/{disease_id}")
async def get_disease_info(disease_id: str):
    """
    Get detailed information about a specific disease.
    """
    if not retriever:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Medical FAQ database not available"
        )
    
    disease = retriever.get_disease_by_id(disease_id)
    if not disease:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Disease '{disease_id}' not found"
        )
    
    return disease


@app.get("/api/stats")
async def get_stats():
    """
    Get system statistics.
    """
    stats = {
        "total_diseases": len(retriever.diseases) if retriever else 0,
        "gemini_available": gemini_client is not None,
        "retriever_available": retriever is not None,
        "total_sessions": len(sessions),
    }
    
    if retriever and hasattr(retriever, 'metadata'):
        stats.update({
            "compression_ratio": retriever.metadata.get("compression_ratio", "N/A"),
            "total_tokens_saved": (
                retriever.metadata.get("total_original_tokens", 0) -
                retriever.metadata.get("total_compressed_tokens", 0)
            )
        })
    
    return stats


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """General exception handler for unexpected errors."""
    print(f"❌ Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected error occurred. Please try again later.",
            "status_code": 500
        }
    )


# Run with: uvicorn app:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    
    print("Starting Healthcare FAQ Chatbot Server...")
    print("API Docs will be available at: http://localhost:8000/api/docs")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
