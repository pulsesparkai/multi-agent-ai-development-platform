import React, { useState } from 'react';
import { CheckCircle, Circle, Clock, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  timestamp?: Date;
}

interface LeapStyleTodoProps {
  todos: TodoItem[];
  onUpdateTodo: (id: string, status: TodoItem['status']) => void;
  onExecuteNext: () => void;
  isExecuting: boolean;
}

export default function LeapStyleTodo({ 
  todos, 
  onUpdateTodo, 
  onExecuteNext, 
  isExecuting 
}: LeapStyleTodoProps) {
  const currentTodo = todos.find(t => t.status === 'in_progress');
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">AI Execution Progress</h3>
          <div className="text-sm text-muted-foreground">
            ({completedCount}/{totalCount})
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isExecuting ? (
            <div className="flex items-center gap-1 text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              Executing...
            </div>
          ) : (
            <Button 
              size="sm" 
              onClick={onExecuteNext}
              disabled={completedCount === totalCount}
            >
              <Play className="h-3 w-3 mr-1" />
              Continue
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Todo List */}
      <div className="space-y-2">
        {todos.map((todo, index) => (
          <div 
            key={todo.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
              todo.status === 'in_progress' 
                ? 'border-blue-200 bg-blue-50' 
                : todo.status === 'completed'
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(todo.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${
                todo.status === 'completed' ? 'line-through text-gray-600' : ''
              }`}>
                {todo.content}
              </p>
              
              {todo.timestamp && (
                <p className="text-xs text-muted-foreground mt-1">
                  {todo.status === 'completed' ? 'Completed' : 'Started'} at {todo.timestamp.toLocaleTimeString()}
                </p>
              )}
            </div>

            {todo.status === 'in_progress' && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Current Action */}
      {currentTodo && (
        <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
            <Clock className="h-4 w-4 animate-pulse" />
            Currently Working On:
          </div>
          <p className="text-sm text-blue-700 mt-1">{currentTodo.content}</p>
        </div>
      )}
    </div>
  );
}