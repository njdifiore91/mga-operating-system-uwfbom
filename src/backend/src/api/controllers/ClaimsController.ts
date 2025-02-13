import { injectable } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from 'inversify-express-utils';
import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ClaimsService } from '../../services/ClaimsService';
import { validateCreateClaimRequest, validateUpdateClaimStatusRequest } from '../validators/claims.validator';
import { Logger } from '../../utils/logger';
import { metricsManager } from '../../utils/metrics';
import { authorize } from '../../middleware/auth';

/**
 * REST API controller implementing claims management endpoints with comprehensive
 * validation, monitoring, and error handling for the MGA OS platform.
 * 
 * @version 1.0.0
 */
@injectable()
@controller('/api/v1/claims')
@rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: 'Rate limit exceeded. Please try again later.'
})
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  /**
   * Creates a new claim with comprehensive validation and monitoring
   * 
   * @route POST /api/v1/claims
   * @security JWT
   */
  @httpPost('/')
  @authorize('claims:create')
  async createClaim(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();

    try {
      // Validate request
      const validationResult = await validateCreateClaimRequest(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.errors
        });
      }

      // Create claim
      const claim = await this.claimsService.createClaim(validationResult.data);

      // Record metrics
      const duration = Date.now() - startTime;
      metricsManager.recordAPIMetrics({
        method: 'POST',
        path: '/api/v1/claims',
        statusCode: 201,
        responseTime: duration,
        requestSize: JSON.stringify(req.body).length,
        responseSize: JSON.stringify(claim).length
      });

      Logger.info('Claim created successfully', {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        duration
      });

      return res.status(201).json(claim);
    } catch (error) {
      Logger.error('Failed to create claim', error, { body: req.body });
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create claim'
      });
    }
  }

  /**
   * Retrieves a claim by ID with caching and performance optimization
   * 
   * @route GET /api/v1/claims/:id
   * @security JWT
   */
  @httpGet('/:id')
  @authorize('claims:read')
  async getClaim(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const { id } = req.params;

    try {
      const claim = await this.claimsService.getClaim(id);
      if (!claim) {
        return res.status(404).json({
          error: 'Not found',
          message: `Claim ${id} not found`
        });
      }

      const duration = Date.now() - startTime;
      metricsManager.recordAPIMetrics({
        method: 'GET',
        path: '/api/v1/claims/:id',
        statusCode: 200,
        responseTime: duration,
        requestSize: 0,
        responseSize: JSON.stringify(claim).length
      });

      return res.status(200).json(claim);
    } catch (error) {
      Logger.error('Failed to retrieve claim', error, { claimId: id });
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve claim'
      });
    }
  }

  /**
   * Updates claim status with validation and compliance checks
   * 
   * @route PUT /api/v1/claims/:id/status
   * @security JWT
   */
  @httpPut('/:id/status')
  @authorize('claims:update')
  async updateClaimStatus(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const { id } = req.params;

    try {
      // Get current claim for status validation
      const currentClaim = await this.claimsService.getClaim(id);
      if (!currentClaim) {
        return res.status(404).json({
          error: 'Not found',
          message: `Claim ${id} not found`
        });
      }

      // Validate status update request
      const validationResult = await validateUpdateClaimStatusRequest(
        req.body,
        currentClaim.status
      );

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.errors
        });
      }

      // Update claim status
      const updatedClaim = await this.claimsService.updateClaimStatus(
        id,
        validationResult.data
      );

      const duration = Date.now() - startTime;
      metricsManager.recordAPIMetrics({
        method: 'PUT',
        path: '/api/v1/claims/:id/status',
        statusCode: 200,
        responseTime: duration,
        requestSize: JSON.stringify(req.body).length,
        responseSize: JSON.stringify(updatedClaim).length
      });

      return res.status(200).json(updatedClaim);
    } catch (error) {
      Logger.error('Failed to update claim status', error, {
        claimId: id,
        body: req.body
      });
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update claim status'
      });
    }
  }

  /**
   * Updates claim reserves with financial validation
   * 
   * @route PUT /api/v1/claims/:id/reserves
   * @security JWT
   */
  @httpPut('/:id/reserves')
  @authorize('claims:update')
  async updateReserves(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const { id } = req.params;
    const { reserveAmount } = req.body;

    try {
      if (typeof reserveAmount !== 'number' || reserveAmount < 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Reserve amount must be a non-negative number'
        });
      }

      const updatedClaim = await this.claimsService.updateReserves(
        id,
        reserveAmount
      );

      const duration = Date.now() - startTime;
      metricsManager.recordAPIMetrics({
        method: 'PUT',
        path: '/api/v1/claims/:id/reserves',
        statusCode: 200,
        responseTime: duration,
        requestSize: JSON.stringify(req.body).length,
        responseSize: JSON.stringify(updatedClaim).length
      });

      return res.status(200).json(updatedClaim);
    } catch (error) {
      Logger.error('Failed to update claim reserves', error, {
        claimId: id,
        reserveAmount
      });
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update claim reserves'
      });
    }
  }
}