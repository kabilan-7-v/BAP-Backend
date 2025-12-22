import { v4 as uuidv4 } from 'uuid';
import AuditLog from '../models/AuditLog';
import { InputType } from '../types/input-agent';

/**
 * Audit Logger Service - Phase 1
 * Records all input activities for compliance and analytics
 */

type AuditAction =
    | 'input_received'
    | 'processing_started'
    | 'processing_completed'
    | 'processing_failed'
    | 'sent_to_planner'
    | 'voice_stream_started'
    | 'voice_stream_ended'
    | 'file_uploaded'
    | 'file_processed'
    | 'asset_context_loaded'
    | 'error_occurred'
    | 'retry_attempted';

type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

interface AuditLogParams {
    user_id: string;
    session_id: string;
    envelope_id?: string;
    action: AuditAction;
    input_type?: InputType;
    metadata?: Record<string, any>;
    severity?: AuditSeverity;
}

export class AuditLoggerService {
    /**
     * Log a general audit event
     */
    async log(params: AuditLogParams): Promise<void> {
        try {
            const auditLog = new AuditLog({
                audit_id: uuidv4(),
                timestamp: new Date(),
                user_id: params.user_id,
                session_id: params.session_id,
                envelope_id: params.envelope_id,
                action: params.action,
                input_type: params.input_type,
                metadata: params.metadata || {},
                severity: params.severity || 'info',
            });

            await auditLog.save();
        } catch (error) {
            // Don't throw - logging failures shouldn't break the main flow
            console.error('Failed to save audit log:', error);
        }
    }

    /**
     * Log error event
     */
    async logError(params: {
        user_id: string;
        session_id: string;
        envelope_id?: string;
        error_code: string;
        error_message: string;
        input_type?: InputType;
        metadata?: Record<string, any>;
    }): Promise<void> {
        await this.log({
            user_id: params.user_id,
            session_id: params.session_id,
            envelope_id: params.envelope_id,
            action: 'error_occurred',
            input_type: params.input_type,
            metadata: {
                error_code: params.error_code,
                error_message: params.error_message,
                ...params.metadata,
            },
            severity: 'error',
        });
    }

    /**
     * Log voice-related event
     */
    async logVoiceEvent(params: {
        user_id: string;
        session_id: string;
        envelope_id?: string;
        action: 'voice_stream_started' | 'voice_stream_ended';
        metadata?: Record<string, any>;
    }): Promise<void> {
        await this.log({
            user_id: params.user_id,
            session_id: params.session_id,
            envelope_id: params.envelope_id,
            action: params.action,
            input_type: 'voice',
            metadata: params.metadata,
            severity: 'info',
        });
    }

    /**
     * Log file-related event
     */
    async logFileEvent(params: {
        user_id: string;
        session_id: string;
        envelope_id?: string;
        action: 'file_uploaded' | 'file_processed';
        metadata?: Record<string, any>;
    }): Promise<void> {
        await this.log({
            user_id: params.user_id,
            session_id: params.session_id,
            envelope_id: params.envelope_id,
            action: params.action,
            input_type: 'file',
            metadata: params.metadata,
            severity: 'info',
        });
    }

    /**
     * Log asset context event
     */
    async logAssetEvent(params: {
        user_id: string;
        session_id: string;
        envelope_id?: string;
        action: 'asset_context_loaded';
        metadata?: Record<string, any>;
    }): Promise<void> {
        await this.log({
            user_id: params.user_id,
            session_id: params.session_id,
            envelope_id: params.envelope_id,
            action: params.action,
            metadata: params.metadata,
            severity: 'info',
        });
    }

    /**
     * Log retry attempt
     */
    async logRetry(params: {
        user_id: string;
        session_id: string;
        envelope_id?: string;
        attempt_number: number;
        reason: string;
        input_type?: InputType;
    }): Promise<void> {
        await this.log({
            user_id: params.user_id,
            session_id: params.session_id,
            envelope_id: params.envelope_id,
            action: 'retry_attempted',
            input_type: params.input_type,
            metadata: {
                attempt_number: params.attempt_number,
                reason: params.reason,
            },
            severity: 'warning',
        });
    }

    /**
     * Get audit logs by session
     */
    async getLogsBySession(session_id: string, limit = 100): Promise<any[]> {
        return AuditLog.find({ session_id })
            .sort({ timestamp: -1 })
            .limit(limit)
            .exec();
    }

    /**
     * Get audit logs by user
     */
    async getLogsByUser(user_id: string, limit = 100): Promise<any[]> {
        return AuditLog.find({ user_id })
            .sort({ timestamp: -1 })
            .limit(limit)
            .exec();
    }

    /**
     * Get audit logs by envelope
     */
    async getLogsByEnvelope(envelope_id: string): Promise<any[]> {
        return AuditLog.find({ envelope_id })
            .sort({ timestamp: 1 })
            .exec();
    }

    /**
     * Get error logs
     */
    async getErrorLogs(params: {
        user_id?: string;
        session_id?: string;
        start_date?: Date;
        end_date?: Date;
        limit?: number;
    }): Promise<any[]> {
        const query: any = { severity: { $in: ['error', 'critical'] } };

        if (params.user_id) query.user_id = params.user_id;
        if (params.session_id) query.session_id = params.session_id;
        if (params.start_date || params.end_date) {
            query.timestamp = {};
            if (params.start_date) query.timestamp.$gte = params.start_date;
            if (params.end_date) query.timestamp.$lte = params.end_date;
        }

        return AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(params.limit || 100)
            .exec();
    }

    /**
     * Get analytics summary
     */
    async getAnalyticsSummary(params: {
        user_id?: string;
        start_date: Date;
        end_date: Date;
    }): Promise<{
        total_inputs: number;
        by_type: Record<string, number>;
        errors_count: number;
        avg_processing_time_ms?: number;
    }> {
        const matchQuery: any = {
            timestamp: { $gte: params.start_date, $lte: params.end_date },
        };

        if (params.user_id) {
            matchQuery.user_id = params.user_id;
        }

        const results = await AuditLog.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$input_type',
                    count: { $sum: 1 },
                    errors: {
                        $sum: { $cond: [{ $in: ['$severity', ['error', 'critical']] }, 1, 0] },
                    },
                    avg_processing_time: { $avg: '$metadata.processing_time_ms' },
                },
            },
        ]);

        const by_type: Record<string, number> = {};
        let total_inputs = 0;
        let errors_count = 0;
        let total_processing_time = 0;
        let processing_time_count = 0;

        for (const result of results) {
            if (result._id) {
                by_type[result._id] = result.count;
            }
            total_inputs += result.count;
            errors_count += result.errors;
            if (result.avg_processing_time) {
                total_processing_time += result.avg_processing_time * result.count;
                processing_time_count += result.count;
            }
        }

        return {
            total_inputs,
            by_type,
            errors_count,
            avg_processing_time_ms: processing_time_count > 0
                ? total_processing_time / processing_time_count
                : undefined,
        };
    }
}

export const auditLoggerService = new AuditLoggerService();
