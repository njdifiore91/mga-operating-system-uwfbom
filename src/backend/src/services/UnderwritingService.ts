/**
 * @file Automated underwriting engine service implementation
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Injectable } from '@nestjs/common';
import { Logger } from 'winston';
import { OneShieldClient } from '@mga/oneshield-client'; // ^2.0.0
import { Policy } from '../models/Policy';
import { IRiskAssessment, IRiskFactor, IUnderwritingDecision, UnderwritingStatus, isAutoApprovalEligible } from '../types/underwriting.types';
import { RISK_SCORE_THRESHOLDS, RISK_FACTOR_WEIGHTS, AUTO_APPROVAL_CRITERIA, RISK_MULTIPLIERS, VALIDATION_RULES } from '../constants/underwritingRules';
import { PolicyType } from '../constants/policyTypes';
import { Cache } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RateLimit } from '@nestjs/throttler';

@Injectable()
@RateLimit({ ttl: 60, limit: 100 })
export class UnderwritingService {
    private readonly CACHE_TTL = 3600; // 1 hour cache TTL
    private readonly RISK_ASSESSMENT_PREFIX = 'risk_assessment:';

    constructor(
        private readonly policyRepository: any,
        private readonly logger: Logger,
        private readonly oneShieldClient: OneShieldClient,
        private readonly cacheManager: Cache,
        private readonly eventEmitter: EventEmitter2
    ) {
        this.logger.info('Initializing UnderwritingService with enhanced automation capabilities');
    }

    /**
     * Performs automated risk assessment with confidence scoring
     * @param policyId Policy identifier
     * @param policyType Type of policy being assessed
     * @param useCache Whether to use cached assessment if available
     * @returns Enhanced risk assessment results
     */
    public async assessRisk(
        policyId: string,
        policyType: PolicyType,
        useCache = true
    ): Promise<IRiskAssessment> {
        const cacheKey = `${this.RISK_ASSESSMENT_PREFIX}${policyId}`;

        try {
            // Check cache if enabled
            if (useCache) {
                const cachedAssessment = await this.cacheManager.get<IRiskAssessment>(cacheKey);
                if (cachedAssessment) {
                    this.logger.debug('Retrieved cached risk assessment', { policyId });
                    return cachedAssessment;
                }
            }

            // Retrieve and validate policy
            const policy = await this.policyRepository.findById(policyId);
            if (!policy) {
                throw new Error(`Policy not found: ${policyId}`);
            }
            await policy.validate();

            // Calculate risk factors
            const riskFactors: IRiskFactor[] = await this.calculateRiskFactors(policy, policyType);

            // Calculate overall risk score
            const riskScore = this.calculateWeightedRiskScore(riskFactors);

            // Generate assessment
            const assessment: IRiskAssessment = {
                policyId,
                riskScore,
                riskFactors,
                assessmentDate: new Date(),
                assessedBy: 'AUTOMATED_ENGINE',
                policyType,
                validationErrors: [],
                lastModified: new Date(),
                version: 1
            };

            // Cache assessment if enabled
            if (useCache) {
                await this.cacheManager.set(cacheKey, assessment, this.CACHE_TTL);
            }

            // Emit assessment event
            this.eventEmitter.emit('underwriting.assessment.completed', assessment);

            this.logger.info('Completed risk assessment', { 
                policyId, 
                riskScore,
                factorCount: riskFactors.length 
            });

            return assessment;
        } catch (error) {
            this.logger.error('Error performing risk assessment', {
                policyId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Makes automated underwriting decision with OneShield integration
     * @param riskAssessment Risk assessment results
     * @param policyType Type of policy being underwritten
     * @returns Comprehensive underwriting decision
     */
    public async makeUnderwritingDecision(
        riskAssessment: IRiskAssessment,
        policyType: PolicyType
    ): Promise<IUnderwritingDecision> {
        try {
            // Validate assessment data
            if (!riskAssessment || !riskAssessment.riskScore) {
                throw new Error('Invalid risk assessment data');
            }

            // Check OneShield availability
            const oneShieldStatus = await this.oneShieldClient.checkSystemStatus();
            if (!oneShieldStatus.available) {
                throw new Error('OneShield system unavailable');
            }

            // Determine automation level
            const automationLevel = this.determineAutomationLevel(riskAssessment);

            // Apply decision logic
            const decision = this.applyDecisionRules(riskAssessment, policyType);

            // Sync with OneShield
            const oneShieldSync = await this.syncWithOneShield(decision, policyType);

            const underwritingDecision: IUnderwritingDecision = {
                policyId: riskAssessment.policyId,
                status: decision.status,
                riskAssessment,
                decisionDate: new Date(),
                decidedBy: automationLevel === 'FULL' ? 'AUTOMATED_ENGINE' : 'PENDING_REVIEW',
                notes: decision.notes,
                conditions: decision.conditions,
                automationLevel,
                reviewHistory: [{
                    timestamp: new Date(),
                    reviewer: 'AUTOMATED_ENGINE',
                    action: 'INITIAL_DECISION',
                    notes: decision.notes,
                    previousStatus: UnderwritingStatus.PENDING_REVIEW,
                    newStatus: decision.status
                }],
                oneShieldSyncStatus: oneShieldSync.status
            };

            // Emit decision event
            this.eventEmitter.emit('underwriting.decision.made', underwritingDecision);

            this.logger.info('Completed underwriting decision', {
                policyId: riskAssessment.policyId,
                status: decision.status,
                automationLevel
            });

            return underwritingDecision;
        } catch (error) {
            this.logger.error('Error making underwriting decision', {
                policyId: riskAssessment.policyId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Calculates risk factors based on policy data
     * @private
     */
    private async calculateRiskFactors(policy: Policy, policyType: PolicyType): Promise<IRiskFactor[]> {
        const factors: IRiskFactor[] = [];

        // Claims history assessment
        factors.push(await this.assessClaimsHistory(policy));

        // Location risk assessment
        factors.push(await this.assessLocationRisk(policy));

        // Coverage amount assessment
        factors.push(this.assessCoverageAmount(policy, policyType));

        // Business type assessment
        factors.push(await this.assessBusinessType(policy));

        return factors;
    }

    /**
     * Calculates weighted risk score from factors
     * @private
     */
    private calculateWeightedRiskScore(factors: IRiskFactor[]): number {
        return factors.reduce((score, factor) => {
            const weight = RISK_FACTOR_WEIGHTS[factor.type] || 0;
            return score + (factor.score * weight);
        }, 0);
    }

    /**
     * Determines automation level based on risk assessment
     * @private
     */
    private determineAutomationLevel(assessment: IRiskAssessment): 'FULL' | 'PARTIAL' | 'MANUAL' {
        if (isAutoApprovalEligible(assessment.riskScore)) {
            return 'FULL';
        }
        return assessment.riskScore >= RISK_SCORE_THRESHOLDS.HIGH_RISK ? 'MANUAL' : 'PARTIAL';
    }

    /**
     * Applies underwriting decision rules
     * @private
     */
    private applyDecisionRules(assessment: IRiskAssessment, policyType: PolicyType): {
        status: UnderwritingStatus;
        notes: string;
        conditions: string[];
    } {
        const { riskScore } = assessment;

        if (riskScore <= RISK_SCORE_THRESHOLDS.LOW_RISK) {
            return {
                status: UnderwritingStatus.APPROVED,
                notes: 'Automatically approved based on low risk score',
                conditions: []
            };
        }

        if (riskScore >= RISK_SCORE_THRESHOLDS.HIGH_RISK) {
            return {
                status: UnderwritingStatus.REFERRED,
                notes: 'Referred for manual review due to high risk score',
                conditions: ['Requires senior underwriter review']
            };
        }

        return {
            status: UnderwritingStatus.IN_REVIEW,
            notes: 'Pending standard underwriter review',
            conditions: ['Standard review required']
        };
    }

    /**
     * Syncs decision with OneShield
     * @private
     */
    private async syncWithOneShield(decision: any, policyType: PolicyType): Promise<{
        status: 'PENDING' | 'SYNCED' | 'FAILED';
    }> {
        try {
            await this.oneShieldClient.syncUnderwritingDecision({
                decision,
                policyType,
                timestamp: new Date()
            });
            return { status: 'SYNCED' };
        } catch (error) {
            this.logger.error('OneShield sync failed', { error });
            return { status: 'FAILED' };
        }
    }
}

export { UnderwritingService };