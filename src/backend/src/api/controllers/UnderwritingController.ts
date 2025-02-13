/**
 * @file Underwriting Controller implementation for MGA Operating System
 * @version 1.0.0
 * @description Implements REST API endpoints for automated underwriting workflows with 
 * enhanced validation, caching, and OneShield integration
 */

import { 
    Controller, 
    Post, 
    Get, 
    Body, 
    Param, 
    UseInterceptors,
    CacheInterceptor
} from '@nestjs/common';
import { UnderwritingService } from '../../services/UnderwritingService';
import { 
    validateRiskAssessment,
    validateUnderwritingDecision 
} from '../validators/underwriting.validator';
import { 
    IRiskAssessment,
    IUnderwritingDecision 
} from '../../types/underwriting.types';

@Controller('api/v1/underwriting')
@UseInterceptors(CacheInterceptor)
export class UnderwritingController {
    private readonly CACHE_TTL = 3600; // 1 hour cache TTL
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second

    constructor(private readonly underwritingService: UnderwritingService) {}

    /**
     * Performs automated risk assessment for a policy with enhanced validation and caching
     * @param riskAssessmentData Risk assessment request data
     * @returns Risk assessment results with OneShield integration status
     */
    @Post('risk-assessment')
    @UseInterceptors(CacheInterceptor)
    async assessPolicyRisk(
        @Body() riskAssessmentData: IRiskAssessment
    ): Promise<IRiskAssessment> {
        try {
            // Validate request data using Zod schema
            const validatedData = await validateRiskAssessment(riskAssessmentData);

            // Perform risk assessment with retries
            let retries = 0;
            while (retries < this.MAX_RETRIES) {
                try {
                    const assessment = await this.underwritingService.assessRisk(
                        validatedData.policyId,
                        validatedData.policyType,
                        true // Enable caching
                    );
                    return assessment;
                } catch (error) {
                    if (retries === this.MAX_RETRIES - 1) throw error;
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                }
            }

            throw new Error('Risk assessment failed after maximum retries');
        } catch (error) {
            throw new Error(`Risk assessment failed: ${error.message}`);
        }
    }

    /**
     * Makes underwriting decision with enhanced validation and OneShield integration
     * @param decisionData Underwriting decision request data
     * @returns Final underwriting decision with OneShield reference
     */
    @Post('decision')
    async makeDecision(
        @Body() decisionData: IUnderwritingDecision
    ): Promise<IUnderwritingDecision> {
        try {
            // Validate decision data using Zod schema
            const validatedData = await validateUnderwritingDecision(decisionData);

            // Make underwriting decision with retries
            let retries = 0;
            while (retries < this.MAX_RETRIES) {
                try {
                    const decision = await this.underwritingService.makeUnderwritingDecision(
                        validatedData.riskAssessment,
                        validatedData.riskAssessment.policyType
                    );
                    return decision;
                } catch (error) {
                    if (retries === this.MAX_RETRIES - 1) throw error;
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                }
            }

            throw new Error('Underwriting decision failed after maximum retries');
        } catch (error) {
            throw new Error(`Underwriting decision failed: ${error.message}`);
        }
    }

    /**
     * Evaluates complete policy with caching and enhanced validation
     * @param policyId Policy identifier
     * @returns Complete policy evaluation with OneShield integration status
     */
    @Get('evaluate/:policyId')
    @UseInterceptors(CacheInterceptor)
    async evaluatePolicy(
        @Param('policyId') policyId: string
    ): Promise<IUnderwritingDecision> {
        try {
            // Validate policy ID format
            if (!policyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('Invalid policy ID format');
            }

            // Evaluate policy with retries
            let retries = 0;
            while (retries < this.MAX_RETRIES) {
                try {
                    const evaluation = await this.underwritingService.evaluatePolicy(
                        policyId,
                        true // Enable caching
                    );
                    return evaluation;
                } catch (error) {
                    if (retries === this.MAX_RETRIES - 1) throw error;
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                }
            }

            throw new Error('Policy evaluation failed after maximum retries');
        } catch (error) {
            throw new Error(`Policy evaluation failed: ${error.message}`);
        }
    }
}