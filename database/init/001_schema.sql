-- =============================================================================
-- HOG Chapter Manager - Database Schema
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM (
    'admin',
    'director',
    'officer',
    'road_captain',
    'member',
    'prospect'
);

CREATE TYPE member_status AS ENUM (
    'active',
    'inactive',
    'prospect',
    'suspended',
    'honorary'
);

CREATE TYPE ride_status AS ENUM (
    'draft',
    'published',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE ride_type AS ENUM (
    'chapter_ride',
    'overnight',
    'multi_day',
    'dealer_event',
    'charity',
    'rally',
    'other'
);

CREATE TYPE meeting_type AS ENUM (
    'chapter',
    'officer',
    'committee',
    'special',
    'annual'
);

CREATE TYPE meeting_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE action_item_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE rsvp_status AS ENUM (
    'going',
    'maybe',
    'not_going'
);

-- =============================================================================
-- USERS & AUTHENTICATION
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_oauth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MEMBERS
-- =============================================================================

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Personal info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    phone VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),

    -- HOG info
    hog_number VARCHAR(50),
    national_hog_expiry DATE,
    chapter_join_date DATE,

    -- Member status
    status member_status DEFAULT 'active',

    -- Emergency contact
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(100),

    -- Preferences
    photo_url VARCHAR(500),
    bio TEXT,
    is_public_directory BOOLEAN DEFAULT true,

    -- Tracking
    total_mileage INTEGER DEFAULT 0,
    total_rides INTEGER DEFAULT 0,
    total_meetings INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE member_bikes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    year INTEGER,
    make VARCHAR(100) DEFAULT 'Harley-Davidson',
    model VARCHAR(100),
    nickname VARCHAR(100),
    color VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    photo_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE member_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    position_title VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- RIDES
-- =============================================================================

CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ride_type ride_type DEFAULT 'chapter_ride',
    status ride_status DEFAULT 'draft',

    -- Schedule
    start_date DATE NOT NULL,
    start_time TIME,
    end_date DATE,
    end_time TIME,

    -- Meetup location
    meetup_location VARCHAR(255),
    meetup_address VARCHAR(500),
    meetup_lat DECIMAL(10, 8),
    meetup_lng DECIMAL(11, 8),

    -- Destination
    destination VARCHAR(255),
    destination_address VARCHAR(500),
    destination_lat DECIMAL(10, 8),
    destination_lng DECIMAL(11, 8),

    -- Ride details
    estimated_distance INTEGER, -- in miles
    estimated_duration INTEGER, -- in minutes
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    route_description TEXT,
    route_map_url VARCHAR(500),

    -- RSVP settings (opt-in per ride)
    rsvp_required BOOLEAN DEFAULT false,
    rsvp_deadline TIMESTAMP WITH TIME ZONE,
    max_participants INTEGER,

    -- Post-ride
    actual_distance INTEGER,
    actual_duration INTEGER,
    weather_conditions VARCHAR(255),
    ride_report TEXT,

    -- Road captain
    lead_road_captain_id UUID REFERENCES members(id),
    sweep_road_captain_id UUID REFERENCES members(id),

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ride_waypoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    name VARCHAR(255),
    address VARCHAR(500),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    stop_type VARCHAR(50), -- 'gas', 'food', 'rest', 'photo', 'destination'
    estimated_arrival_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ride_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,

    -- RSVP (only used if ride.rsvp_required = true)
    rsvp_status rsvp_status,
    rsvp_date TIMESTAMP WITH TIME ZONE,
    guests INTEGER DEFAULT 0,

    -- Attendance (recorded after ride)
    attended BOOLEAN,
    mileage_logged INTEGER,

    -- Role on this ride
    is_road_captain BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ride_id, member_id)
);

CREATE TABLE ride_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES members(id),
    photo_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    caption TEXT,
    ai_caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MEETINGS
-- =============================================================================

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic info
    title VARCHAR(255) NOT NULL,
    meeting_type meeting_type DEFAULT 'chapter',
    status meeting_status DEFAULT 'scheduled',

    -- Schedule
    meeting_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,

    -- Location
    location VARCHAR(255),
    address VARCHAR(500),
    is_virtual BOOLEAN DEFAULT false,
    virtual_link VARCHAR(500),

    -- Content
    agenda TEXT,

    -- Tracking
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meeting_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    attended BOOLEAN DEFAULT false,
    arrived_at TIME,
    left_at TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(meeting_id, member_id)
);

CREATE TABLE minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,

    -- Content
    content TEXT NOT NULL,
    summary TEXT,
    ai_summary TEXT,

    -- Metadata
    recorded_by UUID REFERENCES members(id),
    approved_by UUID REFERENCES members(id),
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Version control
    version INTEGER DEFAULT 1,
    is_published BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    minutes_id UUID REFERENCES minutes(id) ON DELETE SET NULL,

    -- Content
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Assignment
    assigned_to UUID REFERENCES members(id),
    assigned_by UUID REFERENCES members(id),

    -- Status
    status action_item_status DEFAULT 'pending',
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Priority
    priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),

    -- Tracking
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE motions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,

    -- Motion details
    motion_text TEXT NOT NULL,
    proposed_by UUID REFERENCES members(id),
    seconded_by UUID REFERENCES members(id),

    -- Voting
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    passed BOOLEAN,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MILEAGE TRACKING
-- =============================================================================

CREATE TABLE mileage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,

    date DATE NOT NULL,
    miles INTEGER NOT NULL,
    description VARCHAR(255),
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES members(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DOCUMENTS
-- =============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),

    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,

    is_public BOOLEAN DEFAULT false,

    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- AI CHAT HISTORY
-- =============================================================================

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),

    read_at TIMESTAMP WITH TIME ZONE,

    -- Reference to related entity
    reference_type VARCHAR(50),
    reference_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Members
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_name ON members(last_name, first_name);
CREATE INDEX idx_members_hog_number ON members(hog_number);

-- Rides
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_start_date ON rides(start_date);
CREATE INDEX idx_rides_type ON rides(ride_type);
CREATE INDEX idx_ride_participants_ride ON ride_participants(ride_id);
CREATE INDEX idx_ride_participants_member ON ride_participants(member_id);

-- Meetings
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_type ON meetings(meeting_type);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);

-- Action items
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_assigned ON action_items(assigned_to);
CREATE INDEX idx_action_items_due ON action_items(due_date);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Full text search
CREATE INDEX idx_rides_search ON rides USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_minutes_search ON minutes USING gin(to_tsvector('english', content));
CREATE INDEX idx_documents_search ON documents USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to relevant tables
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_members_timestamp BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rides_timestamp BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_meetings_timestamp BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_minutes_timestamp BEFORE UPDATE ON minutes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_action_items_timestamp BEFORE UPDATE ON action_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update member stats function
CREATE OR REPLACE FUNCTION update_member_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'ride_participants' AND NEW.attended = true THEN
        UPDATE members
        SET total_rides = total_rides + 1,
            total_mileage = total_mileage + COALESCE(NEW.mileage_logged, 0)
        WHERE id = NEW.member_id;
    ELSIF TG_TABLE_NAME = 'meeting_attendees' AND NEW.attended = true THEN
        UPDATE members
        SET total_meetings = total_meetings + 1
        WHERE id = NEW.member_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ride_stats
    AFTER INSERT OR UPDATE OF attended ON ride_participants
    FOR EACH ROW EXECUTE FUNCTION update_member_stats();

CREATE TRIGGER update_meeting_stats
    AFTER INSERT OR UPDATE OF attended ON meeting_attendees
    FOR EACH ROW EXECUTE FUNCTION update_member_stats();
