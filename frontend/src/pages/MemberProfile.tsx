import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { User, Bike, Calendar, MapPin, Phone, Mail, Award, Shield, UserCog } from 'lucide-react';
import { membersApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const MEMBER_STATUSES = ['active', 'inactive', 'prospect', 'suspended', 'honorary'] as const;

// Position to role mapping - assigns both position title AND system role
const OFFICER_POSITIONS = [
  { position: 'Director', role: 'director', description: 'Chapter leadership with full privileges' },
  { position: 'Assistant Director', role: 'director', description: 'Chapter leadership with full privileges' },
  { position: 'Secretary', role: 'secretary', description: 'Manages meetings and minutes' },
  { position: 'Treasurer', role: 'officer', description: 'Chapter officer privileges' },
  { position: 'Head Road Captain', role: 'head_road_captain', description: 'Lead road captain, manages all rides' },
  { position: 'Safety Officer', role: 'officer', description: 'Chapter officer privileges' },
  { position: 'Activities Officer', role: 'officer', description: 'Chapter officer privileges' },
  { position: 'Membership Officer', role: 'officer', description: 'Chapter officer privileges' },
  { position: 'Photographer', role: 'member', description: 'Standard member access' },
  { position: 'Historian', role: 'member', description: 'Standard member access' },
  { position: 'Webmaster', role: 'officer', description: 'Chapter officer privileges' },
  { position: 'Road Captain', role: 'road_captain', description: 'Can manage rides' },
  { position: 'Member', role: 'member', description: 'Standard member access (removes officer role)' },
] as const;

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [newStatus, setNewStatus] = useState<string>('');
  const [newPosition, setNewPosition] = useState<string>('');
  const [positionStartDate, setPositionStartDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  const isAdmin = user?.role === 'admin' || user?.role === 'director';

  const { data, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => membersApi.getById(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => membersApi.updateStatus(id!, status),
    onSuccess: () => {
      toast.success('Member status updated');
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setNewStatus('');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to update status');
    },
  });

  const positionMutation = useMutation({
    mutationFn: async () => {
      const selectedPosition = OFFICER_POSITIONS.find(p => p.position === newPosition);
      if (!selectedPosition) throw new Error('Invalid position');

      // First assign the position
      await membersApi.addPosition(id!, newPosition, positionStartDate);

      // Then update the system role to match
      await membersApi.updateRole(id!, selectedPosition.role);
    },
    onSuccess: () => {
      const selectedPosition = OFFICER_POSITIONS.find(p => p.position === newPosition);
      toast.success(`Position assigned and role updated to ${selectedPosition?.role}. User will need to log out and back in for role changes to take effect.`);
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      setNewPosition('');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to assign position');
    },
  });

  const member = data?.data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="card text-center py-12">
        <User className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
        <p className="text-hog-black-400">Member not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-hog-orange-500 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.firstName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              member.firstName[0]
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-display font-bold">
                  {member.firstName} {member.lastName}
                  {member.nickname && (
                    <span className="text-hog-black-400 ml-2">"{member.nickname}"</span>
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={clsx(
                    'badge',
                    member.status === 'active' && 'badge-green',
                    member.status === 'prospect' && 'badge-blue',
                    member.status === 'inactive' && 'badge-gray'
                  )}>
                    {member.status}
                  </span>
                  {member.positions?.filter((p: { is_current: boolean }) => p.is_current).map((pos: { position_title: string }, i: number) => (
                    <span key={i} className="badge-orange">{pos.position_title}</span>
                  ))}
                </div>
              </div>
            </div>
            {member.bio && (
              <p className="text-hog-black-300 mt-4">{member.bio}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-hog-orange-500" />
            Stats
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-hog-black-400">Total Rides</span>
              <span className="font-medium">{member.totalRides}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-hog-black-400">Total Mileage</span>
              <span className="font-medium">{member.totalMileage?.toLocaleString()} miles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-hog-black-400">Meetings Attended</span>
              <span className="font-medium">{member.totalMeetings}</span>
            </div>
            {member.chapterJoinDate && (
              <div className="flex justify-between">
                <span className="text-hog-black-400">Member Since</span>
                <span className="font-medium">
                  {format(parseISO(member.chapterJoinDate), 'MMM yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Info */}
        {(member.email || member.phone || member.city) && (
          <div className="card">
            <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-hog-orange-500" />
              Contact
            </h2>
            <div className="space-y-3">
              {member.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-hog-black-400" />
                  <span>{member.email}</span>
                </div>
              )}
              {member.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-hog-black-400" />
                  <span>{member.phone}</span>
                </div>
              )}
              {member.city && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-hog-black-400" />
                  <span>{member.city}, {member.state}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bikes */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <Bike className="w-5 h-5 text-hog-orange-500" />
            Bikes
          </h2>
          {member.bikes?.length > 0 ? (
            <div className="space-y-3">
              {member.bikes.map((bike: {
                id: string;
                year?: number;
                make: string;
                model?: string;
                nickname?: string;
                color?: string;
                is_primary: boolean;
              }) => (
                <div
                  key={bike.id}
                  className="p-3 rounded-lg bg-hog-black-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {bike.year} {bike.make} {bike.model}
                      </p>
                      {bike.nickname && (
                        <p className="text-sm text-hog-black-400">"{bike.nickname}"</p>
                      )}
                      {bike.color && (
                        <p className="text-sm text-hog-black-500">{bike.color}</p>
                      )}
                    </div>
                    {bike.is_primary && (
                      <span className="badge-orange text-xs">Primary</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-hog-black-400 text-sm">No bikes registered</p>
          )}
        </div>
      </div>

      {/* Position History */}
      {member.positions?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-hog-orange-500" />
            Position History
          </h2>
          <div className="space-y-2">
            {member.positions.map((pos: {
              position_title: string;
              start_date: string;
              end_date?: string;
              is_current: boolean;
            }, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-hog-black-800/50"
              >
                <span className="font-medium">{pos.position_title}</span>
                <span className="text-sm text-hog-black-400">
                  {format(parseISO(pos.start_date), 'MMM yyyy')} -
                  {pos.is_current ? ' Present' : pos.end_date ? ` ${format(parseISO(pos.end_date), 'MMM yyyy')}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Panel - Only visible to admins and directors */}
      {isAdmin && (
        <div className="card border-2 border-hog-orange-500/30">
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-hog-orange-500" />
            Admin Controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Change Status */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                Change Member Status
              </h3>
              <p className="text-sm text-hog-black-400">
                Current status: <span className="font-medium text-white">{member.status}</span>
              </p>
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="">Select new status...</option>
                  {MEMBER_STATUSES.filter(s => s !== member.status).map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-primary"
                  disabled={!newStatus || statusMutation.isPending}
                  onClick={() => newStatus && statusMutation.mutate(newStatus)}
                >
                  {statusMutation.isPending ? 'Updating...' : 'Update'}
                </button>
              </div>
              <div className="text-xs text-hog-black-500 space-y-1">
                <p><strong>Active:</strong> Full chapter member with all privileges</p>
                <p><strong>Prospect:</strong> New member in probationary period</p>
                <p><strong>Inactive:</strong> Member not currently participating</p>
                <p><strong>Suspended:</strong> Membership temporarily revoked</p>
                <p><strong>Honorary:</strong> Special recognition status</p>
              </div>
            </div>

            {/* Assign Position & Role */}
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Award className="w-4 h-4" />
                Assign Position & Role
              </h3>
              <p className="text-sm text-hog-black-400">
                Current role: <span className="font-medium text-white">{member.userRole}</span>
              </p>
              <select
                className="input w-full"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
              >
                <option value="">Select position...</option>
                {OFFICER_POSITIONS.map(pos => (
                  <option key={pos.position} value={pos.position}>
                    {pos.position} → {pos.role}
                  </option>
                ))}
              </select>
              {newPosition && (
                <p className="text-xs text-hog-orange-400">
                  {OFFICER_POSITIONS.find(p => p.position === newPosition)?.description}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="date"
                  className="input flex-1"
                  value={positionStartDate}
                  onChange={(e) => setPositionStartDate(e.target.value)}
                />
                <button
                  className="btn-primary"
                  disabled={!newPosition || positionMutation.isPending}
                  onClick={() => positionMutation.mutate()}
                >
                  {positionMutation.isPending ? 'Assigning...' : 'Assign'}
                </button>
              </div>
              <p className="text-xs text-hog-black-500">
                Assigns the position and automatically sets the corresponding system role.
                User will need to log out and back in for role changes to take effect.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
