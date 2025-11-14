import fs from 'fs';
import path from 'path';

// Use /tmp for serverless environments (like Vercel), otherwise use project data directory
const DATA_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? '/tmp/data'
  : path.join(process.cwd(), 'data');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Lazy initialization - ensure directory and files exist only when needed
function ensureDataDirectory(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (error) {
    // In serverless environments, directory might already exist or creation might fail
    // This is okay - we'll handle file operations gracefully
    console.warn('Could not create data directory:', error);
  }
}

// Initialize files if they don't exist (lazy - called when needed)
function ensureFile(filePath: string, defaultValue: any): void {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
  } catch (error) {
    // In read-only filesystems, we'll work with in-memory data
    console.warn('Could not initialize file:', filePath, error);
  }
}

// User types
export interface User {
  id: string;
  phone: string;
  password: string; // hashed
  name: string;
  status?: string; // User status/bio
  profilePicture?: string; // Base64 encoded image or URL
  createdAt: string;
  updatedAt?: string;
  lastSeen?: string; // ISO timestamp of last activity
}

export interface Contact {
  userId: string;
  contactId: string;
  addedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

// User operations
export function getUsers(): User[] {
  try {
    ensureFile(USERS_FILE, []);
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    if (!data || data.trim() === '') {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

export function getUserByPhone(phone: string): User | undefined {
  const users = getUsers();
  return users.find(u => u.phone === phone);
}

export function getUserById(id: string): User | undefined {
  const users = getUsers();
  return users.find(u => u.id === id);
}

export function createUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: user.status || '',
    profilePicture: user.profilePicture || '',
  };
  users.push(newUser);
  try {
    ensureDataDirectory();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users file:', error);
    // Continue anyway - data is in memory for this request
  }
  return newUser;
}

export function updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'password' | 'phone' | 'createdAt'>>): User | null {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return null;
  }
  
  users[userIndex] = {
    ...users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  try {
    ensureDataDirectory();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing users file:', error);
    // Continue anyway - data is in memory for this request
  }
  console.log('User updated in database. Profile picture:', users[userIndex].profilePicture?.substring(0, 50) + '...');
  return users[userIndex];
}

// Contact operations
export function getContacts(): Record<string, Contact[]> {
  try {
    ensureFile(CONTACTS_FILE, {});
    if (!fs.existsSync(CONTACTS_FILE)) {
      return {};
    }
    const data = fs.readFileSync(CONTACTS_FILE, 'utf-8');
    if (!data || data.trim() === '') {
      return {};
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading contacts file:', error);
    return {};
  }
}

export function getUserContacts(userId: string): Contact[] {
  const contacts = getContacts();
  return contacts[userId] || [];
}

export function addContact(userId: string, contactId: string): void {
  const contacts = getContacts();
  if (!contacts[userId]) {
    contacts[userId] = [];
  }
  
  // Check if contact already exists
  if (!contacts[userId].some(c => c.contactId === contactId)) {
    contacts[userId].push({
      userId,
      contactId,
      addedAt: new Date().toISOString(),
    });
    try {
      ensureDataDirectory();
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    } catch (error) {
      console.error('Error writing contacts file:', error);
      // Continue anyway - data is in memory for this request
    }
  }
}

// Message operations
export function getMessages(): Message[] {
  try {
    ensureFile(MESSAGES_FILE, []);
    if (!fs.existsSync(MESSAGES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    if (!data || data.trim() === '') {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading messages file:', error);
    return [];
  }
}

export function getConversationMessages(userId1: string, userId2: string): Message[] {
  const messages = getMessages();
  return messages.filter(
    m =>
      (m.senderId === userId1 && m.receiverId === userId2) ||
      (m.senderId === userId2 && m.receiverId === userId1)
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function createMessage(message: Omit<Message, 'id' | 'timestamp' | 'read'>): Message {
  const messages = getMessages();
  const newMessage: Message = {
    ...message,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    read: false,
  };
  messages.push(newMessage);
  try {
    ensureDataDirectory();
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('Error writing messages file:', error);
    // Continue anyway - data is in memory for this request
  }
  return newMessage;
}

export function markMessagesAsRead(userId: string, otherUserId: string): void {
  const messages = getMessages();
  const updated = messages.map(m => {
    if (m.senderId === otherUserId && m.receiverId === userId && !m.read) {
      return { ...m, read: true };
    }
    return m;
  });
  try {
    ensureDataDirectory();
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(updated, null, 2));
  } catch (error) {
    console.error('Error writing messages file:', error);
    // Continue anyway - data is in memory for this request
  }
}

