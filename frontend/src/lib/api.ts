import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Axios instance for API calls
 */
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Hook to get authenticated API client
 * Automatically adds Clerk token to requests
 */
export function useApi() {
  const { getToken } = useAuth();

  // Add auth interceptor
  api.interceptors.request.use(
    async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  return api;
}

/**
 * API Types
 */
export interface Project {
  id: string;
  name: string;
  domain?: string;
  targetLocation: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    keywordResearch: number;
  };
}

export interface KeywordResearch {
  id: string;
  seedKeywords: string[];
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  keywords?: Keyword[];
  clusters?: Cluster[];
  project?: Project;
  _count?: {
    keywords: number;
    clusters: number;
  };
}

export interface Keyword {
  id: string;
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  cpc?: number;
  competition?: string;
  trend?: any;
  searchIntent?: string;
  keywordResearchId: string;
  clusterId?: string;
  cluster?: Cluster;
  createdAt: string;
}

export interface Cluster {
  id: string;
  name: string;
  type: 'main' | 'sub';
  recommendedUrl?: string;
  searchIntent?: string;
  keywordResearchId: string;
  parentClusterId?: string;
  parentCluster?: Cluster;
  subClusters?: Cluster[];
  keywords?: Keyword[];
  keywordCount: number;
  createdAt: string;
}

/**
 * API Methods
 */

// Projects
export const projectsApi = {
  getAll: () => api.get<{ success: boolean; data: Project[] }>('/projects'),
  getById: (id: string) => api.get<{ success: boolean; data: Project }>(`/projects/${id}`),
  create: (data: { name: string; domain?: string; targetLocation?: string }) =>
    api.post<{ success: boolean; data: Project }>('/projects', data),
  update: (id: string, data: Partial<Project>) =>
    api.put<{ success: boolean; data: Project }>(`/projects/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/projects/${id}`),
};

// Keyword Research
export const keywordResearchApi = {
  create: (data: { projectId: string; seedKeywords: string[]; targetLocation?: string }) =>
    api.post<{ success: boolean; data: KeywordResearch }>('/keyword-research', data),
  getById: (id: string) =>
    api.get<{ success: boolean; data: KeywordResearch }>(`/keyword-research/${id}`),
  getByProject: (projectId: string) =>
    api.get<{ success: boolean; data: KeywordResearch[] }>(
      `/keyword-research/project/${projectId}`
    ),
  export: (id: string) =>
    api.post<{ success: boolean; data: { spreadsheetUrl: string } }>(
      `/keyword-research/${id}/export`
    ),
  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/keyword-research/${id}`),
};
