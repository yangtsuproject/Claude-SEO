import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Calendar } from 'lucide-react';
import { projectsApi, keywordResearchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const response = await projectsApi.getById(projectId!);
      return response.data.data;
    },
    enabled: !!projectId,
  });

  const { data: research } = useQuery({
    queryKey: ['keyword-research', 'project', projectId],
    queryFn: async () => {
      const response = await keywordResearchApi.getByProject(projectId!);
      return response.data.data;
    },
    enabled: !!projectId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{project?.name}</h2>
          <p className="text-muted-foreground">{project?.domain || 'No domain'}</p>
        </div>
        <Button onClick={() => navigate(`/projects/${projectId}/keyword-research/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Research
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Keyword Research</h3>
        {research && research.length > 0 ? (
          <div className="grid gap-4">
            {research.map((item: any) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/projects/${projectId}/keyword-research/${item.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Research #{item.id.slice(-6)}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {item.seedKeywords.slice(0, 3).join(', ')}
                        {item.seedKeywords.length > 3 && ` +${item.seedKeywords.length - 3} more`}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                    {item._count && (
                      <div>
                        {item._count.keywords || 0} keywords • {item._count.clusters || 0} clusters
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No keyword research yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start your first keyword research for this project
              </p>
              <Button onClick={() => navigate(`/projects/${projectId}/keyword-research/new`)}>
                <Plus className="mr-2 h-4 w-4" />
                Start Research
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
