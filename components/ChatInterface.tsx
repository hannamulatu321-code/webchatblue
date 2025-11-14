'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ProfileModal from './ProfileModal';
import ViewProfileModal from './ViewProfileModal';

interface Contact {
  id: string;
  name: string;
  phone: string;
  status?: string;
  profilePicture?: string;
  addedAt: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

interface User {
  id: string;
  name: string;
  phone: string;
}

export default function ChatInterface() {
  const { data: session } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [addContactError, setAddContactError] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showViewProfileModal, setShowViewProfileModal] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'contacts'>('messages');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!session) {
      router.push('/auth/signin');
    }
  }, [session, router]);

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  // Fetch messages for selected contact
  const fetchMessages = async (contactId: string) => {
    try {
      const response = await fetch(`/api/messages?userId=${contactId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Search users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Add contact by user ID
  const handleAddContact = async (userId: string) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: userId }),
      });

      if (response.ok) {
        await fetchContacts();
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
      }
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  // Add contact by phone number and name
  const handleAddContactByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !contactName.trim()) {
      setAddContactError('Please enter both phone number and name');
      return;
    }

    setAddingContact(true);
    setAddContactError('');

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phoneNumber.trim(),
          name: contactName.trim()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchContacts();
        setPhoneNumber('');
        setContactName('');
        setShowAddContactModal(false);
        setAddContactError('');
        // Optionally select the newly added contact
        if (data.contact) {
          const newContact = {
            id: data.contact.id,
            name: data.contact.name,
            phone: data.contact.phone,
            status: data.contact.status || '',
            profilePicture: data.contact.profilePicture || '',
            addedAt: new Date().toISOString(),
          };
          setSelectedContact(newContact);
        }
      } else {
        const data = await response.json();
        setAddContactError(data.error || 'Failed to add contact');
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      setAddContactError('An error occurred while adding contact');
    } finally {
      setAddingContact(false);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedContact || !session?.user?.id) return;

    setLoading(true);
    try {
      // Update online status when sending a message
      await updateOnlineStatus();
      
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedContact.id,
          content: messageInput,
        }),
      });

      if (response.ok) {
        setMessageInput('');
        await fetchMessages(selectedContact.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load contacts and profile on mount
  useEffect(() => {
    if (session) {
      fetchContacts();
      fetchUserProfile();
      // Initial heartbeat
      updateOnlineStatus();
      
      // Set up heartbeat to update online status every 30 seconds
      heartbeatIntervalRef.current = setInterval(() => {
        updateOnlineStatus();
      }, 30000);
      
      // Set up status polling to check contacts' online status every 10 seconds
      statusIntervalRef.current = setInterval(() => {
        fetchContactsStatus();
      }, 10000);
      
      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
        }
      };
    }
  }, [session]);

  // Fetch contacts status when contacts change
  useEffect(() => {
    if (contacts.length > 0) {
      fetchContactsStatus();
    }
  }, [contacts.length]);

  // Function to open view profile modal
  const handleViewProfile = (userId: string) => {
    setViewProfileUserId(userId);
    setShowViewProfileModal(true);
  };

  // Fetch user profile
  const fetchUserProfile = async () => {
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
        console.log('Fetched user profile. Profile picture:', data.profilePicture ? (data.profilePicture.startsWith('data:') ? 'base64' : 'file URL: ' + data.profilePicture) : 'empty');
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Update current user's online status (heartbeat)
  const updateOnlineStatus = async () => {
    try {
      await fetch('/api/users/status', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  // Fetch online status for contacts
  const fetchContactsStatus = async () => {
    if (contacts.length === 0) return;
    
    try {
      const userIds = contacts.map(c => c.id).join(',');
      const response = await fetch(`/api/users/status?userIds=${userIds}`);
      if (response.ok) {
        const statusMap = await response.json();
        // Update contacts with online status
        setContacts(prevContacts => 
          prevContacts.map(contact => ({
            ...contact,
            isOnline: statusMap[contact.id]?.isOnline || false,
            lastSeen: statusMap[contact.id]?.lastSeen,
          }))
        );
        // Update selected contact if it exists
        if (selectedContact) {
          const contactStatus = statusMap[selectedContact.id];
          if (contactStatus) {
            setSelectedContact(prev => prev ? {
              ...prev,
              isOnline: contactStatus.isOnline,
              lastSeen: contactStatus.lastSeen,
            } : null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching contacts status:', error);
    }
  };

  // Load messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact]);

  // Polling for new messages
  useEffect(() => {
    if (selectedContact && session) {
      pollIntervalRef.current = setInterval(() => {
        fetchMessages(selectedContact.id);
      }, 2000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [selectedContact, session]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus message input and scroll to chat when contact is selected
  useEffect(() => {
    if (selectedContact) {
      // Small delay to ensure the chat area is rendered
      setTimeout(() => {
        // Scroll to chat area smoothly
        chatAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Focus message input after a brief delay
        setTimeout(() => {
          messageInputRef.current?.focus();
        }, 200);
      }, 150);
    }
  }, [selectedContact]);

  // Handle search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Format last seen timestamp
  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return lastSeenDate.toLocaleDateString();
  };

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach((message) => {
      const date = new Date(message.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey: string;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    return groups;
  };

  if (!session) {
    return null;
  }

  const messageGroups = groupMessagesByDate(messages);
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

  // Calculate unread counts for each contact
  const getUnreadCount = (contactId: string) => {
    return messages.filter(
      (m) => m.receiverId === session?.user?.id && m.senderId === contactId && !m.read
    ).length;
  };

  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-green-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <span className="text-black font-semibold text-xl">Blue+Me</span>
        </div>

        {/* Right Icons */}
        <div className="flex items-center gap-4">
          {/* Notification Button */}
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Notifications"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Profile Button */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex-shrink-0"
          >
            {userProfile?.profilePicture && userProfile.profilePicture.trim() ? (
              <img
                src={getImageSrc(userProfile.profilePicture)}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 hover:border-green-600 transition-colors"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center text-sm font-semibold text-white">
                {getInitials(session.user?.name || 'U')}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Messages */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Tabs */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-gray-50">
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'messages'
                  ? 'bg-green-700 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-green-700 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Contacts
            </button>
          </div>

          {/* Messages Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-black">
              {activeTab === 'messages' ? 'Messages' : 'Contacts'}
            </h2>
            <button 
              onClick={() => {
                setShowSearch(!showSearch);
                if (!showSearch) {
                  setSearchQuery('');
                  setSearchResults([]);
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Search Interface */}
          {showSearch && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for users to add..."
                  className="w-full px-4 py-2 pl-10 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                  autoFocus
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-2.5 p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.phone}</p>
                  </div>
                  <button
                    onClick={() => handleAddContact(user.id)}
                        className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
              {searchQuery && searchResults.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No users found</p>
              )}
        </div>
          )}

          {/* Filter Tabs - Only show for Messages tab */}
          {activeTab === 'messages' && (
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-4 overflow-x-auto">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                All messages
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeFilter === 'unread'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setActiveFilter('favorites')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeFilter === 'favorites'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Favorites
              </button>
            </div>
          )}

          {/* Action Buttons - Above the list */}
          <div className="px-6 py-3 border-b border-gray-200">
            {activeTab === 'messages' ? (
              <button
                onClick={() => {
                  setShowSearch(true);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="w-full px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Message
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowAddContactModal(true);
                  setPhoneNumber('');
                  setContactName('');
                  setAddContactError('');
                }}
                className="w-full px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Contact
              </button>
            )}
          </div>

          {/* Contact/Message List */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'messages' ? (
              // Messages Tab - Show contacts with messages
              contacts.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  No contacts yet. Add a contact to start chatting!
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {contacts.map((contact) => {
                    const lastMessage = messages
                      .filter((m) => (m.senderId === contact.id || m.receiverId === contact.id))
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                    const isSelected = selectedContact?.id === contact.id;
                    const unreadCount = getUnreadCount(contact.id);

                    return (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          // Ensure chat area is visible and focused
                          setTimeout(() => {
                            chatAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            messageInputRef.current?.focus();
                          }, 100);
                        }}
                        className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProfile(contact.id);
                            }}
                            className="flex-shrink-0 relative"
                          >
                            {contact.profilePicture && contact.profilePicture.trim() ? (
                              <img
                                src={getImageSrc(contact.profilePicture)}
                                alt={contact.name}
                                className="w-12 h-12 rounded-full object-cover hover:opacity-80 transition-opacity"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-sm font-semibold text-white">
                                {getInitials(contact.name)}
                              </div>
                            )}
                            {/* Online status indicator */}
                            {contact.isOnline && (
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-black truncate">{contact.name}</p>
                              {lastMessage && (
                                <div className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                  {new Date(lastMessage.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}
                            </div>
                            {lastMessage ? (
                              <p className="text-xs text-gray-600 truncate">
                                {lastMessage.content.length > 40
                                  ? lastMessage.content.substring(0, 40) + '...'
                                  : lastMessage.content}
                              </p>
                            ) : contact.status ? (
                              <p className="text-xs text-gray-600 truncate">{contact.status}</p>
                            ) : null}
                          </div>
                          {unreadCount > 0 && (
                            <div className="flex-shrink-0 w-6 h-6 bg-green-700 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-white">{unreadCount}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              // Contacts Tab - Show simple contact list
              contacts.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  No contacts yet. Add a contact to start chatting!
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {contacts.map((contact) => {
                    return (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setActiveTab('messages'); // Switch to messages tab when contact is selected
                          // Ensure chat area is visible and focused
                          setTimeout(() => {
                            chatAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            messageInputRef.current?.focus();
                          }, 100);
                        }}
                        className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProfile(contact.id);
                            }}
                            className="flex-shrink-0 relative"
                          >
                            {contact.profilePicture && contact.profilePicture.trim() ? (
                              <img
                                src={getImageSrc(contact.profilePicture)}
                                alt={contact.name}
                                className="w-12 h-12 rounded-full object-cover hover:opacity-80 transition-opacity"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-sm font-semibold text-white">
                                {getInitials(contact.name)}
                              </div>
                            )}
                            {/* Online status indicator */}
                            {contact.isOnline && (
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-black truncate">{contact.name}</p>
                            {contact.status ? (
                              <p className="text-xs text-gray-600 truncate mt-1">{contact.status}</p>
                            ) : (
                              <p className="text-xs text-gray-500 truncate mt-1">{contact.phone}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
      </div>

      {/* Main Chat Area */}
        <div ref={chatAreaRef} className="flex-1 flex flex-col bg-gray-50">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleViewProfile(selectedContact.id)}
                  className="flex-shrink-0"
                >
                  <div className="relative">
                    {selectedContact.profilePicture && selectedContact.profilePicture.trim() ? (
                      <img
                        src={getImageSrc(selectedContact.profilePicture)}
                        alt={selectedContact.name}
                        className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-sm font-semibold text-white">
                        {getInitials(selectedContact.name)}
                      </div>
                    )}
                    {/* Online status indicator */}
                    {selectedContact.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                </button>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedContact.name}</h3>
                  <p className={`text-xs ${selectedContact.isOnline ? 'text-green-700' : 'text-gray-500'}`}>
                    {selectedContact.isOnline ? 'Online' : selectedContact.lastSeen ? `Last seen ${formatLastSeen(selectedContact.lastSeen)}` : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedContact.phone) {
                      window.location.href = `tel:${selectedContact.phone}`;
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Call"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              {Object.entries(messageGroups).map(([dateKey, dateMessages]) => (
                <div key={dateKey}>
                  <div className="text-center mb-4">
                    <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">{dateKey}</span>
                  </div>
                  {dateMessages.map((message) => {
                    const isOwn = message.senderId === session.user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
                      >
                        <div className={`max-w-md ${isOwn ? 'flex flex-col items-end' : ''}`}>
                          <div
                            className={`px-4 py-2 rounded-lg ${
                              isOwn
                                ? 'bg-gray-200 text-gray-900'
                                : 'bg-green-700 text-white'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {new Date(message.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isOwn && message.read && (
                              <svg className="w-4 h-4 text-green-700" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type your message"
                  className="flex-1 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-600 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={loading || !messageInput.trim()}
                  className="p-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="w-32 h-32 bg-green-700 rounded-2xl transform rotate-12 opacity-80"></div>
                    <div className="w-32 h-32 bg-green-600 rounded-2xl transform -rotate-12 absolute top-0 left-0 opacity-90"></div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-2">No conversation selected</p>
                <p className="text-sm text-gray-600">You can view your conversation in the side bar</p>
            </div>
          </div>
        )}
          </div>
      </div>


      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onUpdate={() => {
          fetchUserProfile();
          // Refresh contacts to show updated profile info
          fetchContacts();
        }}
      />

      {/* View Profile Modal */}
      {viewProfileUserId && (
        <ViewProfileModal
          isOpen={showViewProfileModal}
          onClose={() => {
            setShowViewProfileModal(false);
            setViewProfileUserId(null);
          }}
          userId={viewProfileUserId}
        />
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md border border-gray-200 shadow-xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add New Contact</h2>
              <button
                onClick={() => {
                  setShowAddContactModal(false);
                  setPhoneNumber('');
                  setContactName('');
                  setAddContactError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleAddContactByPhone} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                    setAddContactError('');
                  }}
                  placeholder="Enter contact name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setAddContactError('');
                  }}
                  placeholder="Enter phone number (10-15 digits)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If the user doesn't exist, they will be created automatically.
                </p>
              </div>

              {addContactError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {addContactError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddContactModal(false);
                    setPhoneNumber('');
                    setContactName('');
                    setAddContactError('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingContact || !phoneNumber.trim() || !contactName.trim()}
                  className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {addingContact ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
