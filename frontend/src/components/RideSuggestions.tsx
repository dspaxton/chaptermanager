import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Sparkles, MapPin, Clock, Bike, X, ArrowRight } from 'lucide-react';
import { aiApi } from '../lib/api';
import toast from 'react-hot-toast';

interface SuggestionFormData {
  startLocation: string;
  preferredDistance: number;
  difficulty: number;
  date?: string;
  groupSize?: number;
}

interface RideSuggestion {
  title: string;
  description: string;
  estimatedDistance?: number;
  estimatedDuration?: number; // minutes
  difficulty?: number;
  waypoints?: string[];
  safetyNotes?: string[];
}

interface RideSuggestionsProps {
  onClose: () => void;
}

export default function RideSuggestions({ onClose }: RideSuggestionsProps) {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<RideSuggestion[] | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SuggestionFormData>({
    defaultValues: { preferredDistance: 100, difficulty: 2 },
  });

  const suggestMutation = useMutation({
    mutationFn: (data: SuggestionFormData) =>
      aiApi.getRideSuggestions({
        startLocation: data.startLocation,
        preferredDistance: data.preferredDistance ? Number(data.preferredDistance) : undefined,
        difficulty: data.difficulty ? Number(data.difficulty) : undefined,
        date: data.date || undefined,
        groupSize: data.groupSize ? Number(data.groupSize) : undefined,
      }),
    onSuccess: (response) => {
      setSuggestions(response.data?.data?.suggestions || []);
    },
    onError: () => {
      toast.error('AI service is temporarily unavailable, please try again.');
    },
  });

  const onSubmit = (data: SuggestionFormData) => {
    setSuggestions(null);
    suggestMutation.mutate(data);
  };

  const applySuggestion = (s: RideSuggestion) => {
    const routeParts: string[] = [];
    if (s.description) routeParts.push(s.description);
    if (s.waypoints?.length) routeParts.push('Waypoints:\n- ' + s.waypoints.join('\n- '));
    if (s.safetyNotes?.length) routeParts.push('Safety notes:\n- ' + s.safetyNotes.join('\n- '));

    const prefill = {
      title: s.title,
      description: s.description,
      estimatedDistance: s.estimatedDistance,
      // minutes -> hours, rounded to nearest 0.5 (RideCreate converts hours back to minutes on submit)
      estimatedDuration: s.estimatedDuration ? Math.round((s.estimatedDuration / 60) * 2) / 2 : undefined,
      difficultyLevel: s.difficulty,
      routeDescription: routeParts.join('\n\n'),
    };
    navigate('/rides/new', { state: { prefill } });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-hog-orange-500" />
          Suggest a Ride
        </h2>
        <button onClick={onClose} className="btn-ghost p-2" aria-label="Close suggestions">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">
            Start Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input w-full"
            placeholder="e.g., Downtown Dealership"
            {...register('startLocation', { required: 'Start location is required' })}
          />
          {errors.startLocation && (
            <p className="text-red-500 text-sm mt-1">{errors.startLocation.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Preferred Distance (miles)</label>
          <input type="number" className="input w-full" {...register('preferredDistance')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Difficulty</label>
          <select className="input w-full" {...register('difficulty')}>
            <option value={1}>1 - Easy (New riders welcome)</option>
            <option value={2}>2 - Moderate</option>
            <option value={3}>3 - Intermediate</option>
            <option value={4}>4 - Challenging</option>
            <option value={5}>5 - Expert Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date (optional)</label>
          <input type="date" className="input w-full" {...register('date')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Group Size (optional)</label>
          <input type="number" className="input w-full" placeholder="e.g., 12" {...register('groupSize')} />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={suggestMutation.isPending}>
            {suggestMutation.isPending ? 'Thinking...' : 'Suggest Routes'}
          </button>
        </div>
      </form>

      {suggestMutation.isPending && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      )}

      {suggestions && suggestions.length === 0 && !suggestMutation.isPending && (
        <div className="text-center py-8 text-hog-black-400">
          No suggestions came back. Try adjusting your inputs and asking again.
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s, idx) => (
            <div key={idx} className="bg-hog-black-800/50 rounded-lg p-4 flex flex-col">
              <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {s.estimatedDistance != null && (
                  <span className="badge-orange text-xs flex items-center gap-1">
                    <Bike className="w-3 h-3" />~{s.estimatedDistance} mi
                  </span>
                )}
                {s.estimatedDuration != null && (
                  <span className="badge-blue text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />~{Math.round((s.estimatedDuration / 60) * 10) / 10} h
                  </span>
                )}
                {s.difficulty != null && (
                  <span className="badge-gray text-xs">Difficulty {s.difficulty}/5</span>
                )}
              </div>
              <p className="text-sm text-hog-black-400 mb-3">{s.description}</p>

              {s.waypoints && s.waypoints.length > 0 && (
                <div className="text-sm mb-2">
                  <p className="font-medium flex items-center gap-1 mb-1">
                    <MapPin className="w-4 h-4 text-hog-orange-500" />Waypoints
                  </p>
                  <ul className="list-disc list-inside text-hog-black-400 space-y-0.5">
                    {s.waypoints.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {s.safetyNotes && s.safetyNotes.length > 0 && (
                <div className="text-sm mb-3">
                  <p className="font-medium mb-1">Safety Notes</p>
                  <ul className="list-disc list-inside text-hog-black-400 space-y-0.5">
                    {s.safetyNotes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              <button
                onClick={() => applySuggestion(s)}
                className="btn-primary mt-auto flex items-center justify-center gap-2"
              >
                Use this ride <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
