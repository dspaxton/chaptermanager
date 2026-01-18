import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, Clock, Users, FileText, CheckCircle, Video } from 'lucide-react';
import { meetingsApi } from '../lib/api';
import { clsx } from 'clsx';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => meetingsApi.getById(id!),
    enabled: !!id,
  });

  const meeting = data?.data?.data;

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
    </div>
  );
}
