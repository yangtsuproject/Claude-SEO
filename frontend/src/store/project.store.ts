import { create } from 'zustand';
import { Project, KeywordResearch } from '../lib/api';

/**
 * Project Store
 * Global state management for projects and keyword research
 */
interface ProjectStore {
  currentProject: Project | null;
  currentKeywordResearch: KeywordResearch | null;
  setCurrentProject: (project: Project | null) => void;
  setCurrentKeywordResearch: (research: KeywordResearch | null) => void;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  currentKeywordResearch: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentKeywordResearch: (research) => set({ currentKeywordResearch: research }),
  clearCurrentProject: () =>
    set({ currentProject: null, currentKeywordResearch: null }),
}));
