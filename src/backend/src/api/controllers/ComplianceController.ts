import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { ComplianceService } from '../../services/ComplianceService';
import { ComplianceStatus } from '../../types/compliance.types';
import { complianceCheckSchema, complianceReportSchema } from '../validators/compliance.validator';
import { Logger } from '../../utils/logger';
import { validate } from '../middleware/validation';
import { rateLimit } from 'express-rate-limit'; // v6.9.0
import { tryCatch } from '../middleware/error-handler';

/**
 * Controller handling compliance-related endpoints for the MGA Operating System
 * Manages regulatory checks, reporting, and audit trail functionality
 */
export class ComplianceController {
    private static readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
    private static readonly CHECK_RATE_LIMIT = 100;
    private static readonly REPORT_RATE_LIMIT = 50;
    private static readonly SCHEDULE_RATE_LIMIT = 30;

    constructor(
        private readonly complianceService: ComplianceService,
        private readonly logger: Logger
    ) {
        // Bind methods to maintain context
        this.performComplianceCheck = this.performComplianceCheck.bind(this);
        this.submitComplianceReport = this.submitComplianceReport.bind(this);
        this.scheduleComplianceCheck = this.scheduleComplianceCheck.bind(this);
    }

    /**
     * Performs compliance check for a given policy with enhanced validation
     * @route POST /api/v1/compliance/check
     */
    @tryCatch
    @validate(complianceCheckSchema)
    @rateLimit({
        windowMs: ComplianceController.RATE_LIMIT_WINDOW,
        max: ComplianceController.CHECK_RATE_LIMIT
    })
    public async performComplianceCheck(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        this.logger.info('Initiating compliance check', {
            policyId: req.body.policyId,
            checkType: req.body.type
        });

        const complianceCheck = await this.complianceService.performComplianceCheck(
            req.body.policyId,
            req.body.type,
            {
                jurisdiction: req.body.jurisdiction,
                priority: req.body.priority
            }
        );

        this.logger.info('Compliance check completed', {
            checkId: complianceCheck.id,
            status: complianceCheck.status
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: complianceCheck,
            message: `Compliance check ${complianceCheck.status.toLowerCase()} for policy ${req.body.policyId}`
        });
    }

    /**
     * Submits compliance report to regulatory systems
     * @route POST /api/v1/compliance/report
     */
    @tryCatch
    @validate(complianceReportSchema)
    @rateLimit({
        windowMs: ComplianceController.RATE_LIMIT_WINDOW,
        max: ComplianceController.REPORT_RATE_LIMIT
    })
    public async submitComplianceReport(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        this.logger.info('Initiating compliance report submission', {
            reportId: req.body.id,
            checkId: req.body.checkId
        });

        const submissionResult = await this.complianceService.submitComplianceReport(req.body);

        this.logger.info('Compliance report submitted', {
            reportId: req.body.id,
            submissionId: submissionResult.submissionId,
            status: submissionResult.status
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: submissionResult,
            message: 'Compliance report submitted successfully'
        });
    }

    /**
     * Schedules automated compliance checks
     * @route POST /api/v1/compliance/schedule
     */
    @tryCatch
    @validate(complianceCheckSchema)
    @rateLimit({
        windowMs: ComplianceController.RATE_LIMIT_WINDOW,
        max: ComplianceController.SCHEDULE_RATE_LIMIT
    })
    public async scheduleComplianceCheck(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const { policyId, scheduledDate, type, jurisdiction } = req.body;

        this.logger.info('Scheduling compliance check', {
            policyId,
            scheduledDate,
            type
        });

        // Validate scheduled date is in future
        if (new Date(scheduledDate) <= new Date()) {
            res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Scheduled date must be in the future'
            });
            return;
        }

        const scheduledCheck = await this.complianceService.scheduleComplianceCheck(
            policyId,
            type,
            {
                scheduledDate,
                jurisdiction,
                status: ComplianceStatus.PENDING_REVIEW
            }
        );

        this.logger.info('Compliance check scheduled', {
            checkId: scheduledCheck.id,
            scheduledDate
        });

        res.status(StatusCodes.CREATED).json({
            success: true,
            data: scheduledCheck,
            message: 'Compliance check scheduled successfully'
        });
    }
}