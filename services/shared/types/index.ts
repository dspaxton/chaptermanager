// =============================================================================
// Shared Types for HOG Chapter Manager
// =============================================================================

// User roles
export type UserRole = 'admin' | 'director' | 'officer' | 'head_road_captain' | 'road_captain' | 'secretary' | 'member' | 'prospect';

// Member status
export type MemberStatus = 'active' | 'inactive' | 'prospect' | 'suspended' | 'honorary';

// Ride types and statuses
export type RideStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled';
export type RideType = 'chapter_ride' | 'overnight' | 'multi_day' | 'dealer_event' | 'charity' | 'rally' | 'other';

// Meeting types and statuses
export type MeetingType = 'chapter' | 'officer' | 'committee' | 'special' | 'annual';
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// Action item status
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// RSVP status
export type RSVPStatus = 'going' | 'maybe' | 'not_going';

// =============================================================================
// Entity Interfaces
// =============================================================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  hogNumber?: string;
  nationalHogExpiry?: Date;
  chapterJoinDate?: Date;
  status: MemberStatus;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  photoUrl?: string;
  bio?: string;
  isPublicDirectory: boolean;
  totalMileage: number;
  totalRides: number;
  totalMeetings: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberBike {
  id: string;
  memberId: string;
  year?: number;
  make: string;
  model?: string;
  nickname?: string;
  color?: string;
  isPrimary: boolean;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ride {
  id: string;
  title: string;
  description?: string;
  rideType: RideType;
  status: RideStatus;
  startDate: Date;
  startTime?: string;
  endDate?: Date;
  endTime?: string;
  meetupLocation?: string;
  meetupAddress?: string;
  meetupLat?: number;
  meetupLng?: number;
  destination?: string;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  difficultyLevel: number;
  routeDescription?: string;
  routeMapUrl?: string;
  rsvpRequired: boolean;
  rsvpDeadline?: Date;
  maxParticipants?: number;
  actualDistance?: number;
  actualDuration?: number;
  weatherConditions?: string;
  rideReport?: string;
  leadRoadCaptainId?: string;
  sweepRoadCaptainId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RideParticipant {
  id: string;
  rideId: string;
  memberId: string;
  rsvpStatus?: RSVPStatus;
  rsvpDate?: Date;
  guests: number;
  attended?: boolean;
  mileageLogged?: number;
  isRoadCaptain: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Meeting {
  id: string;
  title: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  meetingDate: Date;
  startTime: string;
  endTime?: string;
  location?: string;
  address?: string;
  isVirtual: boolean;
  virtualLink?: string;
  agenda?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Minutes {
  id: string;
  meetingId: string;
  content: string;
  summary?: string;
  aiSummary?: string;
  recordedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
  version: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  minutesId?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  assignedBy?: string;
  status: ActionItemStatus;
  dueDate?: Date;
  completedAt?: Date;
  priority: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// Auth Types
// =============================================================================

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  memberId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// =============================================================================
// AI Types
// =============================================================================

export interface AISummaryRequest {
  content: string;
  type: 'minutes' | 'ride_report' | 'document';
}

export interface AISummaryResponse {
  summary: string;
  actionItems?: ExtractedActionItem[];
  keyDecisions?: string[];
}

export interface ExtractedActionItem {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
}

export interface RideSuggestionRequest {
  startLocation: string;
  preferredDistance?: number;
  difficulty?: number;
  date?: string;
  groupSize?: number;
}

export interface RideSuggestion {
  title: string;
  description: string;
  estimatedDistance: number;
  estimatedDuration: number;
  difficulty: number;
  waypoints: string[];
  weatherForecast?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: string;
  conversationId: string;
}
