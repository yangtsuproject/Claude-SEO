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
  const [step, setStep] = useState<'business' | 'pillars' | 'config'>('business');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessGoal, setBusinessGoal] = useState('');
  const [suggestedPillars, setSuggestedPillars] = useState<string[]>([]);
  const [selectedPillars, setSelectedPillars] = useState<Set<string>>(new Set());
  const [aiReasoning, setAiReasoning] = useState('');
  const [domainRating, setDomainRating] = useState<number>(10);
  const [keywordLimit, setKeywordLimit] = useState<number>(50);

  // Get AI pillar suggestions (NEW PILLAR-FIRST APPROACH)
  const getPillarsMutation = useMutation({
    mutationFn: async (data: { businessDescription: string; goal: string }) => {
      const response = await keywordResearchApi.identifyPillars({
        businessDescription: data.businessDescription,
        goal: data.goal,
        location: 'Singapore',
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      setSuggestedPillars(data.pillars);
      setAiReasoning(data.reasoning);
      // Auto-select all pillars
      setSelectedPillars(new Set(data.pillars));
      setStep('pillars');
    },
  });

  const handleGetPillars = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessDescription.trim()) {
      getPillarsMutation.mutate({
        businessDescription: businessDescription.trim(),
        goal: businessGoal.trim(),
      });
    }
  };

  const togglePillar = (pillar: string) => {
    const newSelected = new Set(selectedPillars);
    if (newSelected.has(pillar)) {
      newSelected.delete(pillar);
    } else {
      newSelected.add(pillar);
    }
    setSelectedPillars(newSelected);
  };

  const handleStartResearch = () => {
    if (selectedPillars.size > 0) {
      const pillarsParam = Array.from(selectedPillars).join(',');
      navigate(`/search?q=${encodeURIComponent(pillarsParam)}&limit=${keywordLimit}&dr=${domainRating}`);
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
        {/* Step 1: Business & Goal */}
        {step === 'business' && (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Step 1: Tell Us About Your Business</CardTitle>
              </div>
              <CardDescription>
                Describe your business and goals. Our AI will identify the best keyword pillars for your SEO strategy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGetPillars} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    What does your business do?
                  </label>
                  <Textarea
                    placeholder="Example: I'm a licensed plumber in Singapore offering residential toilet repair, pipe repair, and water heater services"
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    className="min-h-[100px] text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    What are your SEO goals? (Optional)
                  </label>
                  <Textarea
                    placeholder="Example: I want to rank for local plumbing services and attract more emergency repair customers"
                    value={businessGoal}
                    onChange={(e) => setBusinessGoal(e.target.value)}
                    className="min-h-[80px] text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!businessDescription.trim() || getPillarsMutation.isPending}
                  className="w-full"
                >
                  {getPillarsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AI is analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Identify Keyword Pillars
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Confirm Pillars */}
        {step === 'pillars' && (
          <>
            <Card className="border-2 border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏛️</span>
                  <CardTitle>Step 2: Confirm Your Content Pillars</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  <div className="font-semibold mb-1">AI Strategy:</div>
                  {aiReasoning}
                  <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border">
                    <div className="text-xs font-semibold mb-1">What are content pillars?</div>
                    <div className="text-xs text-muted-foreground">
                      These short-tail keywords will become your main pages. For each pillar, we'll generate 8-12 long-tail sub-topics (sub-clusters) that link back to it.
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {suggestedPillars.map((pillar) => (
                    <label
                      key={pillar}
                      className="flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer hover:bg-accent transition-colors"
                      style={{
                        borderColor: selectedPillars.has(pillar) ? 'rgb(147, 51, 234)' : 'transparent',
                        backgroundColor: selectedPillars.has(pillar) ? 'rgb(250, 245, 255)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPillars.has(pillar)}
                        onChange={() => togglePillar(pillar)}
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{pillar}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Main pillar page → 8-12 sub-clusters
                        </div>
                      </div>
                      {selectedPillars.has(pillar) && (
                        <CheckCircle2 className="ml-auto h-5 w-5 text-purple-600" />
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
                    disabled={selectedPillars.size === 0}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    Continue ({selectedPillars.size} pillars)
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
              {/* Selected Pillars Summary */}
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <span>🏛️</span>
                  <div className="text-sm font-semibold">Selected Content Pillars:</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedPillars).map((pillar) => (
                    <span
                      key={pillar}
                      className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium"
                    >
                      {pillar}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  For each pillar, we'll generate 8-12 long-tail sub-cluster keywords
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
                  onClick={() => setStep('pillars')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleStartResearch}
                  size="lg"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Sub-Clusters & Start Research
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl mb-2">🏛️</div>
          <div className="text-xl font-bold text-purple-600 mb-2">Pillar Strategy</div>
          <div className="text-sm text-muted-foreground">AI identifies content pillars for your business</div>
        </div>
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl mb-2">🌳</div>
          <div className="text-xl font-bold text-purple-600 mb-2">8-12 Sub-Clusters</div>
          <div className="text-sm text-muted-foreground">Long-tail keywords per pillar</div>
        </div>
        <div className="text-center p-6 rounded-lg border bg-card">
          <div className="text-3xl mb-2">🎯</div>
          <div className="text-xl font-bold text-purple-600 mb-2">DR-Based Ranking</div>
          <div className="text-sm text-muted-foreground">Keywords matched to your authority</div>
        </div>
      </div>
    </div>
  );
}
