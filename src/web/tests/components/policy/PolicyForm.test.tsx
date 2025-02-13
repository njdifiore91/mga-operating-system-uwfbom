import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import { PolicyForm } from '../../../../src/components/policy/PolicyForm';
import { PolicyService } from '../../../../src/services/policy.service';
import { PolicyType, PolicyStatus } from '../../../../src/types/policy.types';
import { POLICY_VALIDATION, POLICY_TYPES } from '../../../../src/constants/policy.constants';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock PolicyService
vi.mock('../../../../src/services/policy.service', () => ({
  PolicyService: {
    submitNewPolicy: vi.fn(),
    updatePolicyDetails: vi.fn(),
    validateWithOneShield: vi.fn()
  }
}));

describe('PolicyForm', () => {
  // Test data setup
  const validPolicyData = {
    type: PolicyType.COMMERCIAL_PROPERTY,
    effectiveDate: '2024-01-01',
    expirationDate: '2024-12-31',
    coverages: [
      {
        type: 'Property',
        limit: 1000000,
        deductible: 5000,
        premium: 10000
      }
    ],
    status: PolicyStatus.DRAFT,
    premium: 10000
  };

  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset PolicyService mocks
    PolicyService.validateWithOneShield.mockResolvedValue(true);
    PolicyService.submitNewPolicy.mockResolvedValue({ ...validPolicyData, id: '123' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders form with all required fields', () => {
    render(<PolicyForm onSubmit={mockOnSubmit} />);

    // Verify basic form structure
    expect(screen.getByLabelText(/Policy Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Effective Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expiration Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Coverage/i)).toBeInTheDocument();
  });

  it('validates accessibility compliance', async () => {
    const { container } = render(<PolicyForm onSubmit={mockOnSubmit} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles form submission with valid data', async () => {
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Fill out form
    await user.selectOptions(screen.getByLabelText(/Policy Type/i), PolicyType.COMMERCIAL_PROPERTY);
    await user.type(screen.getByLabelText(/Effective Date/i), validPolicyData.effectiveDate);
    await user.type(screen.getByLabelText(/Expiration Date/i), validPolicyData.expirationDate);

    // Add coverage
    await user.click(screen.getByText(/Add Coverage/i));
    const coverageSection = screen.getByTestId('coverage-section-0');
    await user.type(within(coverageSection).getByLabelText(/Coverage Type/i), 'Property');
    await user.type(within(coverageSection).getByLabelText(/Coverage Limit/i), '1000000');

    // Submit form
    await user.click(screen.getByText(/Submit Policy/i));

    await waitFor(() => {
      expect(PolicyService.validateWithOneShield).toHaveBeenCalled();
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining(validPolicyData));
    });
  });

  it('validates OneShield integration', async () => {
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Fill form with data that should trigger OneShield validation
    await user.selectOptions(screen.getByLabelText(/Policy Type/i), PolicyType.COMMERCIAL_PROPERTY);
    await user.type(screen.getByLabelText(/Effective Date/i), validPolicyData.effectiveDate);

    await waitFor(() => {
      expect(screen.getByText(/Validating with OneShield/i)).toBeInTheDocument();
      expect(PolicyService.validateWithOneShield).toHaveBeenCalled();
    });
  });

  it('enforces business rules for policy dates', async () => {
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Try to set invalid date range
    await user.type(screen.getByLabelText(/Effective Date/i), '2024-01-01');
    await user.type(screen.getByLabelText(/Expiration Date/i), '2025-01-01');

    expect(screen.getByText(/Policy term must be between 6 and 12 months/i)).toBeInTheDocument();
  });

  it('validates coverage limits and premium calculations', async () => {
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Add coverage with invalid limit
    await user.click(screen.getByText(/Add Coverage/i));
    const coverageSection = screen.getByTestId('coverage-section-0');
    await user.type(
      within(coverageSection).getByLabelText(/Coverage Limit/i), 
      (POLICY_VALIDATION.MAX_COVERAGE_AMOUNT + 1).toString()
    );

    expect(screen.getByText(/Coverage limit cannot exceed/i)).toBeInTheDocument();
  });

  it('handles form state persistence between steps', async () => {
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Fill first step
    await user.selectOptions(screen.getByLabelText(/Policy Type/i), PolicyType.COMMERCIAL_PROPERTY);
    await user.type(screen.getByLabelText(/Effective Date/i), validPolicyData.effectiveDate);
    await user.click(screen.getByText(/Next/i));

    // Verify data persists on back navigation
    await user.click(screen.getByText(/Back/i));
    expect(screen.getByLabelText(/Policy Type/i)).toHaveValue(PolicyType.COMMERCIAL_PROPERTY);
    expect(screen.getByLabelText(/Effective Date/i)).toHaveValue(validPolicyData.effectiveDate);
  });

  it('displays appropriate error messages for validation failures', async () => {
    PolicyService.validateWithOneShield.mockRejectedValue(new Error('OneShield validation failed'));
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Submit invalid form
    await user.click(screen.getByText(/Submit Policy/i));

    expect(screen.getByText(/Policy type is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Effective date is required/i)).toBeInTheDocument();
  });

  it('supports edit mode with pre-populated data', async () => {
    render(
      <PolicyForm 
        initialData={validPolicyData}
        isEditMode={true}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByLabelText(/Policy Type/i)).toHaveValue(PolicyType.COMMERCIAL_PROPERTY);
    expect(screen.getByLabelText(/Effective Date/i)).toHaveValue(validPolicyData.effectiveDate);
  });

  it('handles API errors gracefully', async () => {
    PolicyService.submitNewPolicy.mockRejectedValue(new Error('API Error'));
    render(<PolicyForm onSubmit={mockOnSubmit} />);
    const user = userEvent.setup();

    // Fill and submit form
    await user.selectOptions(screen.getByLabelText(/Policy Type/i), PolicyType.COMMERCIAL_PROPERTY);
    await user.type(screen.getByLabelText(/Effective Date/i), validPolicyData.effectiveDate);
    await user.click(screen.getByText(/Submit Policy/i));

    expect(screen.getByText(/Failed to submit policy/i)).toBeInTheDocument();
  });
});