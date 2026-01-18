import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Calendar, MapPin, Users, Plus, Filter, Video } from 'lucide-react';
import { meetingsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { clsx } from 'clsx';

export default function Meetings() {
  const { user } = useAuthStore();
  const canCreate = ['admin', 'director', 'officer'].includes(user?.role || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', typeFilter, statusFilter, page],
    queryFn: () => meetingsApi.getAll({
      meetingType: typeFilter || undefined,
      status: statusFilter || undefined,
      page,
      limit: 12,
    }),
  });

  const meetings = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Meetings</h1>
          <p className="text-hog-black-400 mt-1">Chapter meetings and events</p>
        </div>
        {canCreate && (
          <Link to="/meetings/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Meeting
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
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="chapter">Chapter Meeting</option>
              <option value="officer">Officer Meeting</option>
              <option value="committee">Committee</option>
              <option value="special">Special</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Meeting list */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : meetings.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting: {
              id: string;
              title: string;
              meetingType: string;
              status: string;
              meetingDate: string;
              startTime: string;
              location?: string;
              isVirtual: boolean;
              attendeeCount: number;
              hasMinutes: boolean;
            }) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="card hover:border-hog-orange-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={clsx(
                    'badge',
                    meeting.status === 'scheduled' && 'badge-green',
                    meeting.status === 'completed' && 'badge-blue',
                    meeting.status === 'cancelled' && 'bg-red-500/20 text-red-400'
                  )}>
                    {meeting.status}
                  </span>
                  <span className="badge-gray text-xs capitalize">{meeting.meetingType}</span>
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{meeting.title}</h3>
                <div className="space-y-2 text-sm text-hog-black-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(parseISO(meeting.meetingDate), 'EEEE, MMM d')} at {meeting.startTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {meeting.isVirtual ? (
                      <>
                        <Video className="w-4 h-4" />
                        <span>Virtual Meeting</span>
                      </>
                    ) : meeting.location ? (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>{meeting.location}</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>TBD</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{meeting.attendeeCount} attended</span>
                  </div>
                </div>
                {meeting.hasMinutes && (
                  <div className="mt-3 pt-3 border-t border-hog-black-800">
                    <span className="badge-green text-xs">Minutes Available</span>
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
          <Calendar className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
          <p className="text-hog-black-400">No meetings found</p>
        </div>
      )}
    </div>
  );
}
