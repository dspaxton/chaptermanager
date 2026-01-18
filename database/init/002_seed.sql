-- =============================================================================
-- HOG Chapter Manager - Seed Data
-- =============================================================================

-- Create default admin user (password: ChangeMe123!)
-- Password hash is bcrypt with cost 12
INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@chapter.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G/HjYzL/xJCiPK',
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
