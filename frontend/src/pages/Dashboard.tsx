import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Dashboard() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [keywordLimit, setKeywordLimit] = useState<number>(50); // Default to 50
  const [domainRating, setDomainRating] = useState<number>(10); // Default DR for new sites

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.trim()) {
      // Navigate to search results with keywords, limit, and DR as query params
      navigate(`/search?q=${encodeURIComponent(keywords.trim())}&limit=${keywordLimit}&dr=${domainRating}`);
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

        {/* Keyword Limit Selector */}
        <div className="flex justify-center gap-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="limit"
              value="50"
              checked={keywordLimit === 50}
              onChange={() => setKeywordLimit(50)}
              className="w-4 h-4"
            />
            <span className="text-sm">50 keywords per seed</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="limit"
              value="100"
              checked={keywordLimit === 100}
              onChange={() => setKeywordLimit(100)}
              className="w-4 h-4"
            />
            <span className="text-sm">100 keywords per seed</span>
          </label>
        </div>

        {/* Domain Rating Input */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-3 bg-muted px-4 py-2 rounded-lg">
            <label htmlFor="dr" className="text-sm font-medium">
              Your Domain Rating (DR):
            </label>
            <input
              id="dr"
              type="number"
              min="0"
              max="100"
              value={domainRating}
              onChange={(e) => setDomainRating(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-16 px-2 py-1 text-center border rounded"
            />
            <span className="text-xs text-muted-foreground">(0-100)</span>
          </div>
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
