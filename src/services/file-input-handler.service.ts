import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
    InputEnvelope,
    InputContent,
    InputFile,
    InputError,
    AssetContext,
    DEFAULT_INPUT_AGENT_CONFIG,
} from '../types/input-agent';
import { envelopeGeneratorService } from './envelope-generator.service';
import { auditLoggerService } from './audit-logger.service';

/**
 * File Input Handler Service - Phase 1
 * Processes document/file uploads and metadata extraction
 */

export interface ProcessedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    checksum: string;
    extracted_text?: string;
    metadata: Record<string, any>;
}

export class FileInputHandlerService {
    private config = DEFAULT_INPUT_AGENT_CONFIG;

    /**
     * Process file upload and generate envelope
     */
    async processFileUpload(params: {
        user_id: string;
        session_id: string;
        files: {
            buffer: Buffer;
            originalname: string;
            mimetype: string;
            size: number;
        }[];
        asset_context?: AssetContext[];
        client_info?: {
            user_agent?: string;
            ip_address?: string;
        };
    }): Promise<{ success: boolean; envelope?: InputEnvelope; error?: InputError }> {
        const startTime = Date.now();

        try {
            // ===== REAL-TIME CONSOLE LOG =====
            console.log('\n' + '='.repeat(60));
            console.log('📁 INPUT AGENT - FILE UPLOAD RECEIVED');
            console.log('='.repeat(60));
            console.log(`👤 User ID: ${params.user_id}`);
            console.log(`🔗 Session: ${params.session_id}`);
            console.log(`📂 Files: ${params.files.length}`);
            params.files.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB) - ${file.mimetype}`);
            });
            console.log(`📅 Time: ${new Date().toLocaleString()}`);
            console.log('='.repeat(60));

            // Validate files
            const validationResult = await this.validateFiles(params.files);
            if (!validationResult.valid) {
                console.log('❌ File validation failed');
                return {
                    success: false,
                    error: validationResult.error,
                };
            }

            // Process each file
            const processedFiles: InputFile[] = [];

            for (const file of params.files) {
                const processed = await this.processFile(file);
                if (processed) {
                    processedFiles.push(processed);

                    // Log file upload
                    await auditLoggerService.logFileEvent({
                        user_id: params.user_id,
                        session_id: params.session_id,
                        action: 'file_uploaded',
                        metadata: {
                            file_name: file.originalname,
                            file_type: file.mimetype,
                            file_size: file.size,
                        },
                    });
                }
            }

            // Build content
            const content: InputContent = {
                files: processedFiles,
                asset_context: params.asset_context,
            };

            // Generate envelope
            const envelope = await envelopeGeneratorService.generateEnvelope({
                user_id: params.user_id,
                session_id: params.session_id,
                input_type: 'file',
                content,
                metadata: {
                    voice_mode_active: false,
                    interaction_method: 'upload',
                },
                client_info: params.client_info,
            });

            // Update processing time
            const processingTime = Date.now() - startTime;
            envelope.metadata.processing_time_ms = processingTime;

            // Save envelope
            await envelopeGeneratorService.saveEnvelope(envelope);
            await envelopeGeneratorService.updateEnvelopeStatus(envelope.envelope_id, 'completed');

            console.log(`✅ Files processed successfully in ${processingTime}ms`);
            console.log(`📦 Envelope ID: ${envelope.envelope_id}\n`);

            return { success: true, envelope };
        } catch (error) {
            console.error('Error processing file upload:', error);

            const inputError: InputError = {
                code: 'FILE_CORRUPTED',
                message: error instanceof Error ? error.message : 'Failed to process file upload',
                recoverable: true,
                fallback_action: 'Please try uploading again',
            };

            await auditLoggerService.logError({
                user_id: params.user_id,
                session_id: params.session_id,
                error_code: inputError.code,
                error_message: inputError.message,
                input_type: 'file',
            });

            return { success: false, error: inputError };
        }
    }

    /**
     * Validate files before processing
     */
    private async validateFiles(files: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    }[]): Promise<{ valid: boolean; error?: InputError }> {
        // Check file count
        if (files.length > this.config.max_files_per_conversation) {
            return {
                valid: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: `Maximum ${this.config.max_files_per_conversation} files allowed per conversation`,
                    recoverable: true,
                    fallback_action: 'Please reduce the number of files',
                },
            };
        }

        for (const file of files) {
            // Check file size
            if (file.size > this.config.max_file_size_bytes) {
                return {
                    valid: false,
                    error: {
                        code: 'FILE_TOO_LARGE',
                        message: `File "${file.originalname}" exceeds maximum size of ${this.config.max_file_size_bytes / (1024 * 1024)}MB`,
                        recoverable: true,
                        fallback_action: 'Please compress or split the file',
                        details: { file_name: file.originalname, file_size: file.size },
                    },
                };
            }

            // Check file type
            if (!this.config.supported_file_types.includes(file.mimetype)) {
                return {
                    valid: false,
                    error: {
                        code: 'UNSUPPORTED_FORMAT',
                        message: `File type "${file.mimetype}" is not supported`,
                        recoverable: true,
                        fallback_action: 'Supported formats: PDF, Word, Excel, CSV, TXT, and images',
                        details: {
                            file_name: file.originalname,
                            file_type: file.mimetype,
                            supported_types: this.config.supported_file_types,
                        },
                    },
                };
            }

            // Validate checksum (basic corruption check)
            if (!this.validateChecksum(file.buffer)) {
                return {
                    valid: false,
                    error: {
                        code: 'FILE_CORRUPTED',
                        message: `File "${file.originalname}" appears to be corrupted`,
                        recoverable: true,
                        fallback_action: 'Please re-upload the file',
                    },
                };
            }
        }

        return { valid: true };
    }

    /**
     * Process individual file
     */
    private async processFile(file: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    }): Promise<InputFile> {
        const fileId = uuidv4();
        const checksum = this.calculateChecksum(file.buffer);

        // Generate file URL (placeholder - would be actual storage URL)
        const url = await this.uploadToStorage(fileId, file.buffer, file.mimetype);

        // Extract text content based on file type
        let extracted_text: string | undefined;
        const metadata: Record<string, any> = {};

        if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
            extracted_text = file.buffer.toString('utf-8');
        } else if (file.mimetype === 'application/pdf') {
            // PDF text extraction would happen here
            metadata.requires_ocr = false;
            // extracted_text = await this.extractPdfText(file.buffer);
        } else if (file.mimetype.startsWith('image/')) {
            // Image OCR would happen here
            metadata.requires_ocr = true;
            metadata.dimensions = await this.getImageDimensions(file.buffer);
        }

        return {
            id: fileId,
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            url,
            checksum,
            extracted_text,
            metadata,
        };
    }

    /**
     * Calculate file checksum
     */
    private calculateChecksum(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Validate checksum (basic check)
     */
    private validateChecksum(buffer: Buffer): boolean {
        // Basic validation - check if buffer is not empty and has valid content
        if (!buffer || buffer.length === 0) {
            return false;
        }
        return true;
    }

    /**
     * Upload file to storage (placeholder)
     */
    private async uploadToStorage(
        fileId: string,
        buffer: Buffer,
        mimetype: string
    ): Promise<string> {
        // TODO: Integrate with actual file storage (AWS S3, GCS, Azure Blob, etc.)
        // For now, return a placeholder URL
        // In production, implement:
        // 1. AES-256 encryption before upload
        // 2. Secure URL generation
        // 3. Access control policies

        const baseUrl = process.env.FILE_STORAGE_URL || 'http://localhost:3001/uploads';
        return `${baseUrl}/${fileId}`;
    }

    /**
     * Get image dimensions (placeholder)
     */
    private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
        // TODO: Use sharp or similar library to get actual dimensions
        return null;
    }

    /**
     * Extract text from PDF (placeholder)
     */
    private async extractPdfText(buffer: Buffer): Promise<string | null> {
        // TODO: Integrate with pdf-parse or similar library
        return null;
    }

    /**
     * Get supported file types
     */
    getSupportedFileTypes(): string[] {
        return this.config.supported_file_types;
    }

    /**
     * Get max file size
     */
    getMaxFileSize(): number {
        return this.config.max_file_size_bytes;
    }
}

export const fileInputHandlerService = new FileInputHandlerService();
