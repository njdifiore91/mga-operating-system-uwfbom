/**
 * @file Analytics Controller implementation for MGA Operating System
 * @version 1.0.0
 * 
 * Provides RESTful endpoints for analytics, metrics, and business intelligence
 * with support for caching, monitoring, and performance optimization.
 */

import { Request, Response } from 'express'; // v4.18.2
import moment from 'moment'; // v2.29.4
import { CacheManager } from 'cache-manager'; // v5.2.0
import { AnalyticsService } from '../../services/AnalyticsService';
import { MetricsManager } from '../../utils/metrics';
import { error, info } from '../../utils/logger';

/**
 * Controller handling analytics endpoints with performance optimization
 * and monitoring integration for the MGA Operating System platform.
 */
export class AnalyticsController {
    private readonly CACHE_TTL = 300; // 5 minutes cache duration
    private readonly DEFAULT_PAGE_SIZE = 50;

    constructor(
        private readonly analyticsService: AnalyticsService,
        private readonly metricsManager: MetricsManager,
        private readonly cacheManager: CacheManager
    ) {
        info('Analytics Controller initialized');
    }

    /**
     * Retrieves policy-related metrics and KPIs with caching support
     */
    public async getPolicyMetrics = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        try {
            // Parse and validate date range parameters
            const endDate = moment(req.query.endDate as string || moment()).toDate();
            const startDate = moment(req.query.startDate as string || moment().subtract(30, 'days')).toDate();

            // Generate cache key based on parameters
            const cacheKey = `policy_metrics_${startDate.getTime()}_${endDate.getTime()}`;

            // Check cache first
            const cachedMetrics = await this.cacheManager.get(cacheKey);
            if (cachedMetrics) {
                this.recordMetrics('getPolicyMetrics', startTime, req, true);
                res.json(cachedMetrics);
                return;
            }

            // Generate fresh metrics
            const metrics = await this.analyticsService.generatePolicyMetrics(
                startDate,
                endDate,
                { detailed: req.query.detailed === 'true' }
            );

            // Cache the results
            await this.cacheManager.set(cacheKey, metrics, this.CACHE_TTL);

            this.recordMetrics('getPolicyMetrics', startTime, req, false);
            res.json(metrics);
        } catch (err) {
            error('Failed to retrieve policy metrics', err);
            this.recordError('getPolicyMetrics', err);
            res.status(500).json({ error: 'Failed to retrieve policy metrics' });
        }
    };

    /**
     * Retrieves claims analytics with trend analysis and caching
     */
    public async getClaimsAnalytics = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        try {
            const endDate = moment(req.query.endDate as string || moment()).toDate();
            const startDate = moment(req.query.startDate as string || moment().subtract(30, 'days')).toDate();
            const cacheKey = `claims_analytics_${startDate.getTime()}_${endDate.getTime()}`;

            const cachedAnalytics = await this.cacheManager.get(cacheKey);
            if (cachedAnalytics) {
                this.recordMetrics('getClaimsAnalytics', startTime, req, true);
                res.json(cachedAnalytics);
                return;
            }

            const analytics = await this.analyticsService.generateClaimsAnalytics(
                startDate,
                endDate,
                { includeProjections: req.query.projections === 'true' }
            );

            await this.cacheManager.set(cacheKey, analytics, this.CACHE_TTL);

            this.recordMetrics('getClaimsAnalytics', startTime, req, false);
            res.json(analytics);
        } catch (err) {
            error('Failed to retrieve claims analytics', err);
            this.recordError('getClaimsAnalytics', err);
            res.status(500).json({ error: 'Failed to retrieve claims analytics' });
        }
    };

    /**
     * Retrieves performance metrics with SLA tracking
     */
    public async getPerformanceMetrics = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        try {
            const metricType = req.query.type as string || 'all';
            const metrics = await this.analyticsService.generatePerformanceMetrics(
                metricType,
                { detailed: req.query.detailed === 'true' }
            );

            this.recordMetrics('getPerformanceMetrics', startTime, req, false);
            res.json(metrics);
        } catch (err) {
            error('Failed to retrieve performance metrics', err);
            this.recordError('getPerformanceMetrics', err);
            res.status(500).json({ error: 'Failed to retrieve performance metrics' });
        }
    };

    /**
     * Retrieves business intelligence metrics with ML insights
     */
    public async getBusinessIntelligence = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        try {
            const cacheKey = `business_intelligence_${JSON.stringify(req.query)}`;

            const cachedIntelligence = await this.cacheManager.get(cacheKey);
            if (cachedIntelligence) {
                this.recordMetrics('getBusinessIntelligence', startTime, req, true);
                res.json(cachedIntelligence);
                return;
            }

            const intelligence = await this.analyticsService.generateBusinessIntelligence(
                {
                    includeForecasts: req.query.forecasts === 'true',
                    segmentBy: req.query.segmentBy as string
                },
                { detailed: req.query.detailed === 'true' }
            );

            await this.cacheManager.set(cacheKey, intelligence, this.CACHE_TTL);

            this.recordMetrics('getBusinessIntelligence', startTime, req, false);
            res.json(intelligence);
        } catch (err) {
            error('Failed to retrieve business intelligence', err);
            this.recordError('getBusinessIntelligence', err);
            res.status(500).json({ error: 'Failed to retrieve business intelligence' });
        }
    };

    /**
     * Records API metrics for monitoring and performance tracking
     */
    private recordMetrics(
        endpoint: string,
        startTime: number,
        req: Request,
        cacheHit: boolean
    ): void {
        const responseTime = Date.now() - startTime;
        this.metricsManager.recordAPIMetrics({
            method: req.method,
            path: `/api/analytics/${endpoint}`,
            statusCode: 200,
            responseTime,
            requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
            responseSize: 0, // Set in response interceptor
            clientId: req.headers['x-client-id'] as string
        });

        if (cacheHit) {
            this.metricsManager.recordCacheMetrics({
                operation: endpoint,
                hitRate: 1,
                memoryUsage: 0,
                evictionCount: 0,
                latency: responseTime
            });
        }
    }

    /**
     * Records error metrics for monitoring and alerting
     */
    private recordError(endpoint: string, err: any): void {
        this.metricsManager.recordAPIMetrics({
            method: 'GET',
            path: `/api/analytics/${endpoint}`,
            statusCode: 500,
            responseTime: 0,
            requestSize: 0,
            responseSize: 0
        });
    }
}