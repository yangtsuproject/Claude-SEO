import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FolderTree, AlertCircle } from 'lucide-react';
import { keywordResearchApi, Cluster, Keyword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function Results() {
  const { projectId, researchId } = useParams();
  const navigate = useNavigate();

  const { data: research, refetch } = useQuery({
    queryKey: ['keyword-research', researchId],
    queryFn: async () => {
      const response = await keywordResearchApi.getById(researchId!);
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

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await keywordResearchApi.export(researchId!);
      return response.data.data;
    },
    onSuccess: (data) => {
      window.open(data.spreadsheetUrl, '_blank');
    },
  });

  // Auto-refetch when processing
  useEffect(() => {
    if (research?.status === 'processing' || research?.status === 'pending') {
      const interval = setInterval(() => {
        refetch();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [research?.status, refetch]);

  const renderCluster = (cluster: Cluster, isSubCluster = false) => (
    <Card key={cluster.id} className={isSubCluster ? 'ml-6 mt-2' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {!isSubCluster && <FolderTree className="h-5 w-5 text-primary" />}
              <CardTitle className={isSubCluster ? 'text-lg' : ''}>
                {isSubCluster && '└─ '}
                {cluster.name}
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              {cluster.recommendedUrl && (
                <span className="text-primary font-mono text-sm">
                  {cluster.recommendedUrl}
                </span>
              )}
              {cluster.searchIntent && (
                <Badge variant="outline" className="ml-2">
                  {cluster.searchIntent}
                </Badge>
              )}
            </CardDescription>
          </div>
          <Badge>{cluster.keywordCount} keywords</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {cluster.keywords?.map((keyword: Keyword) => (
            <div
              key={keyword.id}
              className="flex items-center justify-between py-1 text-sm"
            >
              <span>{keyword.keyword}</span>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>Vol: {keyword.searchVolume?.toLocaleString() || 0}</span>
                <span>Diff: {keyword.difficulty || 0}</span>
                {keyword.cpc && <span>${keyword.cpc.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">Keyword Research Results</h2>
          <p className="text-muted-foreground">
            {research?.seedKeywords?.join(', ').slice(0, 100)}
            {(research?.seedKeywords?.join(', ') || '').length > 100 && '...'}
          </p>
        </div>
        {research?.status === 'completed' && (
          <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            Export to Google Sheets
          </Button>
        )}
      </div>

      {/* Processing Status */}
      {(research?.status === 'processing' || research?.status === 'pending') && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Processing Keyword Research...</h3>
                <Badge variant="secondary">{research.status}</Badge>
              </div>
              <Progress value={research.status === 'pending' ? 10 : 65} />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Fetching keyword data from DataForSEO
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      research.status === 'processing' ? 'bg-yellow-500' : 'bg-gray-300'
                    }`}
                  />
                  Clustering keywords with Claude AI
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gray-300" />
                  Saving results to database
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This page will automatically update when processing is complete...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {research?.status === 'failed' && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">Research Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {research.errorMessage || 'An error occurred while processing your research.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {research?.status === 'completed' && research.clusters && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Keyword Clusters</h3>
              <p className="text-sm text-muted-foreground">
                {research.clusters.length} main clusters • {research.keywords?.length || 0} total keywords
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {research.clusters.map((cluster: Cluster) => (
              <div key={cluster.id} className="space-y-2">
                {renderCluster(cluster)}
                {cluster.subClusters?.map((subCluster: Cluster) =>
                  renderCluster(subCluster, true)
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
