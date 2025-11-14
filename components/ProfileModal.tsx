'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ProfileModal({ isOpen, onClose, onUpdate }: ProfileModalProps) {
  const { data: session, update } = useSession();
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetchProfile();
    }
    
    // Cleanup timeout on unmount or close
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isOpen, session]);

  const fetchProfile = async () => {
    try {
      // Add cache-busting to ensure we get fresh data
      const response = await fetch('/api/profile', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setName(data.name || '');
        setStatus(data.status || '');
        const picture = data.profilePicture || '';
        console.log('Fetched profile picture:', picture ? (picture.startsWith('data:') ? 'base64' : 'file URL: ' + picture) : 'empty');
        setProfilePicture(picture);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('File must be an image');
        return;
      }

      setLoading(true);
      setError('');

      try {
        // Upload file to server
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/upload/profile-picture', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          console.log('Image uploaded successfully, URL:', uploadData.url);
          const newPictureUrl = uploadData.url;
          setProfilePicture(newPictureUrl);
          setError('');
          
          // Automatically save the profile with the new picture
          try {
            const saveResponse = await fetch('/api/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name.trim() || session?.user?.name || '',
                status: status.trim(),
                profilePicture: newPictureUrl,
              }),
            });

            if (saveResponse.ok) {
              const savedData = await saveResponse.json();
              console.log('Profile picture auto-saved successfully');
              
              // Update session if name changed
              if (savedData.name && savedData.name !== session?.user?.name) {
                await update({
                  ...session,
                  user: {
                    ...session?.user,
                    name: savedData.name,
                  },
                });
              }
              
              // Refresh the user profile in ChatInterface
              onUpdate();
            } else {
              const errorData = await saveResponse.json();
              console.error('Failed to auto-save profile picture:', errorData.error);
              setError('Image uploaded but failed to save. Please try saving manually.');
            }
          } catch (saveError) {
            console.error('Error auto-saving profile picture:', saveError);
            setError('Image uploaded but failed to save. Please try saving manually.');
          }
        } else {
          const errorData = await uploadResponse.json();
          setError(errorData.error || 'Failed to upload image');
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        setError('An error occurred while uploading the image');
      } finally {
        setLoading(false);
      }
    }
  };

  const autoSaveProfile = async (nameValue: string, statusValue: string) => {
    if (!nameValue.trim()) {
      return;
    }

    try {
      // Prepare the update payload
      const updateData: any = {
        name: nameValue.trim(),
        status: statusValue.trim(),
      };
      
      // Always include profilePicture, even if empty (to allow clearing)
      updateData.profilePicture = profilePicture || '';

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const data = await response.json();
        const savedPicture = data.profilePicture || '';
        
        // Update local state with the saved data
        setProfilePicture(savedPicture);
        
        // Update session
        await update({
          ...session,
          user: {
            ...session?.user,
            name: data.name,
          },
        });
        
        // Call onUpdate to refresh the user profile in ChatInterface
        onUpdate();
      }
    } catch (error) {
      console.error('Error auto-saving profile:', error);
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
      console.log('Using base64 image');
      return picture;
    }
    // Otherwise, it's a file path/URL
    console.log('Using file URL:', picture);
    return picture;
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-md border border-[#2a2a2a]">
        {/* Header */}
        <div className="p-6 border-b border-[#2a2a2a] flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Edit Profile</h2>
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
          {/* Profile Picture */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <button
                onClick={() => profilePicture && profilePicture.trim() && setShowImageModal(true)}
                className="relative cursor-pointer bg-transparent border-none p-0"
              >
                {profilePicture && profilePicture.trim() ? (
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#2a2a2a]">
                    <img
                      key={profilePicture} // Force re-render when profilePicture changes
                      src={getImageSrc(profilePicture)}
                      alt="Profile"
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                      style={{ 
                        display: 'block', 
                        width: '100%', 
                        height: '100%',
                        objectFit: 'cover',
                        backgroundColor: 'transparent'
                      }}
                      loading="eager"
                      onLoad={(e) => {
                        // Ensure image is visible when loaded
                        const target = e.target as HTMLImageElement;
                        target.style.opacity = '1';
                      }}
                      onError={(e) => {
                        // Fallback if image fails to load
                        console.error('Image failed to load:', getImageSrc(profilePicture));
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-semibold border-4 border-[#2a2a2a]">
                    {getInitials(name || 'U')}
                  </div>
                )}
              </button>
              
              {/* Camera Icon - Bottom Right */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors shadow-lg border-2 border-[#1a1a1a] z-10"
                title="Change Profile Picture"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {profilePicture && profilePicture.trim() ? 'Click picture to view full size' : 'Click the camera icon to upload a profile picture'}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Clear existing timeout
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                }
                // Auto-save after user stops typing (debounce)
                saveTimeoutRef.current = setTimeout(async () => {
                  if (e.target.value.trim()) {
                    await autoSaveProfile(e.target.value.trim(), status.trim());
                  }
                }, 1000);
              }}
              onBlur={async (e) => {
                // Clear timeout on blur and save immediately
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                }
                if (e.target.value.trim()) {
                  await autoSaveProfile(e.target.value.trim(), status.trim());
                }
              }}
              className="w-full px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              placeholder="Your name"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <input
              type="text"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                // Clear existing timeout
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                }
                // Auto-save after user stops typing (debounce)
                saveTimeoutRef.current = setTimeout(async () => {
                  if (name.trim()) {
                    await autoSaveProfile(name.trim(), e.target.value.trim());
                  }
                }, 1000);
              }}
              onBlur={async (e) => {
                // Clear timeout on blur and save immediately
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                }
                if (name.trim()) {
                  await autoSaveProfile(name.trim(), e.target.value.trim());
                }
              }}
              className="w-full px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              placeholder="What's on your mind?"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">{status.length}/100</p>
          </div>

          {/* Phone (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
            <input
              type="text"
              value={session?.user?.phone || ''}
              disabled
              className="w-full px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Phone number cannot be changed</p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && profilePicture && profilePicture.trim() && (
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
            src={getImageSrc(profilePicture)}
            alt="Profile"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
    </>
  );
}
