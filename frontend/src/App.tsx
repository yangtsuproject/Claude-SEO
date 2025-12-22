import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, UserButton } from '@clerk/clerk-react';
import Dashboard from './pages/Dashboard';
import SearchResults from './pages/SearchResults';
import ProjectDetail from './pages/ProjectDetail';
import KeywordResearch from './pages/KeywordResearch';
import Results from './pages/Results';

function App() {
  return (
    <BrowserRouter>
      <SignedIn>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">SEO Keyword Research</h1>
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route
                path="/projects/:projectId/keyword-research/new"
                element={<KeywordResearch />}
              />
              <Route
                path="/projects/:projectId/keyword-research/:researchId"
                element={<Results />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </BrowserRouter>
  );
}

export default App;
