import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { rest } from 'msw';
import { server } from '../../mocks/server';
import ClaimForm from '../../../src/components/claims/ClaimForm';
import { CLAIM_STATUS, CLAIM_DOCUMENT_TYPES } from '../../../src/constants/claims.constants';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock data
const mockPolicyId = 'POL-12345';
const mockValidClaimData = {
  policyId: mockPolicyId,
  incidentDate: new Date(),
  description: 'Test claim description',
  location: {
    address: '123 Test St',
    city: 'Test City',
    state: 'CA',
    zipCode: '90210',
    country: 'USA'
  },
  claimantInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-555-5555',
    relationship: 'Insured'
  },
  initialReserve: 10000,
  documents: []
};

const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

describe('ClaimForm Component', () => {
  // Setup before each test
  beforeEach(() => {
    server.resetHandlers();
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ClaimForm policyId={mockPolicyId} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      
      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Claim submission form');
      expect(screen.getByLabelText('Incident date')).toBeInTheDocument();
      expect(screen.getByLabelText('Incident description')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      const firstInput = screen.getByLabelText('Incident date');
      const lastInput = screen.getByLabelText('Upload claim documents');

      firstInput.focus();
      expect(document.activeElement).toBe(firstInput);

      userEvent.tab();
      expect(document.activeElement).not.toBe(firstInput);

      // Navigate to last input
      while (document.activeElement !== lastInput) {
        userEvent.tab();
      }
      expect(document.activeElement).toBe(lastInput);
    });
  });

  // Form validation tests
  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      
      fireEvent.click(screen.getByText('Submit Claim'));

      await waitFor(() => {
        expect(screen.getByText('Incident date is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('Address is required')).toBeInTheDocument();
      });
    });

    it('should validate incident date', async () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const datePicker = screen.getByLabelText('Incident date');
      fireEvent.change(datePicker, { target: { value: futureDate.toISOString() } });

      await waitFor(() => {
        expect(screen.getByText('Incident date cannot be in the future')).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      
      const emailInput = screen.getByLabelText('Email address');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should validate phone number format', async () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      
      const phoneInput = screen.getByLabelText('Phone number');
      fireEvent.change(phoneInput, { target: { value: '123456' } });
      fireEvent.blur(phoneInput);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid US phone number (e.g., 555-555-5555)')).toBeInTheDocument();
      });
    });
  });

  // File upload tests
  describe('File Upload', () => {
    it('should handle file selection', async () => {
      render(<ClaimForm policyId={mockPolicyId} />);
      
      const fileInput = screen.getByLabelText('Upload claim documents');
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('should validate file type', async () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      
      render(<ClaimForm policyId={mockPolicyId} />);
      
      const fileInput = screen.getByLabelText('Upload claim documents');
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText(/File type not supported/i)).toBeInTheDocument();
      });
    });

    it('should handle multiple file uploads', async () => {
      const files = [
        new File(['test1'], 'test1.pdf', { type: 'application/pdf' }),
        new File(['test2'], 'test2.pdf', { type: 'application/pdf' })
      ];

      render(<ClaimForm policyId={mockPolicyId} />);
      
      const fileInput = screen.getByLabelText('Upload claim documents');
      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('test1.pdf')).toBeInTheDocument();
        expect(screen.getByText('test2.pdf')).toBeInTheDocument();
      });
    });
  });

  // API integration tests
  describe('API Integration', () => {
    it('should submit claim successfully', async () => {
      const onSubmitSuccess = jest.fn();
      
      server.use(
        rest.post('/api/claims', (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json({
              success: true,
              data: { id: 'CLM-12345', ...mockValidClaimData }
            })
          );
        })
      );

      render(
        <ClaimForm 
          policyId={mockPolicyId}
          onSubmitSuccess={onSubmitSuccess}
        />
      );

      // Fill form with valid data
      await userEvent.type(screen.getByLabelText('Incident description'), mockValidClaimData.description);
      await userEvent.type(screen.getByLabelText('Street address'), mockValidClaimData.location.address);
      await userEvent.type(screen.getByLabelText('City'), mockValidClaimData.location.city);
      await userEvent.type(screen.getByLabelText('State'), mockValidClaimData.location.state);
      await userEvent.type(screen.getByLabelText('ZIP code'), mockValidClaimData.location.zipCode);
      await userEvent.type(screen.getByLabelText('First name'), mockValidClaimData.claimantInfo.firstName);
      await userEvent.type(screen.getByLabelText('Last name'), mockValidClaimData.claimantInfo.lastName);
      await userEvent.type(screen.getByLabelText('Email address'), mockValidClaimData.claimantInfo.email);
      await userEvent.type(screen.getByLabelText('Phone number'), mockValidClaimData.claimantInfo.phone);

      fireEvent.click(screen.getByText('Submit Claim'));

      await waitFor(() => {
        expect(onSubmitSuccess).toHaveBeenCalled();
      });
    });

    it('should handle API errors', async () => {
      server.use(
        rest.post('/api/claims', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: { message: 'Server error' }
            })
          );
        })
      );

      render(<ClaimForm policyId={mockPolicyId} />);

      // Fill form with valid data
      await userEvent.type(screen.getByLabelText('Incident description'), mockValidClaimData.description);
      fireEvent.click(screen.getByText('Submit Claim'));

      await waitFor(() => {
        expect(screen.getByText('Failed to submit claim')).toBeInTheDocument();
      });
    });

    it('should handle document upload errors', async () => {
      server.use(
        rest.post('/api/claims/:claimId/documents', (req, res, ctx) => {
          return res(
            ctx.status(413),
            ctx.json({
              success: false,
              error: { message: 'File size exceeds limit' }
            })
          );
        })
      );

      render(<ClaimForm policyId={mockPolicyId} />);
      
      const fileInput = screen.getByLabelText('Upload claim documents');
      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText(/File size exceeds limit/i)).toBeInTheDocument();
      });
    });
  });
});