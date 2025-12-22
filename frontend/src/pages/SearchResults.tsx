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
  useApi();

  const [researchId, setResearchId] = useState<string | null>(null);

  // Create project and start keyword research
  const startResearchMutation = useMutation({
    mutationFn: async (seedKeywords: string) => {
      // Create a project with the keywords as the name
      const projectResponse = await projectsApi.create({
        name: `Research: ${seedKeywords.substring(0, 50)}`,
        targetLocation: 'United States',
      });

      const project = projectResponse.data.data;

      // Start keyword research
      const researchResponse = await keywordResearchApi.create({
        projectId: project.id,
        seedKeywords: seedKeywords.split(',').map(k => k.trim()).filter(k => k),
        targetLocation: 'United States',
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

          {/* Clusters */}
          {research.clusters.map((cluster) => (
            <Card key={cluster.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{cluster.name}</CardTitle>
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
                  <Badge variant={cluster.type === 'main' ? 'default' : 'secondary'}>
                    {cluster.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {cluster.keywords && cluster.keywords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Search Volume</TableHead>
                        <TableHead className="text-right">Difficulty</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead>Competition</TableHead>
                        <TableHead>Intent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cluster.keywords.map((keyword) => (
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
                      ))}
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
                                <TableHead>Intent</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subCluster.keywords.map((keyword) => (
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
                                    <Badge variant="secondary">
                                      {keyword.searchIntent || 'N/A'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
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
