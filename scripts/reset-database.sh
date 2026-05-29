#!/bin/bash
# =============================================================================
# HOG Chapter Manager - Database Reset Script
# Resets the database to initial state with only the admin user
# =============================================================================

set -e

# Configuration
CONTAINER_NAME="hog-postgres"
DB_NAME="chaptermanager"
DB_USER="chaptermanager"

echo "=== HOG Chapter Manager Database Reset ==="
echo ""

# Check if we should proceed
if [ "$1" != "-f" ] && [ "$1" != "--force" ]; then
    read -p "This will DELETE ALL DATA and reset to admin only. Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo "Resetting database..."

# Run the SQL commands inside the postgres container
finch exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME << 'EOSQL'
-- =============================================================================
-- TRUNCATE ALL TABLES (in dependency order)
-- =============================================================================

-- Disable triggers temporarily for clean truncation
SET session_replication_role = 'replica';

-- AI/Notifications
TRUNCATE TABLE ai_messages CASCADE;
TRUNCATE TABLE ai_conversations CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- Documents
TRUNCATE TABLE documents CASCADE;

-- Mileage
TRUNCATE TABLE mileage_logs CASCADE;

-- Meetings
TRUNCATE TABLE motions CASCADE;
TRUNCATE TABLE action_items CASCADE;
TRUNCATE TABLE minutes CASCADE;
TRUNCATE TABLE meeting_attendees CASCADE;
TRUNCATE TABLE meetings CASCADE;

-- Rides
TRUNCATE TABLE ride_photos CASCADE;
TRUNCATE TABLE ride_participants CASCADE;
TRUNCATE TABLE ride_waypoints CASCADE;
TRUNCATE TABLE rides CASCADE;

-- Members
TRUNCATE TABLE member_positions CASCADE;
TRUNCATE TABLE member_bikes CASCADE;
TRUNCATE TABLE members CASCADE;

-- Auth/Users
TRUNCATE TABLE password_resets CASCADE;
TRUNCATE TABLE refresh_tokens CASCADE;
TRUNCATE TABLE user_oauth CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- =============================================================================
-- RE-SEED ADMIN USER
-- =============================================================================

-- Create default admin user (password: Password123)
INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@chapter.local',
    '$2a$12$R6gp7mWo351ZsPoWW9qL7uLCGPN0dzkeZU3v4H15CAaYzVlh4RSie',
    'admin',
    true,
    true
);

-- Create admin member profile
INSERT INTO members (
    id,
    user_id,
    first_name,
    last_name,
    status,
    chapter_join_date
)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Chapter',
    'Administrator',
    'active',
    CURRENT_DATE
);

-- Assign admin position
INSERT INTO member_positions (
    member_id,
    position_title,
    start_date,
    is_current
)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'Chapter Administrator',
    CURRENT_DATE,
    true
);

-- Output summary
SELECT 'Database reset complete!' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as member_count FROM members;
EOSQL

echo ""
echo "=== Reset Complete ==="
echo "Admin user: admin@chapter.local"
echo "Password: Password123"
echo ""
