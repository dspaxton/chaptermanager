import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Bike, Calendar, MapPin, Users, Clock, AlertCircle, CheckCircle, Edit, Send, XCircle, Flag, CalendarClock, Copy, ClipboardCheck, X, Search } from 'lucide-react';
import { ridesApi, membersApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [mileage, setMileage] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState('');

  const isOfficer = user && ['admin', 'director', 'officer', 'head_road_captain', 'road_captain'].includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ['ride', id],
    queryFn: () => ridesApi.getById(id!),
    enabled: !!id,
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', 'all'],
    queryFn: () => membersApi.getAll({ limit: 500, status: 'active' }),
    enabled: showAttendanceModal,
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

  const statusMutation = useMutation({
    mutationFn: (status: string) => ridesApi.updateStatus(id!, status),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['ride', id] });
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      const messages: Record<string, string> = {
        published: 'Ride published! Members can now see it.',
        cancelled: 'Ride cancelled.',
        completed: 'Ride marked as completed.',
        draft: 'Ride moved back to draft.',
        postponed: 'Ride marked as postponed.',
      };
      toast.success(messages[status] || 'Status updated!');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to update status');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => ridesApi.duplicate(id!),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Ride duplicated! Opening copy for editing...');
      navigate(`/rides/${response.data.data.id}/edit`);
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to duplicate ride');
    },
  });

  const attendanceMutation = useMutation({
    mutationFn: ({ memberIds, mileage }: { memberIds: string[]; mileage?: number }) =>
      ridesApi.recordAttendance(id!, memberIds, mileage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ride', id] });
      toast.success('Attendance recorded successfully!');
      setShowAttendanceModal(false);
      setSelectedMembers([]);
      setMileage('');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to record attendance');
    },
  });

  const ride = data?.data?.data;
  const allMembers = useMemo(() => membersData?.data?.data || [], [membersData]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return allMembers;
    const search = memberSearch.toLowerCase();
    return allMembers.filter((member: { firstName: string; lastName: string; nickname?: string }) =>
      member.firstName.toLowerCase().includes(search) ||
      member.lastName.toLowerCase().includes(search) ||
      (member.nickname && member.nickname.toLowerCase().includes(search))
    );
  }, [allMembers, memberSearch]);

  const openAttendanceModal = () => {
    // Pre-select members who already attended
    const alreadyAttended = ride?.participants
      ?.filter((p: { attended: boolean }) => p.attended)
      ?.map((p: { memberId: string }) => p.memberId) || [];
    setSelectedMembers(alreadyAttended);
    setMileage(ride?.actualDistance?.toString() || ride?.estimatedDistance?.toString() || '');
    setMemberSearch('');
    setShowAttendanceModal(true);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleRecordAttendance = () => {
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }
    attendanceMutation.mutate({
      memberIds: selectedMembers,
      mileage: mileage ? parseFloat(mileage) : undefined,
    });
  };

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
      case 'postponed': return 'bg-yellow-500/20 text-yellow-400';
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
          {isOfficer && (
            <button
              onClick={() => navigate(`/rides/${id}/edit`)}
              className="btn-ghost p-2"
              title="Edit Ride"
            >
              <Edit className="w-5 h-5" />
            </button>
          )}
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">{ride.title}</h1>
        {ride.description && (
          <p className="text-hog-black-300">{ride.description}</p>
        )}

        {/* Admin Controls */}
        {isOfficer && (
          <div className="mt-6 pt-4 border-t border-hog-black-700">
            <h3 className="text-sm font-medium text-hog-black-400 mb-3">Ride Management</h3>
            <div className="flex flex-wrap gap-2">
              {ride.status === 'draft' && (
                <button
                  onClick={() => statusMutation.mutate('published')}
                  disabled={statusMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Publish Ride
                </button>
              )}
              {ride.status === 'published' && (
                <>
                  <button
                    onClick={openAttendanceModal}
                    className="btn-primary flex items-center gap-2"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Record Attendance
                  </button>
                  <button
                    onClick={() => statusMutation.mutate('completed')}
                    disabled={statusMutation.isPending}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    Mark Completed
                  </button>
                  <button
                    onClick={() => statusMutation.mutate('draft')}
                    disabled={statusMutation.isPending}
                    className="btn-ghost flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Unpublish
                  </button>
                </>
              )}
              {ride.status === 'completed' && (
                <button
                  onClick={openAttendanceModal}
                  className="btn-secondary flex items-center gap-2"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Update Attendance
                </button>
              )}
              {ride.status === 'published' && (
                <button
                  onClick={() => {
                    if (confirm('Mark this ride as postponed?')) {
                      statusMutation.mutate('postponed');
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="btn-secondary flex items-center gap-2"
                >
                  <CalendarClock className="w-4 h-4" />
                  Postpone
                </button>
              )}
              {/* Duplicate button - available for any ride */}
              <button
                onClick={() => duplicateMutation.mutate()}
                disabled={duplicateMutation.isPending}
                className="btn-ghost flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
              </button>
              {ride.status !== 'cancelled' && ride.status !== 'completed' && ride.status !== 'postponed' && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this ride?')) {
                      statusMutation.mutate('cancelled');
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Ride
                </button>
              )}
              {ride.status === 'cancelled' && (
                <button
                  onClick={() => statusMutation.mutate('draft')}
                  disabled={statusMutation.isPending}
                  className="btn-secondary flex items-center gap-2"
                >
                  Restore to Draft
                </button>
              )}
            </div>
          </div>
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

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-hog-black-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-hog-black-700">
              <h2 className="text-lg font-display font-semibold">Record Attendance</h2>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="btn-ghost p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Mileage Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ride Mileage (optional)
                </label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="Enter actual miles ridden"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                />
                <p className="text-xs text-hog-black-400 mt-1">
                  This will be logged to each attendee's mileage record
                </p>
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Attendees ({selectedMembers.length} selected)
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-hog-black-400" />
                  <input
                    type="text"
                    className="input pl-10 w-full"
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredMembers.map((member: {
                    id: string;
                    firstName: string;
                    lastName: string;
                    nickname?: string;
                  }) => (
                    <label
                      key={member.id}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                        selectedMembers.includes(member.id)
                          ? 'bg-hog-orange-500/20 border border-hog-orange-500'
                          : 'bg-hog-black-800 hover:bg-hog-black-700'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="w-4 h-4 rounded border-hog-black-600 text-hog-orange-500 focus:ring-hog-orange-500"
                      />
                      <div className="w-8 h-8 rounded-full bg-hog-orange-500 flex items-center justify-center text-white text-sm flex-shrink-0">
                        {member.firstName[0]}
                      </div>
                      <span className="text-sm truncate">
                        {member.firstName} {member.lastName}
                        {member.nickname && ` (${member.nickname})`}
                      </span>
                    </label>
                  ))}
                </div>
                {allMembers.length === 0 && (
                  <p className="text-hog-black-400 text-center py-4">Loading members...</p>
                )}
                {allMembers.length > 0 && filteredMembers.length === 0 && (
                  <p className="text-hog-black-400 text-center py-4">No members match "{memberSearch}"</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-hog-black-700">
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordAttendance}
                disabled={attendanceMutation.isPending || selectedMembers.length === 0}
                className="btn-primary"
              >
                {attendanceMutation.isPending ? 'Saving...' : `Record ${selectedMembers.length} Attendees`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
