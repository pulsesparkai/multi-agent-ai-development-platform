import React from 'react';
import { FileCode, Calendar, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Project } from '~backend/projects/list';

interface ProjectListProps {
  projects: Project[];
  selectedProject: string | null;
  onSelectProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
}

export default function ProjectList({ projects, selectedProject, onSelectProject, onDeleteProject }: ProjectListProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getLanguageColor = (language: string) => {
    switch (language) {
      case 'javascript':
        return 'bg-yellow-500';
      case 'typescript':
        return 'bg-blue-500';
      case 'python':
        return 'bg-green-500';
      case 'react':
        return 'bg-cyan-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="overflow-y-auto">
      {projects.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No projects yet</p>
        </div>
      ) : (
        <div className="space-y-1 p-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                "p-3 rounded-lg transition-colors hover:bg-muted/50 group",
                selectedProject === project.id && "bg-muted"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    getLanguageColor(project.language)
                  )}
                />
                <h3 
                  className="font-medium truncate text-sm cursor-pointer flex-1"
                  onClick={() => onSelectProject(project.id)}
                >
                  {project.name}
                </h3>
                
                {onDeleteProject && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id);
                    }}
                    title="Delete project"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {project.description && (
                <p 
                  className="text-xs text-muted-foreground mb-2 line-clamp-2 cursor-pointer"
                  onClick={() => onSelectProject(project.id)}
                >
                  {project.description}
                </p>
              )}
              
              <div 
                className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer"
                onClick={() => onSelectProject(project.id)}
              >
                <Calendar className="h-3 w-3" />
                <span>{formatDate(project.updatedAt)}</span>
                <span className="ml-auto capitalize">{project.language}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
