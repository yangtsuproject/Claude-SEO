import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Download } from 'lucide-react';
import { useApi, projectsApi, keywordResearchApi, KeywordResearch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const keywords = searchParams.get('q') || '';
  const keywordLimit = parseInt(searchParams.get('limit') || '50'); // Default to 50
  const domainRating = parseInt(searchParams.get('dr') || '10'); // Default to 10
  useApi();

  const [researchId, setResearchId] = useState<string | null>(null);

  // DR-based recommendation logic
  const getRecommendationLevel = (difficulty: number | null | undefined): 'recommended' | 'challenging' | 'difficult' => {
    if (difficulty === null || difficulty === undefined) return 'challenging';
    if (difficulty <= domainRating + 15) return 'recommended';
    if (difficulty <= domainRating + 30) return 'challenging';
    return 'difficult';
  };

  const getRecommendationBadge = (difficulty: number | null | undefined) => {
    const level = getRecommendationLevel(difficulty);
    switch (level) {
      case 'recommended':
        return { variant: 'default' as const, text: '✅ Recommended', className: 'bg-green-100 text-green-800 border-green-300' };
      case 'challenging':
        return { variant: 'secondary' as const, text: '⚠️ Challenging', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      case 'difficult':
        return { variant: 'destructive' as const, text: '❌ Too Difficult', className: 'bg-red-100 text-red-800 border-red-300' };
    }
  };

  // Create project and start keyword research
  const startResearchMutation = useMutation({
    mutationFn: async (seedKeywords: string) => {
      // Create a project with the keywords as the name
      const projectResponse = await projectsApi.create({
        name: `Research: ${seedKeywords.substring(0, 50)}`,
        targetLocation: 'Singapore',
        domainRating: domainRating,
      });

      const project = projectResponse.data.data;

      // Start keyword research
      const researchResponse = await keywordResearchApi.create({
        projectId: project.id,
        seedKeywords: seedKeywords.split(',').map(k => k.trim()).filter(k => k),
        targetLocation: 'Singapore',
        keywordLimit: keywordLimit, // Pass the limit (50 or 100)
        includePAA: true, // Always include PAA questions
      });

      return researchResponse.data.data;
    },
    onSuccess: (data) => {
      setResearchId(data.id);
    },
  });

  // Fetch research results
  const { data: research, isLoading: isLoadingResearch } = useQuery({
    queryKey: ['keyword-research', researchId],
    queryFn: async () => {
      if (!researchId) return null;
      const response = await keywordResearchApi.getById(researchId);
      return response.data.data;
    },
    enabled: !!researchId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'processing' || data?.status === 'pending'
        ? 5000
        : false;
    },
  });

  // Auto-start research when component mounts
  useEffect(() => {
    if (keywords && !researchId && !startResearchMutation.isPending) {
      startResearchMutation.mutate(keywords);
    }
  }, [keywords]);

  const handleExport = async () => {
    if (researchId) {
      try {
        const response = await keywordResearchApi.export(researchId);
        window.open(response.data.data.spreadsheetUrl, '_blank');
      } catch (error) {
        console.error('Export failed:', error);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            New Search
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Keyword Research Results</h2>
            <p className="text-muted-foreground">Seed Keywords: {keywords}</p>
          </div>
        </div>

        {research?.status === 'completed' && (
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export to Google Sheets
          </Button>
        )}
      </div>

      {/* Status */}
      {(startResearchMutation.isPending || research?.status === 'pending' || research?.status === 'processing') && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Analyzing Keywords...</h3>
              <p className="text-sm text-muted-foreground">
                {research?.status === 'processing'
                  ? 'Processing keyword data and creating clusters'
                  : 'Starting keyword research'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {(startResearchMutation.isError || research?.status === 'failed') && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-destructive">
              {research?.errorMessage || 'Failed to start keyword research. Please try again.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {research?.status === 'completed' && research.clusters && research.clusters.length > 0 && (
        <div className="space-y-6">
          {/* DR Info Banner */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🎯</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Keyword Recommendations Based on Your DR {domainRating}
                  </h3>
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <p>✅ <strong>Recommended:</strong> KD ≤ {domainRating + 15} (Target these first)</p>
                    <p>⚠️ <strong>Challenging:</strong> KD {domainRating + 16}-{domainRating + 30} (Possible with good content)</p>
                    <p>❌ <strong>Too Difficult:</strong> KD &gt; {domainRating + 30} (Build authority first)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Keywords
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{research._count?.keywords || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Clusters Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{research._count?.clusters || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="text-lg">Completed</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Pillar/Cluster Hierarchy Info */}
          {research.clusters.some(c => c.type === 'main') && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🏛️</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                      Pillar/Cluster Content Strategy
                    </h3>
                    <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                      Your content is organized around a central <strong>Pillar Page</strong> with supporting <strong>Cluster Pages</strong> that link back to it.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-white dark:bg-gray-900 p-3 rounded border">
                        <div className="font-semibold mb-1">🏛️ Pillar Page</div>
                        <div className="text-muted-foreground">Broad, comprehensive content hub</div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded border">
                        <div className="font-semibold mb-1">📄 Cluster Pages</div>
                        <div className="text-muted-foreground">Specific topics linking to pillar</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clusters */}
          {research.clusters.map((cluster) => (
            <Card key={cluster.id} className={cluster.type === 'main' ? 'border-2 border-purple-300 dark:border-purple-700' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {cluster.type === 'main' && <span className="text-2xl">🏛️</span>}
                      <CardTitle className="text-xl">{cluster.name}</CardTitle>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>
                        <strong>Keywords:</strong> {cluster.keywordCount}
                      </span>
                      {cluster.searchIntent && (
                        <span>
                          <strong>Intent:</strong> {cluster.searchIntent}
                        </span>
                      )}
                      {cluster.recommendedUrl && (
                        <span>
                          <strong>URL:</strong> {cluster.recommendedUrl}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={cluster.type === 'main' ? 'default' : 'secondary'}
                    className={cluster.type === 'main' ? 'bg-purple-600' : ''}
                  >
                    {cluster.type === 'main' ? '🏛️ Pillar Page' : '📄 Cluster Page'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* People Also Ask Questions */}
                {cluster.peopleAlsoAsk && Array.isArray(cluster.peopleAlsoAsk) && cluster.peopleAlsoAsk.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      <span className="text-blue-600">❓</span>
                      People Also Ask
                    </h4>
                    <div className="space-y-2">
                      {cluster.peopleAlsoAsk.map((paa: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {paa.question}
                          </p>
                          {paa.url && (
                            <a
                              href={paa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              View source →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords Table */}
                {cluster.keywords && cluster.keywords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Search Volume</TableHead>
                        <TableHead className="text-right">Difficulty</TableHead>
                        <TableHead>Recommendation</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead>Competition</TableHead>
                        <TableHead>Intent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cluster.keywords.map((keyword) => {
                        const badge = getRecommendationBadge(keyword.difficulty);
                        return (
                          <TableRow key={keyword.id}>
                            <TableCell className="font-medium">{keyword.keyword}</TableCell>
                            <TableCell className="text-right">
                              {keyword.searchVolume?.toLocaleString() || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              {keyword.difficulty !== null && keyword.difficulty !== undefined
                                ? `${keyword.difficulty}%`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge className={badge.className}>{badge.text}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {keyword.cpc !== null && keyword.cpc !== undefined
                                ? `$${keyword.cpc.toFixed(2)}`
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{keyword.competition || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{keyword.searchIntent || 'N/A'}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No keywords in this cluster</p>
                )}

                {/* Sub-clusters */}
                {cluster.subClusters && cluster.subClusters.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h4 className="font-semibold">Sub-clusters:</h4>
                    {cluster.subClusters.map((subCluster) => (
                      <div key={subCluster.id} className="pl-6 border-l-2">
                        <h5 className="font-medium mb-2">{subCluster.name}</h5>
                        {subCluster.keywords && subCluster.keywords.length > 0 && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead className="text-right">Search Volume</TableHead>
                                <TableHead className="text-right">Difficulty</TableHead>
                                <TableHead>Recommendation</TableHead>
                                <TableHead>Intent</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subCluster.keywords.map((keyword) => {
                                const badge = getRecommendationBadge(keyword.difficulty);
                                return (
                                  <TableRow key={keyword.id}>
                                    <TableCell className="font-medium">{keyword.keyword}</TableCell>
                                    <TableCell className="text-right">
                                      {keyword.searchVolume?.toLocaleString() || 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {keyword.difficulty !== null && keyword.difficulty !== undefined
                                        ? `${keyword.difficulty}%`
                                        : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={badge.className}>{badge.text}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">
                                        {keyword.searchIntent || 'N/A'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
