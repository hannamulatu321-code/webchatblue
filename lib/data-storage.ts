import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Initialize files if they don't exist
function ensureFile(filePath: string, defaultValue: any) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

ensureFile(USERS_FILE, []);
ensureFile(CONTACTS_FILE, {});
ensureFile(MESSAGES_FILE, []);

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
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
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
  
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  console.log('User updated in database. Profile picture:', users[userIndex].profilePicture?.substring(0, 50) + '...');
  return users[userIndex];
}

// Contact operations
export function getContacts(): Record<string, Contact[]> {
  const data = fs.readFileSync(CONTACTS_FILE, 'utf-8');
  return JSON.parse(data);
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
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  }
}

// Message operations
export function getMessages(): Message[] {
  const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
  return JSON.parse(data);
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
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
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
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(updated, null, 2));
}

