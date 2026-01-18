import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Bike, Calendar, MapPin, Users, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { ridesApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['ride', id],
    queryFn: () => ridesApi.getById(id!),
    enabled: !!id,
  });

  const rsvpMutation = useMutation({
    mutationFn: ({ status, guests }: { status: string; guests?: number }) =>
      ridesApi.rsvp(id!, status, guests),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ride', id] });
      toast.success('RSVP updated!');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to update RSVP');
    },
  });

  const ride = data?.data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="card text-center py-12">
        <Bike className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
        <p className="text-hog-black-400">Ride not found</p>
      </div>
    );
  }

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
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={clsx('badge', getStatusColor(ride.status))}>
              {ride.status}
            </span>
            <span className="badge-orange">{ride.rideType.replace('_', ' ')}</span>
            {ride.rsvpRequired && <span className="badge-blue">RSVP Required</span>}
          </div>
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">{ride.title}</h1>
        {ride.description && (
          <p className="text-hog-black-300">{ride.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold mb-4">Ride Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm text-hog-black-400">Date</p>
                  <p className="font-medium">
                    {format(parseISO(ride.startDate), 'EEEE, MMMM d, yyyy')}
                    {ride.endDate && ride.endDate !== ride.startDate && (
                      <> - {format(parseISO(ride.endDate), 'MMM d')}</>
                    )}
                  </p>
                </div>
              </div>
              {ride.startTime && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-hog-black-400">Time</p>
                    <p className="font-medium">
                      {ride.startTime}
                      {ride.endTime && ` - ${ride.endTime}`}
                    </p>
                  </div>
                </div>
              )}
              {ride.meetupLocation && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-hog-black-400">Meetup</p>
                    <p className="font-medium">{ride.meetupLocation}</p>
                    {ride.meetupAddress && (
                      <p className="text-sm text-hog-black-400">{ride.meetupAddress}</p>
                    )}
                  </div>
                </div>
              )}
              {ride.destination && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-hog-black-400">Destination</p>
                    <p className="font-medium">{ride.destination}</p>
                  </div>
                </div>
              )}
              {ride.estimatedDistance && (
                <div className="flex items-start gap-3">
                  <Bike className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-hog-black-400">Distance</p>
                    <p className="font-medium">~{ride.estimatedDistance} miles</p>
                  </div>
                </div>
              )}
              {ride.estimatedDuration && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-hog-black-400">Duration</p>
                    <p className="font-medium">~{Math.round(ride.estimatedDuration / 60)} hours</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {ride.routeDescription && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold mb-4">Route</h2>
              <p className="text-hog-black-300 whitespace-pre-wrap">{ride.routeDescription}</p>
            </div>
          )}

          {/* Participants */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-hog-orange-500" />
              Participants ({ride.participants?.length || 0})
            </h2>
            {ride.participants?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ride.participants.map((p: {
                  id: string;
                  memberId: string;
                  firstName: string;
                  lastName: string;
                  nickname?: string;
                  rsvpStatus?: string;
                  attended?: boolean;
                  isRoadCaptain: boolean;
                }) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-hog-black-800/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-hog-orange-500 flex items-center justify-center text-white text-sm">
                      {p.firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.firstName} {p.lastName[0]}.
                      </p>
                      <div className="flex items-center gap-1">
                        {p.isRoadCaptain && (
                          <span className="badge-orange text-xs">RC</span>
                        )}
                        {p.attended && (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-hog-black-400 text-center py-4">No participants yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* RSVP Card */}
          {ride.rsvpRequired && ride.status === 'published' && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold mb-4">RSVP</h2>
              {ride.userParticipation ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="font-medium">
                    You're {ride.userParticipation.rsvpStatus === 'going' ? 'going!' : 'maybe'}
                  </p>
                  <button
                    className="btn-ghost mt-2"
                    onClick={() => rsvpMutation.mutate({ status: 'not_going' })}
                  >
                    Cancel RSVP
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    className="btn-primary w-full"
                    onClick={() => rsvpMutation.mutate({ status: 'going' })}
                    disabled={rsvpMutation.isPending}
                  >
                    I'm Going!
                  </button>
                  <button
                    className="btn-secondary w-full"
                    onClick={() => rsvpMutation.mutate({ status: 'maybe' })}
                    disabled={rsvpMutation.isPending}
                  >
                    Maybe
                  </button>
                </div>
              )}
              {ride.maxParticipants && (
                <p className="text-sm text-hog-black-400 text-center mt-3">
                  {ride.participants?.length || 0} / {ride.maxParticipants} spots filled
                </p>
              )}
            </div>
          )}

          {!ride.rsvpRequired && ride.status === 'published' && (
            <div className="card">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-hog-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No RSVP Required</p>
                  <p className="text-sm text-hog-black-400 mt-1">
                    Just show up at the meetup location and enjoy the ride!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Road Captains */}
          {(ride.leadRoadCaptain || ride.sweepRoadCaptain) && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold mb-4">Road Captains</h2>
              <div className="space-y-3">
                {ride.leadRoadCaptain && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-hog-orange-500 flex items-center justify-center text-white font-bold">
                      {ride.leadRoadCaptain.firstName[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {ride.leadRoadCaptain.firstName} {ride.leadRoadCaptain.lastName}
                      </p>
                      <p className="text-sm text-hog-black-400">Lead</p>
                    </div>
                  </div>
                )}
                {ride.sweepRoadCaptain && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-hog-black-700 flex items-center justify-center text-white font-bold">
                      {ride.sweepRoadCaptain.firstName[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {ride.sweepRoadCaptain.firstName} {ride.sweepRoadCaptain.lastName}
                      </p>
                      <p className="text-sm text-hog-black-400">Sweep</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
