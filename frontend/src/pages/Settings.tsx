import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Bike, Bell, Plus, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { membersApi, authApi } from '../lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const bikeSchema = z.object({
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  make: z.string().min(1, 'Make is required'),
  model: z.string().optional(),
  color: z.string().optional(),
  nickname: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type BikeForm = z.infer<typeof bikeSchema>;

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'bikes' | 'notifications'>('profile');
  const [showBikeForm, setShowBikeForm] = useState(false);

  const { data: memberData } = useQuery({
    queryKey: ['member', user?.member?.id],
    queryFn: () => membersApi.getById(user!.member!.id),
    enabled: !!user?.member?.id,
  });

  const member = memberData?.data?.data;

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: member?.firstName || '',
      lastName: member?.lastName || '',
      nickname: member?.nickname || '',
      phone: member?.phone || '',
      bio: member?.bio || '',
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const bikeForm = useForm<BikeForm>({
    resolver: zodResolver(bikeSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      make: 'Harley-Davidson',
      model: '',
      color: '',
      nickname: '',
      isPrimary: false,
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => membersApi.update(user!.member!.id, data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['member', user?.member?.id] });
      updateUser({
        member: user?.member ? {
          ...user.member,
          firstName: data.firstName,
          lastName: data.lastName,
          nickname: data.nickname,
        } : undefined,
      });
      toast.success('Profile updated!');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordForm) => authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      passwordForm.reset();
      toast.success('Password changed successfully!');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to change password');
    },
  });

  const addBikeMutation = useMutation({
    mutationFn: (data: BikeForm) => membersApi.addBike(user!.member!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', user?.member?.id] });
      bikeForm.reset();
      setShowBikeForm(false);
      toast.success('Bike added!');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to add bike');
    },
  });

  const deleteBikeMutation = useMutation({
    mutationFn: (bikeId: string) => membersApi.deleteBike(user!.member!.id, bikeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', user?.member?.id] });
      toast.success('Bike removed');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Failed to remove bike');
    },
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'bikes', label: 'My Bikes', icon: Bike },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-hog-black-400 mt-1">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabs */}
        <div className="card lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-hog-orange-500/10 text-hog-orange-500'
                    : 'text-hog-black-300 hover:text-white hover:bg-hog-black-800'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="card lg:col-span-3">
          {activeTab === 'profile' && (
            <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))}>
              <h2 className="text-lg font-display font-semibold mb-6">Profile Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name</label>
                    <input
                      type="text"
                      className="input"
                      {...profileForm.register('firstName')}
                    />
                    {profileForm.formState.errors.firstName && (
                      <p className="text-red-500 text-sm mt-1">
                        {profileForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input
                      type="text"
                      className="input"
                      {...profileForm.register('lastName')}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Nickname (Road Name)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Optional"
                    {...profileForm.register('nickname')}
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="(555) 123-4567"
                    {...profileForm.register('phone')}
                  />
                </div>
                <div>
                  <label className="label">Bio</label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Tell us about yourself..."
                    {...profileForm.register('bio')}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}>
              <h2 className="text-lg font-display font-semibold mb-6">Change Password</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="label">Current Password</label>
                  <input
                    type="password"
                    className="input"
                    {...passwordForm.register('currentPassword')}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-red-500 text-sm mt-1">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    className="input"
                    {...passwordForm.register('newPassword')}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-red-500 text-sm mt-1">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input"
                    {...passwordForm.register('confirmPassword')}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'bikes' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-display font-semibold">My Bikes</h2>
                {!showBikeForm && (
                  <button
                    className="btn-primary flex items-center gap-2"
                    onClick={() => setShowBikeForm(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Add Bike
                  </button>
                )}
              </div>

              {showBikeForm && (
                <form
                  onSubmit={bikeForm.handleSubmit((data) => addBikeMutation.mutate(data))}
                  className="mb-6 p-4 rounded-lg bg-hog-black-800 border border-hog-black-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Add New Bike</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBikeForm(false);
                        bikeForm.reset();
                      }}
                      className="text-hog-black-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Year *</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="2024"
                        {...bikeForm.register('year')}
                      />
                      {bikeForm.formState.errors.year && (
                        <p className="text-red-500 text-sm mt-1">
                          {bikeForm.formState.errors.year.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Make *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Harley-Davidson"
                        {...bikeForm.register('make')}
                      />
                      {bikeForm.formState.errors.make && (
                        <p className="text-red-500 text-sm mt-1">
                          {bikeForm.formState.errors.make.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="label">Model</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Street Glide"
                        {...bikeForm.register('model')}
                      />
                    </div>
                    <div>
                      <label className="label">Color</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Vivid Black"
                        {...bikeForm.register('color')}
                      />
                    </div>
                    <div>
                      <label className="label">Nickname</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Black Beauty"
                        {...bikeForm.register('nickname')}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="isPrimary"
                        className="w-4 h-4 rounded border-hog-black-600 text-hog-orange-500 focus:ring-hog-orange-500"
                        {...bikeForm.register('isPrimary')}
                      />
                      <label htmlFor="isPrimary" className="text-sm">
                        Primary bike
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setShowBikeForm(false);
                        bikeForm.reset();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={addBikeMutation.isPending}
                    >
                      {addBikeMutation.isPending ? 'Adding...' : 'Add Bike'}
                    </button>
                  </div>
                </form>
              )}

              {member?.bikes?.length > 0 ? (
                <div className="space-y-4">
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
                      className="flex items-center justify-between p-4 rounded-lg bg-hog-black-800"
                    >
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
                      <div className="flex items-center gap-3">
                        {bike.is_primary && (
                          <span className="badge-orange">Primary</span>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to remove this bike?')) {
                              deleteBikeMutation.mutate(bike.id);
                            }
                          }}
                          className="text-hog-black-400 hover:text-red-500 transition-colors"
                          title="Remove bike"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showBikeForm && (
                <div className="text-center py-8">
                  <Bike className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
                  <p className="text-hog-black-400 mb-4">No bikes added yet</p>
                  <button
                    className="btn-primary"
                    onClick={() => setShowBikeForm(true)}
                  >
                    Add Your First Bike
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-lg font-display font-semibold mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-hog-black-800">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-hog-black-400">Receive updates via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-hog-black-600 peer-focus:ring-2 peer-focus:ring-hog-orange-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hog-orange-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-hog-black-800">
                  <div>
                    <p className="font-medium">New Ride Alerts</p>
                    <p className="text-sm text-hog-black-400">Get notified when new rides are posted</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-hog-black-600 peer-focus:ring-2 peer-focus:ring-hog-orange-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hog-orange-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-hog-black-800">
                  <div>
                    <p className="font-medium">Meeting Reminders</p>
                    <p className="text-sm text-hog-black-400">Remind me before chapter meetings</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-hog-black-600 peer-focus:ring-2 peer-focus:ring-hog-orange-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hog-orange-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
