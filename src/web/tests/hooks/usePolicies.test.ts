import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { server } from '../mocks/server';
import { usePolicies } from '../../src/hooks/usePolicies';
import { PolicyType, PolicyStatus } from '../../src/types/policy.types';
import { API_ENDPOINTS } from '../../src/constants/api.constants';

// Mock Redux store setup
const createTestStore = () => configureStore({
  reducer: {
    policy: (state = {
      policies: [],
      loading: false,
      error: null,
      pagination: {
        total: 0,
        currentPage: 1,
        pageSize: 10,
      }
    }, action) => state
  }
});

// Test wrapper component with Redux provider
const wrapper = ({ children }) => (
  <Provider store={createTestStore()}>{children}</Provider>
);

// Mock policy data factory
const createMockPolicy = (id: string) => ({
  id,
  policyNumber: `POL-${id}`,
  type: PolicyType.COMMERCIAL_PROPERTY,
  status: PolicyStatus.ACTIVE,
  effectiveDate: new Date().toISOString(),
  expirationDate: new Date(Date.now() + 31536000000).toISOString(),
  premium: 50000,
  coverages: [],
  underwritingInfo: {
    riskScore: 85,
    underwriterNotes: '',
    approvalStatus: 'APPROVED',
    reviewedBy: 'John Smith',
    reviewDate: new Date().toISOString()
  },
  endorsements: [],
  documents: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

describe('usePolicies hook', () => {
  // Reset MSW handlers before each test
  beforeEach(() => {
    server.resetHandlers();
  });

  it('should handle automatic policy fetching', async () => {
    // Mock successful policy fetch
    server.use(
      rest.get(API_ENDPOINTS.POLICY.BASE, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              policies: [createMockPolicy('1'), createMockPolicy('2')],
              total: 2
            },
            error: null
          })
        );
      })
    );

    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies({ autoFetch: true }),
      { wrapper }
    );

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.policies).toEqual([]);
    expect(result.current.error).toBeNull();

    // Wait for fetch to complete
    await waitForNextUpdate();

    // Verify loaded state
    expect(result.current.loading).toBe(false);
    expect(result.current.policies).toHaveLength(2);
    expect(result.current.totalPolicies).toBe(2);
  });

  it('should handle manual policy fetching', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies({ autoFetch: false }),
      { wrapper }
    );

    // Initial state should not trigger fetch
    expect(result.current.loading).toBe(false);
    expect(result.current.policies).toEqual([]);

    // Manually trigger fetch
    await act(async () => {
      await result.current.fetchPolicies();
    });

    // Verify loading state during fetch
    expect(result.current.loading).toBe(true);

    await waitForNextUpdate();

    // Verify completed state
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle policy creation with validation', async () => {
    const newPolicy = {
      type: PolicyType.COMMERCIAL_PROPERTY,
      effectiveDate: new Date().toISOString(),
      premium: 50000
    };

    server.use(
      rest.post(API_ENDPOINTS.POLICY.CREATE, (req, res, ctx) => {
        return res(
          ctx.status(201),
          ctx.json({
            success: true,
            data: createMockPolicy('new-1'),
            error: null
          })
        );
      })
    );

    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies(),
      { wrapper }
    );

    await act(async () => {
      await result.current.createPolicy(newPolicy);
    });

    await waitForNextUpdate();

    expect(result.current.error).toBeNull();
    expect(result.current.policies).toContainEqual(
      expect.objectContaining({ id: 'new-1' })
    );
  });

  it('should handle policy updates with optimistic updates', async () => {
    const updateData = {
      premium: 60000,
      status: PolicyStatus.APPROVED
    };

    server.use(
      rest.put(`${API_ENDPOINTS.POLICY.UPDATE.replace(':id', '1')}`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: { ...createMockPolicy('1'), ...updateData },
            error: null
          })
        );
      })
    );

    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies(),
      { wrapper }
    );

    await act(async () => {
      await result.current.updatePolicy('1', updateData);
    });

    await waitForNextUpdate();

    expect(result.current.error).toBeNull();
    expect(result.current.policies.find(p => p.id === '1')?.premium).toBe(60000);
  });

  it('should handle policy binding workflow', async () => {
    server.use(
      rest.post(`${API_ENDPOINTS.POLICY.BASE}/1/bind`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: { ...createMockPolicy('1'), status: PolicyStatus.BOUND },
            error: null
          })
        );
      })
    );

    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies(),
      { wrapper }
    );

    await act(async () => {
      await result.current.bindPolicy('1');
    });

    await waitForNextUpdate();

    expect(result.current.error).toBeNull();
    expect(result.current.policies.find(p => p.id === '1')?.status).toBe(PolicyStatus.BOUND);
  });

  it('should handle error states appropriately', async () => {
    server.use(
      rest.get(API_ENDPOINTS.POLICY.BASE, (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({
            success: false,
            data: null,
            error: { message: 'Internal server error' }
          })
        );
      })
    );

    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies(),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.policies).toEqual([]);
  });

  it('should handle pagination correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies({ page: 2, limit: 10 }),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.currentPage).toBe(2);
    expect(result.current.hasNextPage).toBeDefined();
    expect(result.current.hasPreviousPage).toBe(true);
  });

  it('should respect cache timeout settings', async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => usePolicies({ cacheTimeout: 1000 }),
      { wrapper }
    );

    await waitForNextUpdate();

    // First fetch should complete
    expect(result.current.loading).toBe(false);

    // Immediate refetch should use cache
    await act(async () => {
      await result.current.fetchPolicies();
    });

    expect(result.current.loading).toBe(false);

    // Wait for cache timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Fetch after timeout should trigger new request
    await act(async () => {
      await result.current.fetchPolicies();
    });

    expect(result.current.loading).toBe(true);
  });
});