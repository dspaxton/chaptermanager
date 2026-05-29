import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Users,
  Bike,
  Calendar,
  TrendingUp,
  ChevronRight,
  MapPin,
  Clock,
} from 'lucide-react';
import { ridesApi, meetingsApi, membersApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const isOfficer = ['admin', 'director', 'officer'].includes(user?.role || '');

  const { data: upcomingRides } = useQuery({
    queryKey: ['upcomingRides'],
    queryFn: () => ridesApi.getUpcoming(5),
  });

  const { data: upcomingMeetings } = useQuery({
    queryKey: ['upcomingMeetings'],
    queryFn: () => meetingsApi.getUpcoming(3),
  });

  const { data: stats } = useQuery({
    queryKey: ['memberStats'],
    queryFn: () => membersApi.getStats(),
    enabled: isOfficer,
  });

  const statsData = stats?.data?.data;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">
            Welcome back, {user?.member?.firstName || 'Rider'}!
          </h1>
          <p className="text-hog-black-400 mt-1">
            Here's what's happening in the chapter
          </p>
        </div>
      </div>

      {/* Stats cards (officers only) */}
      {isOfficer && statsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-hog-orange-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-hog-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsData.activeMembers}</p>
              <p className="text-sm text-hog-black-400">Active Members</p>
            </div>
          </div>

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsData.prospects}</p>
              <p className="text-sm text-hog-black-400">Prospects</p>
            </div>
          </div>

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsData.newMembersLast30Days}</p>
              <p className="text-sm text-hog-black-400">New This Month</p>
            </div>
          </div>

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Bike className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(statsData.totalChapterMileage / 1000).toFixed(0)}k</p>
              <p className="text-sm text-hog-black-400">Total Miles</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Rides */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <Bike className="w-5 h-5 text-hog-orange-500" />
              Upcoming Rides
            </h2>
            <Link
              to="/rides"
              className="text-sm text-hog-orange-500 hover:text-hog-orange-400 flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {(upcomingRides?.data?.data?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {upcomingRides?.data?.data?.map((ride: {
                id: string;
                title: string;
                startDate: string;
                startTime?: string;
                meetupLocation?: string;
                rideType: string;
                rsvpRequired: boolean;
              }) => (
                <Link
                  key={ride.id}
                  to={`/rides/${ride.id}`}
                  className="block p-3 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{ride.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-hog-black-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(ride.startDate), 'MMM d')}
                        </span>
                        {ride.startTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {ride.startTime}
                          </span>
                        )}
                        {ride.meetupLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {ride.meetupLocation}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="badge-orange">{ride.rideType.replace('_', ' ')}</span>
                      {ride.rsvpRequired && (
                        <span className="badge-blue text-xs">RSVP Required</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-hog-black-400 text-center py-8">
              No upcoming rides scheduled
            </p>
          )}
        </div>

        {/* Upcoming Meetings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-hog-orange-500" />
              Upcoming Meetings
            </h2>
            <Link
              to="/meetings"
              className="text-sm text-hog-orange-500 hover:text-hog-orange-400 flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {(upcomingMeetings?.data?.data?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {upcomingMeetings?.data?.data?.map((meeting: {
                id: string;
                title: string;
                meetingType: string;
                meetingDate: string;
                startTime: string;
                location?: string;
                isVirtual: boolean;
              }) => (
                <Link
                  key={meeting.id}
                  to={`/meetings/${meeting.id}`}
                  className="block p-3 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{meeting.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-hog-black-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(meeting.meetingDate), 'MMM d')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {meeting.startTime}
                        </span>
                        {meeting.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {meeting.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="badge-gray capitalize">{meeting.meetingType}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-hog-black-400 text-center py-8">
              No upcoming meetings scheduled
            </p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="text-lg font-display font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            to="/members"
            className="p-4 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors text-center"
          >
            <Users className="w-8 h-8 mx-auto mb-2 text-hog-orange-500" />
            <span className="text-sm">Member Directory</span>
          </Link>
          <Link
            to="/rides"
            className="p-4 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors text-center"
          >
            <Bike className="w-8 h-8 mx-auto mb-2 text-hog-orange-500" />
            <span className="text-sm">Browse Rides</span>
          </Link>
          <Link
            to="/minutes"
            className="p-4 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors text-center"
          >
            <Calendar className="w-8 h-8 mx-auto mb-2 text-hog-orange-500" />
            <span className="text-sm">Meeting Minutes</span>
          </Link>
          <Link
            to="/ai"
            className="p-4 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors text-center"
          >
            <span className="text-2xl block mb-1">🤖</span>
            <span className="text-sm">AI Assistant</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
