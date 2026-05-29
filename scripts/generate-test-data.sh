#!/bin/bash
# =============================================================================
# HOG Chapter Manager - Test Data Generator
# Generates 100 members, 50 rides, and 10 meetings
# =============================================================================

set -e

# Configuration
CONTAINER_NAME="hog-postgres"
DB_NAME="chaptermanager"
DB_USER="chaptermanager"

# Parse arguments
FORCE=false
ADD_PARTICIPANTS=false

for arg in "$@"; do
    case $arg in
        -f|--force)
            FORCE=true
            ;;
        -p|--with-participants)
            ADD_PARTICIPANTS=true
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -f, --force              Skip confirmation prompt"
            echo "  -p, --with-participants  Add random participants to rides"
            echo "  -h, --help               Show this help message"
            exit 0
            ;;
    esac
done

echo "=== HOG Chapter Manager Test Data Generator ==="
echo ""
echo "This will generate:"
echo "  - 100 random members"
echo "  - 50 rides throughout 2026"
echo "  - 10 chapter meetings starting February 2026"
if [ "$ADD_PARTICIPANTS" = true ]; then
    echo "  - Random participants will be added to rides"
fi
echo ""

# Check if we should proceed
if [ "$FORCE" != true ]; then
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo "Generating test data..."

# Run the SQL commands inside the postgres container
# Pass ADD_PARTICIPANTS as a psql variable
finch exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME \
    -v add_participants="$ADD_PARTICIPANTS" << 'EOSQL'
-- =============================================================================
-- TEST DATA GENERATION
-- =============================================================================

-- Store the add_participants setting in a temp table for access in PL/pgSQL
CREATE TEMP TABLE _settings (add_participants BOOLEAN);
INSERT INTO _settings VALUES (:add_participants = 'true');

-- Password hash for "Password123" (bcrypt cost 12)
-- All test users will have this password
DO $$
DECLARE
    password_hash TEXT := '$2a$12$R6gp7mWo351ZsPoWW9qL7uLCGPN0dzkeZU3v4H15CAaYzVlh4RSie';

    -- Arrays for random data
    first_names TEXT[] := ARRAY[
        'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
        'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
        'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan',
        'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
        'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Raymond', 'Jack', 'Dennis',
        'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
        'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
        'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
        'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
        'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather'
    ];

    last_names TEXT[] := ARRAY[
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
        'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
        'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
        'Turner', 'Phillips', 'Evans', 'Parker', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Cook',
        'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell', 'Gomez', 'Kelly', 'Howard',
        'Ward', 'Cox', 'Diaz', 'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett', 'Gray', 'James',
        'Reyes', 'Cruz', 'Hughes', 'Price', 'Myers', 'Long', 'Foster', 'Sanders', 'Ross', 'Morales',
        'Powell', 'Sullivan', 'Russell', 'Ortiz', 'Jenkins', 'Gutierrez', 'Perry', 'Butler', 'Barnes', 'Fisher'
    ];

    nicknames TEXT[] := ARRAY[
        'Ace', 'Bear', 'Blaze', 'Bolt', 'Bones', 'Boots', 'Bronco', 'Bull', 'Bullet', 'Butch',
        'Buzz', 'Chief', 'Chopper', 'Chrome', 'Colt', 'Cowboy', 'Crash', 'Cruiser', 'Diesel', 'Doc',
        'Duke', 'Eagle', 'Flash', 'Gator', 'Ghost', 'Gizmo', 'Grizzly', 'Hammer', 'Hawk', 'Hoss',
        'Hunter', 'Iron', 'Jazz', 'Joker', 'King', 'Knight', 'Legend', 'Lightning', 'Lucky', 'Maverick',
        'Moose', 'Mustang', 'Nitro', 'Nomad', 'Outlaw', 'Panther', 'Phoenix', 'Pipes', 'Preacher', 'Prowler',
        'Radar', 'Rambler', 'Ranger', 'Rascal', 'Raven', 'Rebel', 'Red', 'Rex', 'Rider', 'Roadie',
        'Rocker', 'Rocky', 'Rogue', 'Rusty', 'Savage', 'Scout', 'Shadow', 'Shark', 'Shooter', 'Sidewinder',
        'Skull', 'Slider', 'Slim', 'Smoke', 'Snake', 'Sparky', 'Speedy', 'Spider', 'Spike', 'Spinner',
        'Steel', 'Storm', 'Striker', 'Tank', 'Thunder', 'Tiger', 'Titan', 'Torch', 'Tracker', 'Viper',
        'Vulture', 'Warrior', 'Wheels', 'Whiskey', 'Wild', 'Wolf', 'Wraith', 'Wrangler', 'Zeus', 'Zigzag'
    ];

    cities TEXT[] := ARRAY[
        'Austin', 'Houston', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi',
        'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'McKinney',
        'Frisco', 'Brownsville', 'Pasadena', 'Mesquite', 'Killeen', 'McAllen', 'Carrollton', 'Midland',
        'Waco', 'Denton', 'Abilene', 'Odessa', 'Beaumont', 'Round Rock'
    ];

    bike_models TEXT[] := ARRAY[
        'Street Glide', 'Road Glide', 'Road King', 'Ultra Limited', 'Electra Glide', 'Fat Boy',
        'Softail Standard', 'Heritage Classic', 'Low Rider', 'Fat Bob', 'Breakout', 'Sport Glide',
        'Street Bob', 'Sportster S', 'Nightster', 'Iron 883', 'Forty-Eight', 'Road Glide Special',
        'Street Glide Special', 'CVO Street Glide', 'CVO Road Glide', 'Pan America', 'LiveWire'
    ];

    bike_colors TEXT[] := ARRAY[
        'Vivid Black', 'Billiard Red', 'River Rock Gray', 'Midnight Crimson', 'Deadwood Green',
        'Stone Washed White Pearl', 'Gunship Gray', 'Redline Red', 'Black Denim', 'Industrial Gray',
        'Zephyr Blue', 'Snake Venom', 'Whiskey Fire', 'White Sand Pearl', 'Spruce', 'Atlas Silver'
    ];

    ride_titles TEXT[] := ARRAY[
        'Hill Country Cruise', 'Bluebonnet Run', 'Lake Loop Ride', 'Canyon Carve', 'Coastal Highway Run',
        'Desert Dawn Ride', 'Mountain Pass Adventure', 'River Road Rally', 'Sunset Strip Cruise', 'Thunder Road Run',
        'Veterans Memorial Ride', 'Charity Poker Run', 'Breakfast Burrito Run', 'BBQ Trail Ride', 'Ice Cream Social Ride',
        'Full Moon Ride', 'New Member Welcome Ride', 'Ladies of Harley Ride', 'Officers Ride', 'Road Captain Training',
        'Safety Skills Ride', 'Photo Op Ride', 'Historic Route Ride', 'Dealer Open House Ride', 'Rally Pre-Ride',
        'State Park Tour', 'Winery Tour Ride', 'Small Town Texas Ride', 'Backroads Explorer', 'Highway Miles Run'
    ];

    destinations TEXT[] := ARRAY[
        'Luckenbach', 'Fredericksburg', 'Gruene', 'Bandera', 'Wimberley', 'New Braunfels', 'Dripping Springs',
        'Marble Falls', 'Johnson City', 'Blanco', 'Comfort', 'Boerne', 'Kerrville', 'Leakey', 'Medina',
        'Vanderpool', 'Utopia', 'Concan', 'Garner State Park', 'Lost Maples', 'Enchanted Rock', 'Pedernales Falls',
        'Hamilton Pool', 'McKinney Falls', 'Krause Springs', 'Jacob''s Well', 'Blue Hole', 'Barton Springs',
        'Lake Travis', 'Canyon Lake'
    ];

    meetup_locations TEXT[] := ARRAY[
        'Harley-Davidson Dealership', 'Chapter Clubhouse', 'Buc-ee''s Parking Lot', 'HEB Plus Parking',
        'Walmart Supercenter', 'Town Square', 'City Park', 'Community Center', 'VFW Post', 'American Legion'
    ];

    -- Variables for generation
    i INTEGER;
    user_id UUID;
    member_id UUID;
    ride_id UUID;
    meeting_id UUID;
    fname TEXT;
    lname TEXT;
    member_email TEXT;
    member_status member_status;
    random_date DATE;
    random_time TIME;
    ride_status ride_status;

BEGIN
    -- =========================================================================
    -- GENERATE 100 MEMBERS
    -- =========================================================================
    RAISE NOTICE 'Generating 100 members...';

    FOR i IN 1..100 LOOP
        -- Generate random names
        fname := first_names[1 + floor(random() * array_length(first_names, 1))::int];
        lname := last_names[1 + floor(random() * array_length(last_names, 1))::int];
        member_email := lower(fname) || '.' || lower(lname) || i || '@example.com';

        -- Random status (mostly active)
        member_status := CASE
            WHEN random() < 0.75 THEN 'active'::member_status
            WHEN random() < 0.85 THEN 'prospect'::member_status
            WHEN random() < 0.95 THEN 'inactive'::member_status
            ELSE 'honorary'::member_status
        END;

        -- Create user
        user_id := uuid_generate_v4();
        INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
        VALUES (
            user_id,
            member_email,
            password_hash,
            CASE
                WHEN i <= 2 THEN 'director'::user_role
                WHEN i <= 5 THEN 'officer'::user_role
                WHEN i <= 7 THEN 'road_captain'::user_role
                WHEN i = 8 THEN 'head_road_captain'::user_role
                WHEN i = 9 THEN 'secretary'::user_role
                ELSE 'member'::user_role
            END,
            true,
            true
        );

        -- Create member
        member_id := uuid_generate_v4();
        INSERT INTO members (
            id, user_id, first_name, last_name, nickname, phone,
            city, state, status, chapter_join_date,
            total_mileage, total_rides, total_meetings, is_public_directory
        )
        VALUES (
            member_id,
            user_id,
            fname,
            lname,
            CASE WHEN random() < 0.6 THEN nicknames[1 + floor(random() * array_length(nicknames, 1))::int] ELSE NULL END,
            '555-' || lpad((100 + i)::text, 3, '0') || '-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0'),
            cities[1 + floor(random() * array_length(cities, 1))::int],
            'TX',
            member_status,
            DATE '2020-01-01' + (random() * 1800)::int,
            (random() * 50000)::int,
            (random() * 200)::int,
            (random() * 50)::int,
            random() < 0.9
        );

        -- Add position for officers
        IF i <= 9 THEN
            INSERT INTO member_positions (member_id, position_title, start_date, is_current)
            VALUES (
                member_id,
                CASE i
                    WHEN 1 THEN 'Director'
                    WHEN 2 THEN 'Assistant Director'
                    WHEN 3 THEN 'Treasurer'
                    WHEN 4 THEN 'Safety Officer'
                    WHEN 5 THEN 'Activities Officer'
                    WHEN 6 THEN 'Road Captain'
                    WHEN 7 THEN 'Road Captain'
                    WHEN 8 THEN 'Head Road Captain'
                    WHEN 9 THEN 'Secretary'
                END,
                DATE '2025-01-01',
                true
            );
        END IF;

        -- Add a bike (80% chance)
        IF random() < 0.8 THEN
            INSERT INTO member_bikes (member_id, year, make, model, color, is_primary)
            VALUES (
                member_id,
                2015 + floor(random() * 11)::int,
                'Harley-Davidson',
                bike_models[1 + floor(random() * array_length(bike_models, 1))::int],
                bike_colors[1 + floor(random() * array_length(bike_colors, 1))::int],
                true
            );

            -- 20% chance of second bike
            IF random() < 0.2 THEN
                INSERT INTO member_bikes (member_id, year, make, model, color, is_primary)
                VALUES (
                    member_id,
                    2010 + floor(random() * 16)::int,
                    'Harley-Davidson',
                    bike_models[1 + floor(random() * array_length(bike_models, 1))::int],
                    bike_colors[1 + floor(random() * array_length(bike_colors, 1))::int],
                    false
                );
            END IF;
        END IF;
    END LOOP;

    -- =========================================================================
    -- GENERATE 50 RIDES FOR 2026
    -- =========================================================================
    RAISE NOTICE 'Generating 50 rides for 2026...';

    FOR i IN 1..50 LOOP
        ride_id := uuid_generate_v4();

        -- Distribute rides throughout 2026
        random_date := DATE '2026-01-01' + (i * 7 + floor(random() * 5)::int);
        random_time := TIME '08:00:00' + (floor(random() * 4) || ' hours')::interval;

        -- Determine status based on date (relative to "now" being mid-Jan 2026)
        ride_status := CASE
            WHEN random_date < DATE '2026-01-18' THEN 'completed'::ride_status
            WHEN random_date < DATE '2026-02-01' THEN
                CASE WHEN random() < 0.7 THEN 'published'::ride_status ELSE 'draft'::ride_status END
            ELSE
                CASE WHEN random() < 0.5 THEN 'published'::ride_status ELSE 'draft'::ride_status END
        END;

        INSERT INTO rides (
            id, title, description, ride_type, status,
            start_date, start_time, end_date, end_time,
            meetup_location, destination,
            estimated_distance, estimated_duration, difficulty_level,
            rsvp_required, max_participants,
            created_by
        )
        VALUES (
            ride_id,
            ride_titles[1 + floor(random() * array_length(ride_titles, 1))::int] ||
                CASE WHEN random() < 0.3 THEN ' #' || (1 + floor(random() * 10))::int ELSE '' END,
            'Join us for an exciting ride through the Texas countryside. ' ||
            'We''ll enjoy scenic roads, good company, and great stops along the way. ' ||
            'All skill levels welcome!',
            CASE floor(random() * 7)::int
                WHEN 0 THEN 'chapter_ride'::ride_type
                WHEN 1 THEN 'chapter_ride'::ride_type
                WHEN 2 THEN 'chapter_ride'::ride_type
                WHEN 3 THEN 'overnight'::ride_type
                WHEN 4 THEN 'dealer_event'::ride_type
                WHEN 5 THEN 'charity'::ride_type
                ELSE 'other'::ride_type
            END,
            ride_status,
            random_date,
            random_time,
            random_date + CASE WHEN random() < 0.1 THEN 1 ELSE 0 END,
            random_time + '4 hours'::interval,
            meetup_locations[1 + floor(random() * array_length(meetup_locations, 1))::int],
            destinations[1 + floor(random() * array_length(destinations, 1))::int],
            50 + floor(random() * 200)::int,
            120 + floor(random() * 240)::int,
            1 + floor(random() * 5)::int,
            random() < 0.3,
            CASE WHEN random() < 0.2 THEN 20 + floor(random() * 30)::int ELSE NULL END,
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'  -- Admin user
        );

        -- Add some RSVPs/participants for published/completed rides (only if enabled)
        IF ride_status IN ('published', 'completed') AND (SELECT add_participants FROM _settings) THEN
            INSERT INTO ride_participants (ride_id, member_id, rsvp_status, rsvp_date, attended, mileage_logged)
            SELECT
                ride_id,
                m.id,
                'going'::rsvp_status,
                random_date - (floor(random() * 14)::int || ' days')::interval,
                CASE WHEN ride_status = 'completed' THEN random() < 0.8 ELSE NULL END,
                CASE WHEN ride_status = 'completed' AND random() < 0.8 THEN 50 + floor(random() * 200)::int ELSE NULL END
            FROM members m
            WHERE random() < 0.3  -- 30% of members RSVP
            LIMIT 5 + floor(random() * 20)::int;
        END IF;
    END LOOP;

    -- =========================================================================
    -- GENERATE 10 CHAPTER MEETINGS (Feb 2026 onwards)
    -- =========================================================================
    RAISE NOTICE 'Generating 10 chapter meetings starting February 2026...';

    FOR i IN 0..9 LOOP
        meeting_id := uuid_generate_v4();

        -- Monthly meetings on first Thursday of each month
        random_date := DATE '2026-02-01' + (i || ' months')::interval;
        -- Adjust to first Thursday
        random_date := random_date + ((4 - extract(dow from random_date)::int + 7) % 7 || ' days')::interval;

        INSERT INTO meetings (
            id, title, meeting_type, status,
            meeting_date, start_time, end_time,
            location, address,
            agenda,
            created_by
        )
        VALUES (
            meeting_id,
            CASE
                WHEN i = 0 THEN 'February Chapter Meeting'
                WHEN i = 1 THEN 'March Chapter Meeting'
                WHEN i = 2 THEN 'April Chapter Meeting'
                WHEN i = 3 THEN 'May Chapter Meeting'
                WHEN i = 4 THEN 'June Chapter Meeting'
                WHEN i = 5 THEN 'July Chapter Meeting'
                WHEN i = 6 THEN 'August Chapter Meeting'
                WHEN i = 7 THEN 'September Chapter Meeting'
                WHEN i = 8 THEN 'October Chapter Meeting'
                ELSE 'November Chapter Meeting'
            END,
            'chapter'::meeting_type,
            'scheduled'::meeting_status,
            random_date,
            TIME '19:00:00',
            TIME '21:00:00',
            'Chapter Clubhouse',
            '123 Harley Way, Austin, TX 78701',
            E'1. Call to Order\n2. Pledge of Allegiance\n3. Roll Call\n4. Reading of Previous Minutes\n5. Treasurer''s Report\n6. Officer Reports\n7. Old Business\n8. New Business\n9. Upcoming Rides\n10. Good of the Order\n11. Adjourn',
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'  -- Admin user
        );
    END LOOP;

    RAISE NOTICE 'Test data generation complete!';
END $$;

-- Cleanup
DROP TABLE _settings;

-- Output summary
SELECT 'Generation complete!' as status;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_members FROM members;
SELECT COUNT(*) as total_bikes FROM member_bikes;
SELECT COUNT(*) as total_rides FROM rides;
SELECT COUNT(*) as total_meetings FROM meetings;
SELECT COUNT(*) as total_rsvps FROM ride_participants;
EOSQL

echo ""
echo "=== Generation Complete ==="
echo ""
echo "Test accounts created with password: Password123"
echo ""
echo "Officer accounts:"
echo "  - Director: james.smith1@example.com (or similar)"
echo "  - Check database for exact emails"
echo ""
