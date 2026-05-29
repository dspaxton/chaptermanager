import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, Clock, Users, FileText, CheckCircle, Video, ClipboardCheck, X, Search } from 'lucide-react';
import { meetingsApi, membersApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const isOfficer = user && ['admin', 'director', 'officer', 'head_road_captain', 'secretary'].includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => meetingsApi.getById(id!),
    enabled: !!id,
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', 'all'],
    queryFn: () => membersApi.getAll({ limit: 500, status: 'active' }),
    enabled: showAttendanceModal,
  });

  const attendanceMutation = useMutation({
    mutationFn: (memberIds: string[]) => meetingsApi.recordAttendance(id!, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      toast.success('Attendance recorded successfully!');
      setShowAttendanceModal(false);
      setSelectedMembers([]);
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to record attendance');
    },
  });

  const meeting = data?.data?.data;
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
    const alreadyAttended = meeting?.attendees
      ?.filter((a: { attended: boolean }) => a.attended)
      ?.map((a: { memberId: string }) => a.memberId) || [];
    setSelectedMembers(alreadyAttended);
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
    attendanceMutation.mutate(selectedMembers);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card text-center py-12">
        <Calendar className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
        <p className="text-hog-black-400">Meeting not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={clsx(
              'badge',
              meeting.status === 'scheduled' && 'badge-green',
              meeting.status === 'completed' && 'badge-blue',
              meeting.status === 'cancelled' && 'bg-red-500/20 text-red-400'
            )}>
              {meeting.status}
            </span>
            <span className="badge-gray capitalize">{meeting.meetingType}</span>
          </div>
          {isOfficer && (
            <button
              onClick={openAttendanceModal}
              className="btn-primary flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              {meeting.attendees?.length > 0 ? 'Update Attendance' : 'Record Attendance'}
            </button>
          )}
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">{meeting.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-hog-black-400">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(parseISO(meeting.meetingDate), 'EEEE, MMMM d, yyyy')}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {meeting.startTime}
            {meeting.endTime && ` - ${meeting.endTime}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agenda */}
          {meeting.agenda && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold mb-4">Agenda</h2>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-hog-black-300 text-sm font-sans">
                  {meeting.agenda}
                </pre>
              </div>
            </div>
          )}

          {/* Action Items */}
          {meeting.actionItems?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold mb-4">Action Items</h2>
              <div className="space-y-3">
                {meeting.actionItems.map((item: {
                  id: string;
                  title: string;
                  description?: string;
                  assignedTo?: { firstName: string; lastName: string };
                  status: string;
                  dueDate?: string;
                  priority: number;
                }) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-hog-black-800/50"
                  >
                    <CheckCircle className={clsx(
                      'w-5 h-5 mt-0.5 flex-shrink-0',
                      item.status === 'completed' ? 'text-green-500' : 'text-hog-black-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'font-medium',
                        item.status === 'completed' && 'line-through text-hog-black-400'
                      )}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-sm text-hog-black-400 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-hog-black-500">
                        {item.assignedTo && (
                          <span>Assigned to: {item.assignedTo.firstName} {item.assignedTo.lastName}</span>
                        )}
                        {item.dueDate && (
                          <span>Due: {format(parseISO(item.dueDate), 'MMM d')}</span>
                        )}
                      </div>
                    </div>
                    <span className={clsx(
                      'badge text-xs',
                      item.status === 'completed' && 'badge-green',
                      item.status === 'pending' && 'badge-gray',
                      item.status === 'in_progress' && 'badge-blue'
                    )}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Motions */}
          {meeting.motions?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold mb-4">Motions</h2>
              <div className="space-y-3">
                {meeting.motions.map((motion: {
                  id: string;
                  motionText: string;
                  proposedBy?: { firstName: string; lastName: string };
                  secondedBy?: { firstName: string; lastName: string };
                  votesFor: number;
                  votesAgainst: number;
                  votesAbstain: number;
                  passed: boolean;
                }) => (
                  <div
                    key={motion.id}
                    className="p-3 rounded-lg bg-hog-black-800/50"
                  >
                    <p className="font-medium">{motion.motionText}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-hog-black-400">
                      {motion.proposedBy && (
                        <span>Proposed by: {motion.proposedBy.firstName}</span>
                      )}
                      {motion.secondedBy && (
                        <span>Seconded by: {motion.secondedBy.firstName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm">
                        For: <span className="text-green-500 font-medium">{motion.votesFor}</span>
                      </span>
                      <span className="text-sm">
                        Against: <span className="text-red-500 font-medium">{motion.votesAgainst}</span>
                      </span>
                      <span className="text-sm">
                        Abstain: <span className="text-hog-black-400 font-medium">{motion.votesAbstain}</span>
                      </span>
                      <span className={clsx(
                        'badge text-xs ml-auto',
                        motion.passed ? 'badge-green' : 'bg-red-500/20 text-red-400'
                      )}>
                        {motion.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Location */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold mb-4">Location</h2>
            {meeting.isVirtual ? (
              <div className="flex items-start gap-3">
                <Video className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                <div>
                  <p className="font-medium">Virtual Meeting</p>
                  {meeting.virtualLink && (
                    <a
                      href={meeting.virtualLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-hog-orange-500 hover:underline"
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-hog-orange-500 mt-0.5" />
                <div>
                  <p className="font-medium">{meeting.location || 'TBD'}</p>
                  {meeting.address && (
                    <p className="text-sm text-hog-black-400">{meeting.address}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Minutes Link */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-hog-orange-500" />
              Minutes
            </h2>
            <Link
              to={`/meetings/${id}/minutes`}
              className="btn-primary w-full"
            >
              View Minutes
            </Link>
          </div>

          {/* Attendees */}
          <div className="card">
            <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-hog-orange-500" />
              Attendees ({meeting.attendees?.length || 0})
            </h2>
            {meeting.attendees?.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {meeting.attendees.map((attendee: {
                  id: string;
                  memberId: string;
                  firstName: string;
                  lastName: string;
                  attended: boolean;
                }) => (
                  <div
                    key={attendee.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-hog-black-800/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-hog-orange-500 flex items-center justify-center text-white text-sm">
                      {attendee.firstName[0]}
                    </div>
                    <span className="text-sm">
                      {attendee.firstName} {attendee.lastName}
                    </span>
                    {attendee.attended && (
                      <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-hog-black-400 text-sm">No attendance recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-hog-black-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-hog-black-700">
              <h2 className="text-lg font-display font-semibold">Record Meeting Attendance</h2>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="btn-ghost p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
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
