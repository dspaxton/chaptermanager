"""
HOG Chapter Manager - AI Service
Provides AI-powered features using Claude API
"""

import os
import uuid
import logging
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import anthropic
import psycopg2
from psycopg2.extras import RealDictCursor
import redis
import httpx
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
def get_db():
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "postgres"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        database=os.getenv("POSTGRES_DB", "chaptermanager"),
        user=os.getenv("POSTGRES_USER", "chaptermanager"),
        password=os.getenv("POSTGRES_PASSWORD"),
        cursor_factory=RealDictCursor
    )
    try:
        yield conn
    finally:
        conn.close()

# Redis connection
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)

# Anthropic client
anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Service starting up...")
    yield
    logger.info("AI Service shutting down...")


app = FastAPI(
    title="HOG Chapter Manager AI Service",
    description="AI-powered features for HOG chapter management",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication dependency
async def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")

    token = authorization[7:]

    # Check blacklist
    if redis_client.get(f"blacklist:{token}"):
        raise HTTPException(status_code=401, detail="Token revoked")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# Request/Response models
class SummarizeRequest(BaseModel):
    content: str
    type: str = "minutes"  # minutes, ride_report, document


class SummarizeResponse(BaseModel):
    summary: str
    actionItems: list = []
    keyDecisions: list = []


class RideSuggestionRequest(BaseModel):
    startLocation: str
    preferredDistance: Optional[int] = 100
    difficulty: Optional[int] = 2
    date: Optional[str] = None
    groupSize: Optional[int] = None


class RideSuggestion(BaseModel):
    title: str
    description: str
    estimatedDistance: int
    estimatedDuration: int
    difficulty: int
    waypoints: list
    safetyNotes: list


class SafetyBriefingRequest(BaseModel):
    rideTitle: str
    rideDate: str
    meetupLocation: str
    destination: str
    estimatedDistance: int
    weatherForecast: Optional[str] = None
    specialInstructions: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    conversationId: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    conversationId: str


class EngagementAnalysisResponse(BaseModel):
    inactiveMembers: list
    engagementTrends: dict
    recommendations: list


# Health check
@app.get("/api/ai/health")
async def health_check():
    return {"status": "healthy", "service": "ai-service"}


# Meeting minutes summarization
@app.post("/api/ai/summarize", response_model=dict)
async def summarize_content(
    request: SummarizeRequest,
    user: dict = Depends(verify_token)
):
    """Generate AI summary of meeting minutes or documents"""

    if request.type == "minutes":
        system_prompt = """You are an assistant helping a Harley Davidson Owners Group (HOG) chapter
summarize their meeting minutes. Extract key information and be concise.

Your response must be a JSON object with these fields:
- summary: A 2-3 paragraph summary of the meeting's key points
- actionItems: An array of action items, each with "title" and optionally "description" and "assignee"
- keyDecisions: An array of important decisions made during the meeting"""

    elif request.type == "ride_report":
        system_prompt = """You are helping summarize a motorcycle ride report for a HOG chapter.
Focus on highlights, challenges, and memorable moments.

Your response must be a JSON object with:
- summary: A engaging summary of the ride
- highlights: Array of ride highlights
- safetyNotes: Any safety observations"""

    else:
        system_prompt = """Summarize this document concisely.

Your response must be a JSON object with:
- summary: A clear, concise summary
- keyPoints: Array of key points from the document"""

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": f"{system_prompt}\n\nContent to summarize:\n\n{request.content}"
                }
            ]
        )

        response_text = message.content[0].text

        # Parse JSON from response
        import json
        try:
            # Try to extract JSON from the response
            if "```json" in response_text:
                json_str = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                json_str = response_text.split("```")[1].split("```")[0]
            else:
                json_str = response_text

            result = json.loads(json_str.strip())
        except json.JSONDecodeError:
            # Fallback: use the raw text as summary
            result = {
                "summary": response_text,
                "actionItems": [],
                "keyDecisions": []
            }

        logger.info(f"Generated summary for {request.type}")

        return {"success": True, "data": result}

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


# Ride route suggestions
@app.post("/api/ai/ride-suggestions", response_model=dict)
async def suggest_rides(
    request: RideSuggestionRequest,
    user: dict = Depends(verify_token)
):
    """Generate AI-powered ride route suggestions"""

    # Get weather if date provided
    weather_info = ""
    if request.date and os.getenv("OPENWEATHER_API_KEY"):
        try:
            # Could integrate with weather API here
            weather_info = f"\nConsider weather conditions for {request.date}."
        except Exception:
            pass

    prompt = f"""You are helping plan a motorcycle ride for a Harley Davidson Owners Group chapter.

Starting Location: {request.startLocation}
Preferred Distance: {request.preferredDistance} miles
Difficulty Level: {request.difficulty}/5 (1=easy scenic, 5=challenging twisties)
Group Size: {request.groupSize or 'Not specified'}
{weather_info}

Suggest 3 different ride routes. For each, provide:
1. A catchy ride title
2. Description of the route and what makes it special
3. Estimated distance in miles
4. Estimated duration in minutes
5. Difficulty rating 1-5
6. Key waypoints/stops (gas, food, scenic overlooks)
7. Safety notes specific to the route

Format your response as a JSON array of ride objects with these fields:
title, description, estimatedDistance, estimatedDuration, difficulty, waypoints (array of strings), safetyNotes (array of strings)"""

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        import json
        try:
            if "```json" in response_text:
                json_str = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                json_str = response_text.split("```")[1].split("```")[0]
            else:
                json_str = response_text
            suggestions = json.loads(json_str.strip())
        except json.JSONDecodeError:
            suggestions = []

        return {"success": True, "data": {"suggestions": suggestions}}

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


# Safety briefing generator
@app.post("/api/ai/safety-briefing", response_model=dict)
async def generate_safety_briefing(
    request: SafetyBriefingRequest,
    user: dict = Depends(verify_token)
):
    """Generate a customized pre-ride safety briefing"""

    prompt = f"""Generate a pre-ride safety briefing for a HOG chapter ride.

Ride Details:
- Title: {request.rideTitle}
- Date: {request.rideDate}
- Meetup: {request.meetupLocation}
- Destination: {request.destination}
- Distance: {request.estimatedDistance} miles
- Weather: {request.weatherForecast or 'Check current conditions'}
- Special Instructions: {request.specialInstructions or 'None'}

Create a comprehensive but concise safety briefing covering:
1. Pre-ride bike check reminders
2. Formation riding guidelines
3. Hand signals review
4. Route-specific hazards to watch for
5. Emergency procedures
6. Communication plan
7. Break/fuel stop information

Format as a well-organized briefing that a Road Captain could read aloud.
Keep it engaging but thorough - safety is serious but doesn't have to be boring!"""

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        briefing = message.content[0].text

        return {"success": True, "data": {"briefing": briefing}}

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


# Member engagement analysis
@app.get("/api/ai/engagement-analysis", response_model=dict)
async def analyze_engagement(
    user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Analyze member engagement and provide recommendations"""

    # Only officers can access this
    if user.get("role") not in ["admin", "director", "officer"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cursor = db.cursor()

    # Get members with low engagement (no rides or meetings in 90 days)
    cursor.execute("""
        SELECT m.id, m.first_name, m.last_name, m.total_rides, m.total_meetings,
               m.chapter_join_date,
               (SELECT MAX(r.start_date) FROM rides r
                JOIN ride_participants rp ON rp.ride_id = r.id
                WHERE rp.member_id = m.id AND rp.attended = true) as last_ride,
               (SELECT MAX(mtg.meeting_date) FROM meetings mtg
                JOIN meeting_attendees ma ON ma.meeting_id = mtg.id
                WHERE ma.member_id = m.id AND ma.attended = true) as last_meeting
        FROM members m
        WHERE m.status = 'active'
        ORDER BY last_ride NULLS FIRST, last_meeting NULLS FIRST
    """)

    members = cursor.fetchall()

    inactive_members = []
    for member in members:
        last_activity = max(
            member['last_ride'] or datetime.min.date(),
            member['last_meeting'] or datetime.min.date()
        )
        days_inactive = (datetime.now().date() - last_activity).days if last_activity != datetime.min.date() else 999

        if days_inactive > 90:
            inactive_members.append({
                "id": member['id'],
                "name": f"{member['first_name']} {member['last_name']}",
                "daysInactive": days_inactive,
                "totalRides": member['total_rides'],
                "totalMeetings": member['total_meetings'],
                "lastRide": str(member['last_ride']) if member['last_ride'] else None,
                "lastMeeting": str(member['last_meeting']) if member['last_meeting'] else None,
            })

    # Generate AI recommendations
    if inactive_members:
        prompt = f"""Analyze this HOG chapter member engagement data and provide recommendations.

Inactive members (90+ days since last activity):
{inactive_members[:10]}  # Top 10 most inactive

Provide:
1. General engagement trends you observe
2. 3-5 specific recommendations to improve member engagement
3. Suggested outreach strategies for inactive members

Keep recommendations practical and specific to motorcycle club culture."""

        try:
            message = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            recommendations = message.content[0].text
        except Exception:
            recommendations = "AI recommendations temporarily unavailable."
    else:
        recommendations = "Great news! All members are actively engaged."

    return {
        "success": True,
        "data": {
            "inactiveMembers": inactive_members[:20],  # Limit to 20
            "totalInactive": len(inactive_members),
            "recommendations": recommendations
        }
    }


# AI Chat (Chapter Assistant)
@app.post("/api/ai/chat", response_model=dict)
async def chat(
    request: ChatRequest,
    user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Chat with the AI chapter assistant"""

    cursor = db.cursor()

    # Get or create conversation
    if request.conversationId:
        cursor.execute(
            "SELECT id FROM ai_conversations WHERE id = %s AND user_id = %s",
            (request.conversationId, user["userId"])
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation_id = request.conversationId
    else:
        conversation_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO ai_conversations (id, user_id, title) VALUES (%s, %s, %s)",
            (conversation_id, user["userId"], request.message[:50])
        )
        db.commit()

    # Get conversation history
    cursor.execute(
        """SELECT role, content FROM ai_messages
           WHERE conversation_id = %s
           ORDER BY created_at ASC
           LIMIT 20""",
        (conversation_id,)
    )
    history = cursor.fetchall()

    # Build messages for Claude
    messages = [{"role": msg["role"], "content": msg["content"]} for msg in history]
    messages.append({"role": "user", "content": request.message})

    system_prompt = """You are a helpful assistant for a Harley Davidson Owners Group (HOG) chapter.
You help members with questions about:
- Chapter activities, rides, and meetings
- HOG membership benefits
- Motorcycle maintenance tips
- Safety information
- General chapter information

Be friendly, knowledgeable, and embody the spirit of HOG - freedom, adventure, and brotherhood/sisterhood.
Keep responses concise but helpful. If you don't know something specific about their chapter,
suggest they check with an officer or the chapter website."""

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=system_prompt,
            messages=messages
        )

        response_text = message.content[0].text

        # Save messages to database
        cursor.execute(
            "INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (%s, %s, %s, %s)",
            (str(uuid.uuid4()), conversation_id, "user", request.message)
        )
        cursor.execute(
            "INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (%s, %s, %s, %s)",
            (str(uuid.uuid4()), conversation_id, "assistant", response_text)
        )
        db.commit()

        return {
            "success": True,
            "data": {
                "message": response_text,
                "conversationId": conversation_id
            }
        }

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")


# Search across chapter data
@app.post("/api/ai/search", response_model=dict)
async def smart_search(
    query: str,
    user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Natural language search across chapter data"""

    cursor = db.cursor()

    # Search rides
    cursor.execute("""
        SELECT 'ride' as type, id, title, description, start_date::text
        FROM rides
        WHERE to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', %s)
        LIMIT 5
    """, (query,))
    rides = cursor.fetchall()

    # Search meetings/minutes
    cursor.execute("""
        SELECT 'minutes' as type, m.id, mtg.title, m.content, mtg.meeting_date::text
        FROM minutes m
        JOIN meetings mtg ON mtg.id = m.meeting_id
        WHERE m.is_published = true
          AND to_tsvector('english', m.content) @@ plainto_tsquery('english', %s)
        LIMIT 5
    """, (query,))
    minutes = cursor.fetchall()

    # Search members (limited for non-officers)
    if user.get("role") in ["admin", "director", "officer"]:
        cursor.execute("""
            SELECT 'member' as type, id, first_name || ' ' || last_name as title,
                   nickname as description, chapter_join_date::text
            FROM members
            WHERE first_name ILIKE %s OR last_name ILIKE %s OR nickname ILIKE %s
            LIMIT 5
        """, (f"%{query}%", f"%{query}%", f"%{query}%"))
        members = cursor.fetchall()
    else:
        members = []

    results = {
        "rides": [dict(r) for r in rides],
        "minutes": [dict(m) for m in minutes],
        "members": [dict(m) for m in members]
    }

    # Generate AI summary of results
    if any(results.values()):
        summary_prompt = f"""Based on these search results for "{query}", provide a brief helpful summary:

Rides: {results['rides'][:3]}
Meeting Minutes: {results['minutes'][:3]}
Members: {results['members'][:3]}

Give a 1-2 sentence summary of what was found."""

        try:
            message = anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=200,
                messages=[{"role": "user", "content": summary_prompt}]
            )
            summary = message.content[0].text
        except Exception:
            summary = f"Found {len(rides)} rides, {len(minutes)} meeting records, and {len(members)} members."
    else:
        summary = "No results found for your search."

    return {
        "success": True,
        "data": {
            "summary": summary,
            "results": results
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4005)
