import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Dashboard() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.trim()) {
      // Navigate to search results with keywords as query param
      navigate(`/search?q=${encodeURIComponent(keywords.trim())}`);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      {/* Logo/Title */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          SEO Keyword Research
        </h1>
        <p className="text-muted-foreground text-lg">
          Discover high-value keywords for your content strategy
        </p>
      </div>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="w-full max-w-2xl">
        <div className="relative">
          <Input
            type="text"
            placeholder="Enter seed keywords (e.g., colorectal surgery Singapore)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="h-14 pl-12 pr-4 text-lg rounded-full border-2 shadow-lg focus:shadow-xl transition-shadow"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex justify-center gap-3 mt-6">
          <Button
            type="submit"
            size="lg"
            disabled={!keywords.trim()}
            className="rounded-full px-8"
          >
            Search Keywords
          </Button>
        </div>
      </form>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl font-bold text-primary mb-2">1000+</div>
          <div className="text-sm text-muted-foreground">Keywords Analyzed</div>
        </div>
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl font-bold text-primary mb-2">AI-Powered</div>
          <div className="text-sm text-muted-foreground">Smart Clustering</div>
        </div>
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl font-bold text-primary mb-2">Real-time</div>
          <div className="text-sm text-muted-foreground">Search Volume Data</div>
        </div>
      </div>
    </div>
  );
}
