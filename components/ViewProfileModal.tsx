'use client';

import { useState, useEffect } from 'react';

interface ViewProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  status?: string;
  profilePicture?: string;
}

export default function ViewProfileModal({ isOpen, onClose, userId }: ViewProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper to get image source - handles both file URLs and base64
  const getImageSrc = (picture: string) => {
    if (!picture || !picture.trim()) return '';
    // If it's a base64 data URL, return as is
    if (picture.startsWith('data:image/')) {
      return picture;
    }
    // Otherwise, it's a file path/URL
    return picture;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1a1a] rounded-lg w-full max-w-md border border-[#2a2a2a]">
          {/* Header */}
          <div className="p-6 border-b border-[#2a2a2a] flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-400">Loading...</div>
              </div>
            ) : profile ? (
              <>
                {/* Profile Picture */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => profile.profilePicture && profile.profilePicture.trim() && setShowImageModal(true)}
                    className="relative cursor-pointer"
                  >
                    {profile.profilePicture && profile.profilePicture.trim() ? (
                      <img
                        src={getImageSrc(profile.profilePicture)}
                        alt="Profile"
                        className="w-32 h-32 rounded-full object-cover border-4 border-[#2a2a2a] hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-semibold border-4 border-[#2a2a2a]">
                        {getInitials(profile.name || 'U')}
                      </div>
                    )}
                  </button>
                  {profile.profilePicture && profile.profilePicture.trim() && (
                    <p className="text-xs text-gray-400 mt-2">Change profile picture</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                  <div className="w-full px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white">
                    {profile.name}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <div className="w-full px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white min-h-[2.5rem]">
                    {profile.status || 'No status'}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                  <div className="w-full px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-gray-400">
                    {profile.phone}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-400">Failed to load profile</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && profile?.profilePicture && profile.profilePicture.trim() && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 p-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={getImageSrc(profile.profilePicture)}
            alt="Profile"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

