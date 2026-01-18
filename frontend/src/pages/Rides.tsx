import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Bike, Calendar, MapPin, Users, Plus, Filter } from 'lucide-react';
import { ridesApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { clsx } from 'clsx';

export default function Rides() {
  const { user } = useAuthStore();
  const canCreate = ['admin', 'director', 'officer', 'road_captain'].includes(user?.role || '');
  const [statusFilter, setStatusFilter] = useState('published');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['rides', statusFilter, typeFilter, page],
    queryFn: () => ridesApi.getAll({
      status: statusFilter || undefined,
      rideType: typeFilter || undefined,
      page,
      limit: 12,
    }),
  });

  const rides = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'badge-green';
      case 'draft': return 'badge-gray';
      case 'completed': return 'badge-blue';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'badge-gray';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Rides</h1>
          <p className="text-hog-black-400 mt-1">Upcoming and past chapter rides</p>
        </div>
        {canCreate && (
          <Link to="/rides/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Ride
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-hog-black-400" />
            <select
              className="input w-auto"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <select
            className="input w-auto"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="chapter_ride">Chapter Ride</option>
            <option value="overnight">Overnight</option>
            <option value="multi_day">Multi-Day</option>
            <option value="dealer_event">Dealer Event</option>
            <option value="charity">Charity</option>
            <option value="rally">Rally</option>
          </select>
        </div>
      </div>

      {/* Ride list */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : rides.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rides.map((ride: {
              id: string;
              title: string;
              description?: string;
              rideType: string;
              status: string;
              startDate: string;
              startTime?: string;
              meetupLocation?: string;
              destination?: string;
              estimatedDistance?: number;
              difficultyLevel: number;
              rsvpRequired: boolean;
              participantCount: number;
            }) => (
              <Link
                key={ride.id}
                to={`/rides/${ride.id}`}
                className="card hover:border-hog-orange-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={clsx('badge', getStatusColor(ride.status))}>
                    {ride.status}
                  </span>
                  <span className="badge-orange text-xs">
                    {ride.rideType.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{ride.title}</h3>
                <div className="space-y-2 text-sm text-hog-black-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(parseISO(ride.startDate), 'EEEE, MMM d')}
                      {ride.startTime && ` at ${ride.startTime}`}
                    </span>
                  </div>
                  {ride.meetupLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{ride.meetupLocation}</span>
                    </div>
                  )}
                  {ride.estimatedDistance && (
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4" />
                      <span>~{ride.estimatedDistance} miles</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{ride.participantCount} participants</span>
                  </div>
                </div>
                {ride.rsvpRequired && (
                  <div className="mt-3 pt-3 border-t border-hog-black-800">
                    <span className="badge-blue text-xs">RSVP Required</span>
                  </div>
                )}
              </Link>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="text-sm text-hog-black-400">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-12">
          <Bike className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
          <p className="text-hog-black-400">No rides found</p>
        </div>
      )}
    </div>
  );
}
