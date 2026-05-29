import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, RefreshCw, UserX, CheckCircle } from 'lucide-react';
import { aiApi } from '../lib/api';
import toast from 'react-hot-toast';

interface InactiveMember {
  id: string;
  name: string;
  daysInactive: number;
  totalRides: number;
  totalMeetings: number;
  lastRide: string | null;
  lastMeeting: string | null;
}

interface EngagementData {
  inactiveMembers: InactiveMember[];
  totalInactive: number;
  recommendations: string;
}

export default function EngagementInsights() {
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['engagement-analysis'],
    queryFn: async () => {
      try {
        const res = await aiApi.getEngagementAnalysis();
        return res.data.data as EngagementData;
      } catch (err) {
        toast.error('AI service is temporarily unavailable, please try again.');
        throw err;
      }
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Initial state: nothing generated yet, not loading, no error.
  if (!data && !isFetching && !isError) {
    return (
      <div className="card text-center py-12">
        <Sparkles className="w-12 h-12 text-hog-orange-500 mx-auto mb-4" />
        <h3 className="font-display font-semibold text-lg mb-2">Member Engagement Insights</h3>
        <p className="text-hog-black-400 max-w-md mx-auto mb-6">
          Generate an AI analysis of member engagement: who has gone quiet, trends, and
          recommended outreach. This makes a live AI request.
        </p>
        <button onClick={() => refetch()} className="btn-primary">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Insights
        </button>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="card text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-hog-black-400 mt-4">Analyzing member engagement...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="card text-center py-12">
        <p className="text-hog-black-400 mb-4">Could not load engagement insights.</p>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-hog-black-400">
          {data.totalInactive > 0
            ? `${data.totalInactive} member${data.totalInactive === 1 ? '' : 's'} inactive (90+ days)`
            : 'All members are actively engaged'}
        </p>
        <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {data.inactiveMembers.length > 0 ? (
        <div className="card">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <UserX className="w-5 h-5 text-hog-orange-500" />
            Inactive Members
          </h3>
          <div className="space-y-2">
            {data.inactiveMembers.map((m) => (
              <Link
                key={m.id}
                to={`/members/${m.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-sm text-hog-black-400">
                  {m.daysInactive >= 999 ? 'No recorded activity' : `${m.daysInactive} days inactive`}
                  {' • '}{m.totalRides} rides • {m.totalMeetings} meetings
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-hog-black-400">No inactive members flagged.</p>
        </div>
      )}

      <div className="card">
        <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-hog-orange-500" />
          Recommendations
        </h3>
        <p className="text-sm text-hog-black-300 whitespace-pre-wrap">{data.recommendations}</p>
      </div>
    </div>
  );
}
