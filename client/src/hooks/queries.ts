import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type ReportListFilters } from '../api';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: api.categories,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ['public-config'],
    queryFn: api.publicConfig,
    staleTime: 60 * 1000,
  });
}

export function useReportDetail(reportId: string | undefined) {
  return useQuery({
    queryKey: ['report', reportId],
    queryFn: () => api.reports.get(reportId!),
    enabled: Boolean(reportId),
    staleTime: 15 * 1000,
  });
}

export function useReportList(
  scope: 'my' | 'all',
  filters: ReportListFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: ['reports', scope, filters],
    queryFn: () => (scope === 'my' ? api.reports.my(filters) : api.reports.list(filters)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDashboard(range: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ['admin', 'dashboard', range.from?.toISOString(), range.to?.toISOString()],
    queryFn: () => api.admin.dashboard(range),
    placeholderData: keepPreviousData,
  });
}

export function useAnalytics(range: { from?: Date; to?: Date }) {
  return useQuery({
    queryKey: ['admin', 'analytics', range.from?.toISOString(), range.to?.toISOString()],
    queryFn: () => api.admin.analytics(range),
    placeholderData: keepPreviousData,
  });
}

export function useMapPoints(
  filters: {
    from?: Date;
    to?: Date;
    status?: string[];
    category?: string;
    priority?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: [
      'admin',
      'map',
      filters.from?.toISOString(),
      filters.to?.toISOString(),
      filters.status,
      filters.category,
      filters.priority,
    ],
    queryFn: () => api.admin.mapPoints(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: api.admin.departments,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useStaff(departmentId?: string, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'staff', departmentId ?? 'all'],
    queryFn: () => api.admin.staff(departmentId),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useNotifications(
  params: { unreadOnly?: boolean; page?: number; pageSize?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => api.notifications.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAdminUsers(
  params: {
    q?: string;
    role?: string;
    departmentId?: string;
    active?: string;
    page?: number;
    pageSize?: number;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.admin.users(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}
