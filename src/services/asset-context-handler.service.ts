import { v4 as uuidv4 } from 'uuid';
import {
    AssetContext,
    InputError,
    DEFAULT_INPUT_AGENT_CONFIG,
} from '../types/input-agent';
import { auditLoggerService } from './audit-logger.service';

/**
 * Asset Context Handler Service - Phase 1
 * Manages selected asset data integration
 */

export interface AssetData {
    asset_id: string;
    name: string;
    type: string;
    data: Record<string, any>;
    permissions: string[];
    last_updated: Date;
}

export class AssetContextHandlerService {
    private config = DEFAULT_INPUT_AGENT_CONFIG;
    private assetCache: Map<string, { data: AssetData; expires_at: Date }> = new Map();
    private cacheTTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Load asset context from user selection
     */
    async loadAssetContext(params: {
        user_id: string;
        session_id: string;
        asset_ids: string[];
    }): Promise<{ success: boolean; contexts: AssetContext[]; errors: InputError[] }> {
        const contexts: AssetContext[] = [];
        const errors: InputError[] = [];

        for (const asset_id of params.asset_ids) {
            try {
                const result = await this.getAssetData(asset_id, params.user_id);

                if (result.success && result.asset) {
                    const context: AssetContext = {
                        asset_id: result.asset.asset_id,
                        data_item: JSON.stringify(result.asset.data),
                        metadata: {
                            name: result.asset.name,
                            type: result.asset.type,
                            permissions: result.asset.permissions,
                        },
                        last_updated: result.asset.last_updated.toISOString(),
                    };

                    contexts.push(context);

                    await auditLoggerService.logAssetEvent({
                        user_id: params.user_id,
                        session_id: params.session_id,
                        action: 'asset_context_loaded',
                        metadata: { asset_id, asset_type: result.asset.type },
                    });
                } else if (result.error) {
                    errors.push(result.error);
                }
            } catch (error) {
                errors.push({
                    code: 'ASSET_CONNECTION_FAILURE',
                    message: `Failed to load asset ${asset_id}`,
                    recoverable: true,
                    fallback_action: 'Asset data will be excluded from context',
                });
            }
        }

        return {
            success: errors.length === 0,
            contexts,
            errors,
        };
    }

    /**
     * Get asset data with caching
     */
    private async getAssetData(
        asset_id: string,
        user_id: string
    ): Promise<{ success: boolean; asset?: AssetData; error?: InputError }> {
        // Check cache first
        const cached = this.assetCache.get(asset_id);
        if (cached && cached.expires_at > new Date()) {
            return { success: true, asset: cached.data };
        }

        try {
            // Check user permissions
            const hasPermission = await this.checkAssetPermission(asset_id, user_id);
            if (!hasPermission) {
                return {
                    success: false,
                    error: {
                        code: 'ASSET_PERMISSION_DENIED',
                        message: 'You do not have permission to access this asset',
                        recoverable: false,
                        fallback_action: 'Request access from the asset owner',
                    },
                };
            }

            // Fetch asset data
            const asset = await this.fetchAssetData(asset_id);
            if (!asset) {
                return {
                    success: false,
                    error: {
                        code: 'ASSET_CONNECTION_FAILURE',
                        message: 'Asset not found',
                        recoverable: false,
                    },
                };
            }

            // Cache the result
            this.assetCache.set(asset_id, {
                data: asset,
                expires_at: new Date(Date.now() + this.cacheTTL),
            });

            return { success: true, asset };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'ASSET_CONNECTION_FAILURE',
                    message: 'Failed to connect to asset service',
                    recoverable: true,
                    fallback_action: 'Retrying with exponential backoff',
                },
            };
        }
    }

    /**
     * Check if user has permission to access asset
     * Placeholder - integrate with actual permission system
     */
    private async checkAssetPermission(asset_id: string, user_id: string): Promise<boolean> {
        // TODO: Integrate with actual permission/authorization system
        // For now, return true (allow all)
        return true;
    }

    /**
     * Fetch asset data from source
     * Placeholder - integrate with actual asset service
     */
    private async fetchAssetData(asset_id: string): Promise<AssetData | null> {
        // TODO: Integrate with actual asset/enterprise data service
        // This could be:
        // 1. Internal database
        // 2. External API
        // 3. Data warehouse connection
        // 4. File system

        // Placeholder implementation
        return {
            asset_id,
            name: `Asset ${asset_id}`,
            type: 'document',
            data: {},
            permissions: ['read'],
            last_updated: new Date(),
        };
    }

    /**
     * Retry with exponential backoff
     */
    async retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxRetries = this.config.retry_config.max_retries,
        initialDelay = this.config.retry_config.initial_delay_ms
    ): Promise<T> {
        let lastError: Error | null = null;
        let delay = initialDelay;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= this.config.retry_config.backoff_multiplier;
                }
            }
        }

        throw lastError || new Error('Operation failed after max retries');
    }

    /**
     * Clear asset cache
     */
    clearCache(asset_id?: string): void {
        if (asset_id) {
            this.assetCache.delete(asset_id);
        } else {
            this.assetCache.clear();
        }
    }

    /**
     * Validate asset context data
     */
    validateAssetContext(contexts: AssetContext[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const context of contexts) {
            if (!context.asset_id) {
                errors.push('Asset ID is required');
            }
            if (!context.data_item) {
                errors.push(`Asset ${context.asset_id}: data_item is required`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

export const assetContextHandlerService = new AssetContextHandlerService();
