import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import UnderwritingWorkflow from '../../../../src/components/underwriting/UnderwritingWorkflow';
import { useUnderwriting } from '../../../../src/hooks/useUnderwriting';
import { 
  UnderwritingStatus, 
  RiskSeverity,
  type IRiskAssessmentDisplay 
} from '../../../types/underwriting.types';
import { RISK_SEVERITY, RISK_SCORE_RANGES } from '../../../constants/underwriting.constants';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useUnderwriting hook
vi.mock('../../../../src/hooks/useUnderwriting', () => ({
  useUnderwriting: vi.fn()
}));

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Factory function for creating mock risk assessment data
const createMockRiskAssessment = (overrides = {}): IRiskAssessmentDisplay => ({
  policyId: '123e4567-e89b-12d3-a456-426614174000',
  riskScore: 75,
  severity: RiskSeverity.MEDIUM,
  factors: [
    {
      type: 'CLAIMS_HISTORY',
      score: 0.8,
      severity: RiskSeverity.HIGH,
      details: {
        description: 'Multiple recent claims',
        impact: 'High impact on risk assessment',
        recommendation: 'Manual review required',
        dataSource: 'Claims Database',
        lastUpdated: new Date()
      }
    }
  ],
  assessmentDate: new Date(),
  assessedBy: 'Auto-Underwriting System',
  ...overrides
});

// Enhanced test setup with providers and mocks
const setupTest = (props = {}, mockWebSocket = {}) => {
  // Create QueryClient with test configuration
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  // Setup performance monitoring
  const performanceObserver = {
    observe: vi.fn(),
    disconnect: vi.fn()
  };
  global.PerformanceObserver = vi.fn(() => performanceObserver);

  // Mock WebSocket
  global.WebSocket = vi.fn(() => mockWebSocket);

  // Render component with providers
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <UnderwritingWorkflow
        policyId="test-policy-id"
        {...props}
      />
    </QueryClientProvider>
  );

  return {
    ...utils,
    queryClient,
    performanceObserver,
    cleanup: () => {
      queryClient.clear();
      performanceObserver.disconnect();
    }
  };
};

describe('UnderwritingWorkflow Component', () => {
  let mockRiskAssessment: IRiskAssessmentDisplay;
  let mockWebSocket: any;

  beforeEach(() => {
    mockRiskAssessment = createMockRiskAssessment();
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    vi.clearAllMocks();
  });

  describe('Initialization and Rendering', () => {
    it('should render all workflow steps correctly', () => {
      setupTest();
      
      const steps = ['Initial Review', 'Risk Assessment', 'Document Verification', 'Decision Making', 'Final Review'];
      steps.forEach(step => {
        expect(screen.getByText(step)).toBeInTheDocument();
      });
    });

    it('should initialize with correct active step', () => {
      setupTest({ initialStep: 1 });
      
      const stepper = screen.getByRole('group', { name: /underwriting progress/i });
      expect(within(stepper).getByText('Risk Assessment')).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket updates for risk assessment changes', async () => {
      const { queryClient } = setupTest();

      // Mock risk assessment update
      const updatedAssessment = createMockRiskAssessment({
        riskScore: 85,
        severity: RiskSeverity.HIGH
      });

      // Simulate WebSocket message
      const message = {
        type: 'RISK_ASSESSMENT_UPDATE',
        data: updatedAssessment
      };

      mockWebSocket.onmessage({ data: JSON.stringify(message) });

      await waitFor(() => {
        const riskScore = screen.getByText(/risk score: 85/i);
        expect(riskScore).toBeInTheDocument();
      });
    });

    it('should reconnect WebSocket on connection failure', async () => {
      setupTest();

      // Simulate connection error
      mockWebSocket.onerror(new Event('error'));

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance', () => {
    it('should render and update within performance budgets', async () => {
      const { performanceObserver } = setupTest();

      // Simulate performance entries
      const entries = [
        { name: 'first-contentful-paint', startTime: 800 },
        { name: 'largest-contentful-paint', startTime: 1200 }
      ];

      performanceObserver.observe.mock.calls[0][0](entries);

      expect(entries[0].startTime).toBeLessThan(1000); // 1 second budget
      expect(entries[1].startTime).toBeLessThan(2000); // 2 second budget
    });

    it('should optimize re-renders during risk assessment updates', async () => {
      const renderCount = vi.fn();
      const { rerender } = setupTest();

      // Track renders
      renderCount();

      // Trigger multiple updates
      for (let i = 0; i < 5; i++) {
        rerender(
          <UnderwritingWorkflow
            policyId="test-policy-id"
            initialStep={i}
          />
        );
      }

      expect(renderCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = setupTest();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain focus management during step transitions', () => {
      setupTest();
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      expect(document.activeElement).toBe(screen.getByRole('region', { name: /risk assessment/i }));
    });

    it('should provide appropriate ARIA labels and roles', () => {
      setupTest();

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Underwriting Workflow');
      expect(screen.getByRole('group', { name: /underwriting progress/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages appropriately', async () => {
      const { queryClient } = setupTest();
      const error = new Error('Failed to load risk assessment');

      vi.mocked(useUnderwriting).mockImplementation(() => ({
        ...vi.requireActual('../../../../src/hooks/useUnderwriting'),
        error,
        isError: true
      }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load risk assessment');
      });
    });

    it('should handle validation errors during step transitions', async () => {
      setupTest();
      
      // Attempt to proceed without required data
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/please complete all required fields/i);
      });
    });
  });
});