import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { withAuthAndUser } from '@/middleware/auth';

// Upload directory configuration
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed MIME types
const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'application/x-rar-compressed',
  ],
};

function getFileType(mimeType: string): 'image' | 'video' | 'audio' | 'document' | null {
  for (const [type, mimes] of Object.entries(ALLOWED_TYPES)) {
    if (mimes.includes(mimeType)) {
      return type as 'image' | 'video' | 'audio' | 'document';
    }
  }
  return null;
}

function getFileExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext || '.bin';
}

// POST /api/upload - Upload file(s)
export async function POST(request: NextRequest) {
  return withAuthAndUser(request, async (req, user) => {
    try {
      // Ensure upload directory exists
      if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
      }

      const formData = await req.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No files provided' },
          { status: 400 }
        );
      }

      const uploadedFiles: Array<{
        id: string;
        type: 'image' | 'video' | 'audio' | 'document';
        name: string;
        url: string;
        size: number;
        mimeType: string;
      }> = [];

      const errors: string[] = [];

      for (const file of files) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
          continue;
        }

        // Validate file type
        const fileType = getFileType(file.type);
        if (!fileType) {
          errors.push(`${file.name}: File type not allowed`);
          continue;
        }

        // Generate unique filename
        const fileId = uuidv4();
        const extension = getFileExtension(file.name);
        const filename = `${fileId}${extension}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Generate URL
        const fileUrl = `/uploads/${filename}`;

        uploadedFiles.push({
          id: fileId,
          type: fileType,
          name: file.name,
          url: fileUrl,
          size: file.size,
          mimeType: file.type,
        });
      }

      if (uploadedFiles.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No files were uploaded',
            errors,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          files: uploadedFiles,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to upload files' },
        { status: 500 }
      );
    }
  });
}
