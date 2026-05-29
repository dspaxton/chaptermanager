import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Bike, Loader2 } from 'lucide-react';
import { ridesApi } from '../lib/api';
import toast from 'react-hot-toast';

interface RideFormData {
  title: string;
  description?: string;
  rideType: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  meetupLocation?: string;
  meetupAddress?: string;
  destination?: string;
  destinationAddress?: string;
  estimatedDistance?: number;
  estimatedDuration?: number;
  difficultyLevel: number;
  routeDescription?: string;
  routeMapUrl?: string;
  rsvpRequired: boolean;
  rsvpDeadline?: string;
  maxParticipants?: number;
}

export default function RideEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRsvpOptions, setShowRsvpOptions] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ride', id],
    queryFn: () => ridesApi.getById(id!),
    enabled: !!id,
  });

  const ride = data?.data?.data;

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<RideFormData>({
    defaultValues: {
      rideType: 'chapter_ride',
      difficultyLevel: 2,
      rsvpRequired: false,
    },
  });

  // Populate form when ride data loads
  useEffect(() => {
    if (ride) {
      reset({
        title: ride.title,
        description: ride.description || '',
        rideType: ride.rideType,
        startDate: ride.startDate ? ride.startDate.split('T')[0] : '',
        startTime: ride.startTime?.substring(0, 5) || '',
        endDate: ride.endDate ? ride.endDate.split('T')[0] : '',
        endTime: ride.endTime?.substring(0, 5) || '',
        meetupLocation: ride.meetupLocation || '',
        meetupAddress: ride.meetupAddress || '',
        destination: ride.destination || '',
        destinationAddress: ride.destinationAddress || '',
        estimatedDistance: ride.estimatedDistance || undefined,
        estimatedDuration: ride.estimatedDuration ? ride.estimatedDuration / 60 : undefined,
        difficultyLevel: ride.difficultyLevel,
        routeDescription: ride.routeDescription || '',
        routeMapUrl: ride.routeMapUrl || '',
        rsvpRequired: ride.rsvpRequired,
        rsvpDeadline: ride.rsvpDeadline || '',
        maxParticipants: ride.maxParticipants || undefined,
      });
      setShowRsvpOptions(ride.rsvpRequired);
    }
  }, [ride, reset]);

  const rideType = watch('rideType');
  const rsvpRequired = watch('rsvpRequired');

  const isOvernightTrip = rideType === 'overnight' || rideType === 'multi_day';

  const updateMutation = useMutation({
    mutationFn: (data: RideFormData) => ridesApi.update(id!, {
      ...data,
      estimatedDistance: data.estimatedDistance ? Number(data.estimatedDistance) : undefined,
      estimatedDuration: data.estimatedDuration ? Number(data.estimatedDuration) * 60 : undefined,
      maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : undefined,
      difficultyLevel: Number(data.difficultyLevel),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ride', id] });
      queryClient.invalidateQueries({ queryKey: ['rides'] });
      toast.success('Ride updated successfully!');
      navigate(`/rides/${id}`);
    },
    onError: (error: { response?: { data?: { error?: string | Array<{ message: string }> } } }) => {
      const err = error.response?.data?.error;
      if (Array.isArray(err)) {
        toast.error(err[0]?.message || 'Validation error');
      } else {
        toast.error(err || 'Failed to update ride');
      }
    },
  });

  const onSubmit = (data: RideFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-hog-orange-500" />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/rides/${id}`)}
          className="btn-ghost p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold">Edit Ride</h1>
          <p className="text-hog-black-400 mt-1">Update ride details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <Bike className="w-5 h-5 text-hog-orange-500" />
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Ride Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g., Sunday Morning Breakfast Run"
                {...register('title', { required: 'Title is required' })}
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="input w-full"
                rows={3}
                placeholder="Describe the ride..."
                {...register('description')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Ride Type</label>
              <select className="input w-full" {...register('rideType')}>
                <option value="chapter_ride">Chapter Ride</option>
                <option value="overnight">Overnight Trip</option>
                <option value="multi_day">Multi-Day Trip</option>
                <option value="dealer_event">Dealer Event</option>
                <option value="charity">Charity Ride</option>
                <option value="rally">Rally</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Difficulty Level</label>
              <select className="input w-full" {...register('difficultyLevel')}>
                <option value={1}>1 - Easy (New riders welcome)</option>
                <option value={2}>2 - Moderate</option>
                <option value={3}>3 - Intermediate</option>
                <option value={4}>4 - Challenging</option>
                <option value={5}>5 - Expert Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4">Date & Time</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="input w-full"
                {...register('startDate', { required: 'Start date is required' })}
              />
              {errors.startDate && (
                <p className="text-red-500 text-sm mt-1">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="time"
                className="input w-full"
                {...register('startTime')}
              />
            </div>

            {isOvernightTrip && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    className="input w-full"
                    {...register('endDate')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    className="input w-full"
                    {...register('endTime')}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4">Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Meetup Location</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g., Dealership Parking Lot"
                {...register('meetupLocation')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Meetup Address</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Full address"
                {...register('meetupAddress')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Destination</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g., Mountain View Cafe"
                {...register('destination')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Destination Address</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Full address"
                {...register('destinationAddress')}
              />
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4">Route Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Distance (miles)</label>
              <input
                type="number"
                className="input w-full"
                placeholder="e.g., 75"
                {...register('estimatedDistance')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Estimated Duration (hours)</label>
              <input
                type="number"
                step="0.5"
                className="input w-full"
                placeholder="e.g., 3"
                {...register('estimatedDuration')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Route Description</label>
              <textarea
                className="input w-full"
                rows={3}
                placeholder="Describe the route, stops, and any important notes..."
                {...register('routeDescription')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Route Map URL</label>
              <input
                type="url"
                className="input w-full"
                placeholder="Link to Google Maps, Rever, etc."
                {...register('routeMapUrl')}
              />
            </div>
          </div>
        </div>

        {/* RSVP Settings */}
        <div className="card">
          <h2 className="text-lg font-display font-semibold mb-4">RSVP Settings</h2>

          {isOvernightTrip && (
            <div className="bg-hog-orange-500/10 border border-hog-orange-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-hog-orange-400">
                Overnight and multi-day trips typically require RSVP to plan accommodations and logistics.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-hog-black-600 text-hog-orange-500 focus:ring-hog-orange-500"
                {...register('rsvpRequired')}
                onChange={(e) => {
                  setShowRsvpOptions(e.target.checked);
                }}
              />
              <span>Require RSVP for this ride</span>
            </label>

            {(rsvpRequired || showRsvpOptions) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8 border-l-2 border-hog-black-700">
                <div>
                  <label className="block text-sm font-medium mb-1">RSVP Deadline</label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    {...register('rsvpDeadline')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Participants</label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="Leave empty for unlimited"
                    {...register('maxParticipants')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/rides/${id}`)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
