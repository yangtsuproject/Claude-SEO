import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { keywordResearchApi } from '@/lib/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'business' | 'seeds' | 'config'>('business');
  const [businessDescription, setBusinessDescription] = useState('');
  const [suggestedSeeds, setSuggestedSeeds] = useState<string[]>([]);
  const [selectedSeeds, setSelectedSeeds] = useState<Set<string>>(new Set());
  const [aiReasoning, setAiReasoning] = useState('');
  const [domainRating, setDomainRating] = useState<number>(10);
  const [keywordLimit, setKeywordLimit] = useState<number>(50);

  // Get AI seed suggestions
  const getSeedsMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await keywordResearchApi.extractSeeds({
        description,
        location: 'Singapore',
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      setSuggestedSeeds(data.seedKeywords);
      setAiReasoning(data.reasoning);
      // Auto-select all seeds
      setSelectedSeeds(new Set(data.seedKeywords));
      setStep('seeds');
    },
  });

  const handleGetSeeds = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessDescription.trim()) {
      getSeedsMutation.mutate(businessDescription.trim());
    }
  };

  const toggleSeed = (seed: string) => {
    const newSelected = new Set(selectedSeeds);
    if (newSelected.has(seed)) {
      newSelected.delete(seed);
    } else {
      newSelected.add(seed);
    }
    setSelectedSeeds(newSelected);
  };

  const handleStartResearch = () => {
    if (selectedSeeds.size > 0) {
      const seedsParam = Array.from(selectedSeeds).join(',');
      navigate(`/search?q=${encodeURIComponent(seedsParam)}&limit=${keywordLimit}&dr=${domainRating}`);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo/Title */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          SEO Keyword Research
        </h1>
        <p className="text-muted-foreground text-lg">
          AI-powered keyword discovery for your business
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        {/* Step 1: Business Description */}
        {step === 'business' && (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Step 1: Describe Your Business</CardTitle>
              </div>
              <CardDescription>
                Tell us what you do, and our AI will suggest the best seed keywords for your niche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGetSeeds} className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Example: I run a digital marketing consultancy offering SEO, SEM, TikTok marketing, and Meta ads services in Singapore"
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    className="min-h-[120px] text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!businessDescription.trim() || getSeedsMutation.isPending}
                  className="w-full"
                >
                  {getSeedsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AI is thinking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Get Seed Keywords
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Seeds */}
        {step === 'seeds' && (
          <>
            <Card className="border-2 border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <CardTitle>Step 2: Select Your Seed Keywords</CardTitle>
                </div>
                <CardDescription>
                  {aiReasoning}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {suggestedSeeds.map((seed) => (
                    <label
                      key={seed}
                      className="flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer hover:bg-accent transition-colors"
                      style={{
                        borderColor: selectedSeeds.has(seed) ? 'rgb(34, 197, 94)' : 'transparent',
                        backgroundColor: selectedSeeds.has(seed) ? 'rgb(240, 253, 244)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSeeds.has(seed)}
                        onChange={() => toggleSeed(seed)}
                        className="w-5 h-5"
                      />
                      <span className="font-medium">{seed}</span>
                      {selectedSeeds.has(seed) && (
                        <CheckCircle2 className="ml-auto h-5 w-5 text-green-600" />
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('business')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep('config')}
                    disabled={selectedSeeds.size === 0}
                    className="flex-1"
                  >
                    Continue ({selectedSeeds.size} selected)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Step 3: Configuration */}
        {step === 'config' && (
          <Card className="border-2 border-blue-500/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <CardTitle>Step 3: Configure Research</CardTitle>
              </div>
              <CardDescription>
                Set your domain rating and keyword limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Seeds Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">Selected Seeds:</div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedSeeds).map((seed) => (
                    <span
                      key={seed}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {seed}
                    </span>
                  ))}
                </div>
              </div>

              {/* Domain Rating */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Your Domain Rating (DR)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={domainRating}
                    onChange={(e) => setDomainRating(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20 px-3 py-2 text-center border rounded"
                  />
                  <span className="text-sm text-muted-foreground">
                    Used to recommend keywords you can rank for
                  </span>
                </div>
              </div>

              {/* Keyword Limit */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Keywords per Seed
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="limit"
                      checked={keywordLimit === 50}
                      onChange={() => setKeywordLimit(50)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">50 keywords</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="limit"
                      checked={keywordLimit === 100}
                      onChange={() => setKeywordLimit(100)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">100 keywords</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('seeds')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleStartResearch}
                  size="lg"
                  className="flex-1"
                >
                  Start Research
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl font-bold text-primary mb-2">AI-Powered</div>
          <div className="text-sm text-muted-foreground">Smart Seed Selection</div>
        </div>
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl font-bold text-primary mb-2">Top Keywords</div>
          <div className="text-sm text-muted-foreground">10 Per Seed (Highest Volume)</div>
        </div>
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl font-bold text-primary mb-2">DR-Based</div>
          <div className="text-sm text-muted-foreground">Smart Recommendations</div>
        </div>
      </div>
    </div>
  );
}
