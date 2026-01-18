import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { FileText, Calendar, Search } from 'lucide-react';
import { meetingsApi } from '../lib/api';

export default function Minutes() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['allMinutes', page],
    queryFn: () => meetingsApi.getAllMinutes({ page, limit: 12 }),
  });

  const minutes = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Meeting Minutes</h1>
          <p className="text-hog-black-400 mt-1">Browse published meeting minutes</p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-hog-black-400" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Search minutes... (coming soon)"
            disabled
          />
        </div>
      </div>

      {/* Minutes list */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : minutes.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {minutes.map((item: {
              id: string;
              meetingId: string;
              meetingTitle: string;
              meetingDate: string;
              meetingType: string;
              summary?: string;
              aiSummary?: string;
              approvedAt?: string;
            }) => (
              <Link
                key={item.id}
                to={`/meetings/${item.meetingId}`}
                className="card hover:border-hog-orange-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="badge-gray text-xs capitalize">{item.meetingType}</span>
                  {item.aiSummary && (
                    <span className="badge-orange text-xs">AI Summary</span>
                  )}
                </div>
                <h3 className="font-display font-semibold mb-2">{item.meetingTitle}</h3>
                <div className="flex items-center gap-2 text-sm text-hog-black-400 mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>{format(parseISO(item.meetingDate), 'MMMM d, yyyy')}</span>
                </div>
                {(item.aiSummary || item.summary) && (
                  <p className="text-sm text-hog-black-300 line-clamp-3">
                    {item.aiSummary || item.summary}
                  </p>
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
          <FileText className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
          <p className="text-hog-black-400">No published minutes yet</p>
        </div>
      )}
    </div>
  );
}
