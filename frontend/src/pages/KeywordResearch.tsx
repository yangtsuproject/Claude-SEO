import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { keywordResearchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function KeywordResearch() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [description, setDescription] = useState('');
  const [aiReasoning, setAiReasoning] = useState('');

  const extractSeedsMutation = useMutation({
    mutationFn: async (desc: string) => {
      const response = await keywordResearchApi.extractSeeds({
        description: desc,
        location: 'Singapore',
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      // Set the extracted keywords
      setKeywords(data.seedKeywords.join('\n'));
      setAiReasoning(data.reasoning);
      setDescription(''); // Clear description after extraction
    },
  });

  const createResearchMutation = useMutation({
    mutationFn: async (seedKeywords: string[]) => {
      const response = await keywordResearchApi.create({
        projectId: projectId!,
        seedKeywords,
        targetLocation: 'Singapore',
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      navigate(`/projects/${projectId}/keyword-research/${data.id}`);
    },
  });

  const handleExtractSeeds = () => {
    if (description.trim().length > 0) {
      extractSeedsMutation.mutate(description.trim());
    }
  };

  const handleSubmit = () => {
    const seedKeywords = keywords
      .split('\n')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (seedKeywords.length > 0) {
      createResearchMutation.mutate(seedKeywords);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">New Keyword Research</h2>
          <p className="text-muted-foreground">Enter your seed keywords to get started</p>
        </div>
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI-Powered Seed Keywords</CardTitle>
          </div>
          <CardDescription>
            Describe what you want to rank for, and Claude AI will intelligently select the best seed keywords
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">What do you want to rank for?</Label>
            <Textarea
              id="description"
              placeholder="Example: I run a clinic offering colonoscopy and colorectal screening services in Singapore"
              className="min-h-[120px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button
            onClick={handleExtractSeeds}
            disabled={description.trim().length === 0 || extractSeedsMutation.isPending}
            className="w-full"
          >
            {extractSeedsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI is thinking...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Recommendations
              </>
            )}
          </Button>

          {aiReasoning && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                <strong>Why these keywords?</strong>
                <br />
                {aiReasoning}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seed Keywords</CardTitle>
          <CardDescription>
            Enter one keyword per line. These will be expanded and clustered using AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (one per line)</Label>
            <Textarea
              id="keywords"
              placeholder={`colonoscopy\ncolorectal screening\ncolon cancer screening`}
              className="min-h-[200px] font-mono"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {keywords.split('\n').filter((k) => k.trim().length > 0).length} keywords entered
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}`)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                keywords.split('\n').filter((k) => k.trim().length > 0).length === 0 ||
                createResearchMutation.isPending
              }
            >
              {createResearchMutation.isPending ? 'Starting Research...' : 'Start Research'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">What happens next?</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>We'll fetch keyword data from DataForSEO API</li>
            <li>Claude AI will cluster keywords into logical groups</li>
            <li>You'll get organized clusters with URL recommendations</li>
            <li>Export results to Google Sheets</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
