import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserById } from '@/lib/data-storage';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'profile-pictures');

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Delete old profile picture if it exists
async function deleteOldProfilePicture(userId: string) {
  try {
    const user = getUserById(userId);
    if (user?.profilePicture && !user.profilePicture.startsWith('data:image/')) {
      // Only delete if it's a file path (not base64)
      const oldFilePath = path.join(process.cwd(), 'public', user.profilePicture);
      if (existsSync(oldFilePath)) {
        await unlink(oldFilePath);
      }
    }
  } catch (error) {
    console.error('Error deleting old profile picture:', error);
    // Don't fail the upload if deletion fails
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Ensure upload directory exists
    await ensureUploadDir();

    // Delete old profile picture if it exists
    await deleteOldProfilePicture(session.user.id);

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const fileName = `${session.user.id}-${Date.now()}${fileExtension}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return relative URL path
    const relativePath = `/uploads/profile-pictures/${fileName}`;
    return NextResponse.json({ url: relativePath });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

