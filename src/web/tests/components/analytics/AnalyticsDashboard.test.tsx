import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { axe, toHaveNoViolations } from 'jest-axe';
import { WebSocket, Server } from 'mock-socket';
import { server, resetHandlers } from '../../mocks/server';
import AnalyticsDashboard from '../../../src/components/analytics/AnalyticsDashboard';
import { theme } from '../../../src/theme';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket
global.WebSocket = WebSocket as any;

// Mock dashboard metrics data
const mockDashboardMetrics = {
  policyMetrics: {
    totalPolicies: 150,
    activePolicies: 120,
    totalPremium: 1200000,
    growthRate: 15.5,
    recentBindings: 25
  },
  underwritingMetrics: {
    automationRate: 85,
    pendingReviews: 12,
    approvalRate: 85,
    averageTurnaround: 1.5
  },
  complianceMetrics: {
    complianceRate: 98,
    openViolations: 3,
    regulatoryFilings: 5,
    auditStatus: 'compliant'
  },
  performanceMetrics: {
    apiResponseTime: 1.2,
    errorRate: 0.05,
    uptime: 99.99
  }
};

describe('AnalyticsDashboard', () => {
  let mockWebSocketServer: Server;

  beforeAll(() => {
    server.listen();
    mockWebSocketServer = new Server('ws://localhost:8080/analytics/metrics');
  });

  afterAll(() => {
    server.close();
    mockWebSocketServer.close();
  });

  beforeEach(() => {
    resetHandlers();
    mockWebSocketServer.emit('connection');
  });

  // Test loading state
  it('renders loading state correctly', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading dashboard metrics')).toBeInTheDocument();
  });

  // Test metrics cards rendering
  it('displays metrics cards with correct data', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify policy metrics
    const totalPoliciesCard = screen.getByText('Total Policies').closest('.MuiCard-root');
    expect(within(totalPoliciesCard!).getByText('150')).toBeInTheDocument();
    expect(within(totalPoliciesCard!).getByText(/\+5.2%/)).toBeInTheDocument();

    // Verify underwriting metrics
    const automationRateCard = screen.getByText('Automation Rate').closest('.MuiCard-root');
    expect(within(automationRateCard!).getByText('85%')).toBeInTheDocument();
    expect(within(automationRateCard!).getByText(/\+8.5%/)).toBeInTheDocument();

    // Verify F-pattern layout
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveStyle({ gridArea: '1 / 1' });
    expect(cards[1]).toHaveStyle({ gridArea: '1 / 2' });
  });

  // Test real-time updates
  it('handles real-time metric updates via WebSocket', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Send mock WebSocket update
    const updatedMetrics = {
      ...mockDashboardMetrics,
      policyMetrics: {
        ...mockDashboardMetrics.policyMetrics,
        totalPolicies: 155
      }
    };

    mockWebSocketServer.emit('message', JSON.stringify(updatedMetrics));

    await waitFor(() => {
      const totalPoliciesCard = screen.getByText('Total Policies').closest('.MuiCard-root');
      expect(within(totalPoliciesCard!).getByText('155')).toBeInTheDocument();
    });
  });

  // Test error handling
  it('displays error state when API request fails', async () => {
    server.use(
      rest.get('/api/v1/analytics/dashboard', (req, res, ctx) =>
        res(ctx.status(500))
      )
    );

    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Error Loading Dashboard/)).toBeInTheDocument();
    });
  });

  // Test date range selection
  it('updates metrics when date range changes', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const dateRangePicker = screen.getByRole('textbox', { name: /date range/i });
    fireEvent.click(dateRangePicker);

    const startDate = screen.getByRole('button', { name: /choose start date/i });
    fireEvent.click(startDate);
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    // Verify API call with new date range
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  // Test performance charts
  it('renders performance charts correctly', async () => {
    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Policy Performance')).toBeInTheDocument();
    expect(screen.getByText('Underwriting Metrics')).toBeInTheDocument();

    const charts = screen.getAllByRole('img', { name: /metrics chart/i });
    expect(charts).toHaveLength(2);
  });

  // Test accessibility
  it('meets accessibility requirements', async () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // Test responsive layout
  it('adjusts layout for mobile viewport', async () => {
    global.innerWidth = 375;
    global.dispatchEvent(new Event('resize'));

    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const cards = screen.getAllByRole('article');
    cards.forEach(card => {
      expect(card).toHaveStyle({ gridArea: expect.stringMatching(/^[0-9]+ \/ 1$/) });
    });
  });

  // Test performance requirements
  it('maintains performance standards', async () => {
    const startTime = performance.now();

    render(
      <ThemeProvider theme={theme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(2000); // 2 seconds max render time
  });
});