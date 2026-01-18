import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Users, Filter } from 'lucide-react';
import { membersApi } from '../lib/api';
import { clsx } from 'clsx';

export default function Members() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['members', search, statusFilter, page],
    queryFn: () => membersApi.getAll({ search, status: statusFilter || undefined, page, limit: 20 }),
  });

  const members = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Members</h1>
          <p className="text-hog-black-400 mt-1">Chapter member directory</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-hog-black-400" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Search members..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
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
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
              <option value="honorary">Honorary</option>
            </select>
          </div>
        </div>
      </div>

      {/* Member list */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : members.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member: {
                id: string;
                firstName: string;
                lastName: string;
                nickname?: string;
                photoUrl?: string;
                status: string;
                totalRides: number;
                totalMileage: number;
                currentPosition?: string;
              }) => (
                <Link
                  key={member.id}
                  to={`/members/${member.id}`}
                  className="flex items-center gap-4 p-4 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-hog-orange-500 flex items-center justify-center text-white font-bold text-lg">
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
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {member.firstName} {member.lastName}
                      {member.nickname && (
                        <span className="text-hog-black-400"> "{member.nickname}"</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-hog-black-400">
                      <span className={clsx(
                        'badge text-xs',
                        member.status === 'active' && 'badge-green',
                        member.status === 'prospect' && 'badge-blue',
                        member.status === 'inactive' && 'badge-gray'
                      )}>
                        {member.status}
                      </span>
                      {member.currentPosition && (
                        <span className="badge-orange text-xs">{member.currentPosition}</span>
                      )}
                    </div>
                    <p className="text-xs text-hog-black-500 mt-1">
                      {member.totalRides} rides • {member.totalMileage.toLocaleString()} miles
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
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
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
            <p className="text-hog-black-400">No members found</p>
          </div>
        )}
      </div>
    </div>
  );
}
