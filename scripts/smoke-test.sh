#!/bin/bash

# HOG Chapter Manager - Smoke Test Script
# Run this script to verify basic functionality

BASE_URL="${BASE_URL:-http://localhost}"
PASS=0
FAIL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "HOG Chapter Manager - Smoke Test"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Helper function to test an endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    local auth="$6"

    local headers="-H 'Content-Type: application/json'"
    if [ -n "$auth" ]; then
        headers="$headers -H 'Authorization: Bearer $auth'"
    fi

    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$BASE_URL$endpoint" -H "Content-Type: application/json" ${auth:+-H "Authorization: Bearer $auth"} -d "$data")
    else
        response=$(curl -s "$BASE_URL$endpoint" -H "Content-Type: application/json" ${auth:+-H "Authorization: Bearer $auth"})
    fi

    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}[PASS]${NC} $name"
        ((PASS++))
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name"
        echo "       Response: ${response:0:200}"
        ((FAIL++))
        return 1
    fi
}

# Test 1: Frontend is accessible
echo ""
echo "--- Frontend Tests ---"
response=$(curl -s "$BASE_URL" 2>&1)
if echo "$response" | grep -q "HOG Chapter Manager"; then
    echo -e "${GREEN}[PASS]${NC} Frontend loads"
    ((PASS++))
else
    echo -e "${RED}[FAIL]${NC} Frontend loads"
    ((FAIL++))
fi

# Test 2: Health check
echo ""
echo "--- Health Check Tests ---"
test_endpoint "Auth service health" "GET" "/api/auth/health" "" "healthy"

# Test 3: Login
echo ""
echo "--- Authentication Tests ---"
login_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@chapter.local","password":"Password123"}')

if echo "$login_response" | grep -q "accessToken"; then
    echo -e "${GREEN}[PASS]${NC} Login with valid credentials"
    ((PASS++))
    TOKEN=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}[FAIL]${NC} Login with valid credentials"
    echo "       Response: ${login_response:0:200}"
    ((FAIL++))
    TOKEN=""
fi

# Test invalid login
invalid_login=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@chapter.local","password":"wrongpassword"}')

if echo "$invalid_login" | grep -q "Invalid credentials"; then
    echo -e "${GREEN}[PASS]${NC} Login with invalid credentials returns error"
    ((PASS++))
else
    echo -e "${RED}[FAIL]${NC} Login with invalid credentials returns error"
    ((FAIL++))
fi

# Test 4: Protected endpoints (require auth)
if [ -n "$TOKEN" ]; then
    echo ""
    echo "--- Protected Endpoint Tests ---"

    # Get current user
    me_response=$(curl -s "$BASE_URL/api/auth/me" -H "Authorization: Bearer $TOKEN")
    if echo "$me_response" | grep -q "admin@chapter.local"; then
        echo -e "${GREEN}[PASS]${NC} Get current user (/api/auth/me)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get current user (/api/auth/me)"
        ((FAIL++))
    fi

    # Members list
    members_response=$(curl -s "$BASE_URL/api/members" -H "Authorization: Bearer $TOKEN")
    if echo "$members_response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Get members list (/api/members)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get members list (/api/members)"
        ((FAIL++))
    fi

    # Member stats
    stats_response=$(curl -s "$BASE_URL/api/members/stats/overview" -H "Authorization: Bearer $TOKEN")
    if echo "$stats_response" | grep -q "activeMembers"; then
        echo -e "${GREEN}[PASS]${NC} Get member stats (/api/members/stats/overview)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get member stats (/api/members/stats/overview)"
        ((FAIL++))
    fi

    # Rides list
    rides_response=$(curl -s "$BASE_URL/api/rides" -H "Authorization: Bearer $TOKEN")
    if echo "$rides_response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Get rides list (/api/rides)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get rides list (/api/rides)"
        ((FAIL++))
    fi

    # Upcoming rides
    upcoming_rides=$(curl -s "$BASE_URL/api/rides/upcoming" -H "Authorization: Bearer $TOKEN")
    if echo "$upcoming_rides" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Get upcoming rides (/api/rides/upcoming)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get upcoming rides (/api/rides/upcoming)"
        ((FAIL++))
    fi

    # Meetings list
    meetings_response=$(curl -s "$BASE_URL/api/meetings" -H "Authorization: Bearer $TOKEN")
    if echo "$meetings_response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Get meetings list (/api/meetings)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get meetings list (/api/meetings)"
        ((FAIL++))
    fi

    # Upcoming meetings
    upcoming_meetings=$(curl -s "$BASE_URL/api/meetings/upcoming" -H "Authorization: Bearer $TOKEN")
    if echo "$upcoming_meetings" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Get upcoming meetings (/api/meetings/upcoming)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get upcoming meetings (/api/meetings/upcoming)"
        ((FAIL++))
    fi

    # All minutes
    minutes_response=$(curl -s "$BASE_URL/api/meetings/all/minutes" -H "Authorization: Bearer $TOKEN")
    if echo "$minutes_response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Get all minutes (/api/meetings/all/minutes)"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Get all minutes (/api/meetings/all/minutes)"
        ((FAIL++))
    fi

    echo ""
    echo "--- Authorization Tests ---"

    # Test without auth token
    no_auth_response=$(curl -s "$BASE_URL/api/members")
    if echo "$no_auth_response" | grep -q "No token\|Unauthorized\|error"; then
        echo -e "${GREEN}[PASS]${NC} Protected endpoint rejects no auth"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Protected endpoint rejects no auth"
        ((FAIL++))
    fi

    # Test with invalid token
    invalid_token_response=$(curl -s "$BASE_URL/api/members" -H "Authorization: Bearer invalid_token_here")
    if echo "$invalid_token_response" | grep -q "Invalid\|Unauthorized\|error"; then
        echo -e "${GREEN}[PASS]${NC} Protected endpoint rejects invalid token"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} Protected endpoint rejects invalid token"
        ((FAIL++))
    fi
fi

# Test 5: Create data (if tests pass so far)
if [ -n "$TOKEN" ] && [ $FAIL -eq 0 ]; then
    echo ""
    echo "--- Data Creation Tests ---"

    # Create a test ride
    create_ride_response=$(curl -s -X POST "$BASE_URL/api/rides" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "Smoke Test Ride",
            "description": "Automated test ride",
            "startDate": "2026-02-01",
            "startTime": "09:00",
            "rideType": "chapter_ride",
            "difficulty": 2,
            "meetupLocation": "Test Location",
            "estimatedDistance": 50,
            "rsvpRequired": false
        }')

    if echo "$create_ride_response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Create ride"
        ((PASS++))
        RIDE_ID=$(echo "$create_ride_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    else
        echo -e "${RED}[FAIL]${NC} Create ride"
        echo "       Response: ${create_ride_response:0:200}"
        ((FAIL++))
    fi

    # Create a test meeting
    create_meeting_response=$(curl -s -X POST "$BASE_URL/api/meetings" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "Smoke Test Meeting",
            "meetingType": "chapter",
            "meetingDate": "2026-02-01",
            "startTime": "19:00",
            "location": "Test Location",
            "isVirtual": false
        }')

    if echo "$create_meeting_response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} Create meeting"
        ((PASS++))
        MEETING_ID=$(echo "$create_meeting_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    else
        echo -e "${RED}[FAIL]${NC} Create meeting"
        echo "       Response: ${create_meeting_response:0:200}"
        ((FAIL++))
    fi
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
