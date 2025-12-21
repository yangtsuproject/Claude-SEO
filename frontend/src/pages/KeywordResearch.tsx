import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { keywordResearchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function KeywordResearch() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');

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
              placeholder={`colorectal surgery singapore\ncolonoscopy cost\ncolon cancer screening`}
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
