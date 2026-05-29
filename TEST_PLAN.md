# HOG Chapter Manager - Test Plan

## Test Environment
- **URL**: http://localhost
- **Admin Credentials**: admin@chapter.local / Password123

---

## 1. Authentication Module

### 1.1 Login
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-AUTH-001: Valid login | Enter admin@chapter.local / Password123, click Sign In | Redirect to dashboard, welcome toast appears |
| TC-AUTH-002: Invalid password | Enter admin@chapter.local / wrongpassword | Error toast "Invalid credentials" |
| TC-AUTH-003: Invalid email | Enter nonexistent@email.com / Password123 | Error toast "Invalid credentials" |
| TC-AUTH-004: Empty fields | Click Sign In with empty fields | Validation errors shown |

### 1.2 Registration
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-AUTH-005: Valid registration | Navigate to /register, fill all fields, submit | Account created, redirected to dashboard |
| TC-AUTH-006: Duplicate email | Register with admin@chapter.local | Error "Email already registered" |
| TC-AUTH-007: Weak password | Register with password < 8 chars | Validation error |

### 1.3 Logout
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-AUTH-008: Logout | Click user menu > Logout | Redirected to login, token cleared |
| TC-AUTH-009: Protected route after logout | Try to access / after logout | Redirected to login |

---

## 2. Dashboard Module

### 2.1 Dashboard Display
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-DASH-001: Stats cards (admin) | Login as admin, view dashboard | Stats cards show: Active Members, Prospects, New This Month, Total Miles |
| TC-DASH-002: Upcoming rides | View dashboard | Upcoming rides section displays (or "No upcoming rides") |
| TC-DASH-003: Upcoming meetings | View dashboard | Upcoming meetings section displays |
| TC-DASH-004: Quick actions | View dashboard | Quick action buttons present and clickable |

---

## 3. Members Module

### 3.1 Member Directory
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MEM-001: View member list | Navigate to Members | Member directory loads with at least admin user |
| TC-MEM-002: Search members | Type in search box | Results filter by name/email |
| TC-MEM-003: Filter by status | Select status filter | Only members with selected status shown |

### 3.2 Member Profile
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MEM-004: View profile | Click on a member | Profile page loads with details |
| TC-MEM-005: Edit profile | Edit profile fields, save | Changes saved, success toast |
| TC-MEM-006: Update status (admin) | Change member status | Status updated successfully |

### 3.3 Bikes
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MEM-007: Add bike | On profile, add new bike | Bike added to member's list |
| TC-MEM-008: Edit bike | Edit existing bike | Changes saved |
| TC-MEM-009: Delete bike | Delete a bike | Bike removed from list |

### 3.4 Mileage
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MEM-010: Log mileage | Add mileage entry | Mileage recorded, totals updated |

---

## 4. Rides Module

### 4.1 Ride List
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-RIDE-001: View rides | Navigate to Rides | Ride list loads |
| TC-RIDE-002: Filter by type | Select ride type filter | Only matching rides shown |
| TC-RIDE-003: Filter by date | Select date range | Only rides in range shown |

### 4.2 Create Ride (Officer+)
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-RIDE-004: Create basic ride | Fill required fields, save | Ride created, appears in list |
| TC-RIDE-005: Create ride with RSVP | Enable RSVP required, save | Ride shows RSVP badge |
| TC-RIDE-006: Create overnight ride | Set ride type to "overnight" | Ride created as overnight |

### 4.3 Ride Detail
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-RIDE-007: View ride detail | Click on a ride | Detail page shows all info |
| TC-RIDE-008: RSVP to ride | Click RSVP button (if enabled) | RSVP recorded |
| TC-RIDE-009: Cancel RSVP | Cancel existing RSVP | RSVP removed |

### 4.4 Ride Management (Officer+)
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-RIDE-010: Edit ride | Edit ride details | Changes saved |
| TC-RIDE-011: Cancel ride | Change status to cancelled | Ride marked cancelled |
| TC-RIDE-012: Record attendance | Mark attendees after ride | Attendance recorded |
| TC-RIDE-013: Add ride report | Submit post-ride report | Report saved |

---

## 5. Meetings Module

### 5.1 Meeting List
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MTG-001: View meetings | Navigate to Meetings | Meeting list loads |
| TC-MTG-002: Filter by type | Filter chapter/officer meetings | Only matching shown |

### 5.2 Create Meeting (Officer+)
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MTG-003: Create chapter meeting | Fill form, select "chapter" type | Meeting created |
| TC-MTG-004: Create officer meeting | Fill form, select "officer" type | Meeting created (restricted access) |
| TC-MTG-005: Create virtual meeting | Enable virtual, add meeting link | Meeting shows virtual badge |

### 5.3 Meeting Detail
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MTG-006: View meeting | Click on meeting | Detail page loads |
| TC-MTG-007: Officer meeting access | Regular member views officer meeting | Access denied or meeting hidden |

### 5.4 Meeting Management (Officer+)
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MTG-008: Record attendance | Mark attendees | Attendance saved |
| TC-MTG-009: Add motion | Create motion with votes | Motion recorded |
| TC-MTG-010: Add action item | Create action item | Item added to list |
| TC-MTG-011: Update action item | Mark item complete | Status updated |

---

## 6. Minutes Module

### 6.1 Minutes List
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MIN-001: View all minutes | Navigate to Minutes | Published minutes list loads |
| TC-MIN-002: Officer meeting minutes | Login as admin, view minutes | Can see officer meeting minutes |
| TC-MIN-003: Regular member minutes | Login as member | Only chapter minutes visible |

### 6.2 Create/Edit Minutes (Officer+)
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MIN-004: Create minutes | Go to meeting, add minutes content | Minutes saved as draft |
| TC-MIN-005: Edit minutes | Update existing minutes | New version created |
| TC-MIN-006: View history | View minutes version history | All versions listed |

### 6.3 AI Summarization
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MIN-007: Generate AI summary | Click "Generate AI Summary" | Summary generated, action items extracted |

### 6.4 Approval (Director+)
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-MIN-008: Approve minutes | Click Approve button | Minutes marked published |
| TC-MIN-009: Published visibility | View published minutes as member | Minutes visible to appropriate users |

---

## 7. AI Assistant Module

### 7.1 Chat Interface
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-AI-001: Open AI Assistant | Navigate to AI page | Chat interface loads |
| TC-AI-002: Send message | Type and send a question | AI responds appropriately |
| TC-AI-003: Chapter context | Ask about chapter data | AI uses chapter context in response |

### 7.2 AI Features
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-AI-004: Ride suggestions | Request ride suggestions | AI provides route ideas |
| TC-AI-005: Safety briefing | Generate safety briefing for ride | Briefing document generated |
| TC-AI-006: Engagement analysis | Request member engagement analysis | Analysis with insights returned |

---

## 8. Settings Module

### 8.1 Profile Settings
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-SET-001: View settings | Navigate to Settings | Settings page loads |
| TC-SET-002: Update profile | Change profile info, save | Changes saved |

### 8.2 Password Change
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-SET-003: Change password | Enter current + new password | Password updated |
| TC-SET-004: Wrong current password | Enter wrong current password | Error message shown |

---

## 9. Authorization & Permissions

### 9.1 Role-Based Access
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-PERM-001: Admin access | Login as admin | Full access to all features |
| TC-PERM-002: Officer access | Login as officer | Can manage rides/meetings, no admin features |
| TC-PERM-003: Member access | Login as regular member | View-only for most features |
| TC-PERM-004: Prospect access | Login as prospect | Limited access |

### 9.2 Data Visibility
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-PERM-005: Officer meetings hidden | Regular member views meetings | Officer meetings not shown |
| TC-PERM-006: Stats visibility | Regular member views dashboard | No stats cards shown |

---

## 10. API Integration Tests (curl)

```bash
# Set base URL and get token
BASE_URL="http://localhost"
TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chapter.local","password":"Password123"}' | jq -r '.data.accessToken')

# Test auth endpoints
curl -s $BASE_URL/api/auth/me -H "Authorization: Bearer $TOKEN"

# Test member endpoints
curl -s $BASE_URL/api/members -H "Authorization: Bearer $TOKEN"
curl -s $BASE_URL/api/members/stats/overview -H "Authorization: Bearer $TOKEN"

# Test ride endpoints
curl -s $BASE_URL/api/rides -H "Authorization: Bearer $TOKEN"
curl -s $BASE_URL/api/rides/upcoming -H "Authorization: Bearer $TOKEN"

# Test meeting endpoints
curl -s $BASE_URL/api/meetings -H "Authorization: Bearer $TOKEN"
curl -s $BASE_URL/api/meetings/upcoming -H "Authorization: Bearer $TOKEN"

# Test minutes endpoint
curl -s $BASE_URL/api/meetings/all/minutes -H "Authorization: Bearer $TOKEN"

# Test AI endpoints (requires valid Anthropic API key)
curl -s -X POST $BASE_URL/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, what can you help me with?"}'
```

---

## 11. Error Handling

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-ERR-001: 404 page | Navigate to /nonexistent | Redirects to home or shows 404 |
| TC-ERR-002: API error display | Trigger API error | User-friendly error toast |
| TC-ERR-003: Network error | Disconnect network, try action | Appropriate error message |
| TC-ERR-004: Session expiry | Wait for token to expire | Automatic refresh or redirect to login |

---

## 12. Data Validation

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| TC-VAL-001: Required fields | Submit form with missing required fields | Validation errors shown |
| TC-VAL-002: Email format | Enter invalid email format | Format error shown |
| TC-VAL-003: Date validation | Enter invalid date | Date error shown |
| TC-VAL-004: Number validation | Enter negative mileage | Validation error |

---

## Test Data Setup

### Create Test Users (via API or DB)
```sql
-- Create a regular member for testing
INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
VALUES (
    'test-member-001',
    'member@chapter.local',
    '$2a$12$R6gp7mWo351ZsPoWW9qL7uLCGPN0dzkeZU3v4H15CAaYzVlh4RSie', -- Password123
    'member',
    true,
    true
);

INSERT INTO members (id, user_id, first_name, last_name, status, chapter_join_date)
VALUES ('test-member-profile-001', 'test-member-001', 'Test', 'Member', 'active', CURRENT_DATE);

-- Create an officer for testing
INSERT INTO users (id, email, password_hash, role, is_active, is_verified)
VALUES (
    'test-officer-001',
    'officer@chapter.local',
    '$2a$12$R6gp7mWo351ZsPoWW9qL7uLCGPN0dzkeZU3v4H15CAaYzVlh4RSie', -- Password123
    'officer',
    true,
    true
);

INSERT INTO members (id, user_id, first_name, last_name, status, chapter_join_date)
VALUES ('test-officer-profile-001', 'test-officer-001', 'Test', 'Officer', 'active', CURRENT_DATE);
```

---

## Test Execution Checklist

- [ ] **Phase 1: Smoke Test** - Verify app loads, login works
- [ ] **Phase 2: Authentication** - All auth flows (TC-AUTH-*)
- [ ] **Phase 3: Core Features** - Members, Rides, Meetings (TC-MEM-*, TC-RIDE-*, TC-MTG-*)
- [ ] **Phase 4: Minutes & AI** - Minutes workflow, AI features (TC-MIN-*, TC-AI-*)
- [ ] **Phase 5: Permissions** - Role-based access (TC-PERM-*)
- [ ] **Phase 6: Edge Cases** - Error handling, validation (TC-ERR-*, TC-VAL-*)
- [ ] **Phase 7: API Tests** - Run curl test suite

---

## Known Limitations

1. OAuth (Google/Facebook) requires valid API credentials in .env
2. AI features require valid Anthropic API key
3. Weather features require OpenWeather API key
4. File uploads require MinIO to be properly configured
