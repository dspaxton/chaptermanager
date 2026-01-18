import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { User, Bike, Calendar, MapPin, Phone, Mail, Award } from 'lucide-react';
import { membersApi } from '../lib/api';
import { clsx } from 'clsx';

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => membersApi.getById(id!),
    enabled: !!id,
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
    </div>
  );
}
