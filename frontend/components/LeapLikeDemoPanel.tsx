import React, { useState } from 'react';
import { Play, RefreshCw, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LeapStyleTodo from './LeapStyleTodo';
import { LeapStyleExecutor, TodoItem } from '../lib/LeapStyleExecutor';

export default function LeapLikeDemoPanel() {
  const [demoMessage, setDemoMessage] = useState("Create a React todo app with TypeScript");
  const [executor, setExecutor] = useState<LeapStyleExecutor | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionComplete, setExecutionComplete] = useState(false);

  const startDemo = () => {
    if (isExecuting) return;

    const newExecutor = new LeapStyleExecutor({
      onTodoUpdate: (updatedTodos) => {
        setTodos(updatedTodos);
      },
      onStepComplete: (step, result) => {
        console.log(`✅ Demo step completed: ${step.description}`, result);
      },
      onStepError: (step, error) => {
        console.error(`❌ Demo step failed: ${step.description}`, error);
      }
    });

    setExecutor(newExecutor);
    const todoList = newExecutor.createExecutionPlan(demoMessage);
    setTodos(todoList);
    setExecutionComplete(false);

    // Start auto-execution
    setIsExecuting(true);
    executeDemo(newExecutor);
  };

  const executeDemo = async (executor: LeapStyleExecutor) => {
    try {
      await executor.executeAll(2500); // 2.5 second delays
      setExecutionComplete(true);
    } catch (error) {
      console.error('Demo execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const resetDemo = () => {
    setTodos([]);
    setExecutor(null);
    setIsExecuting(false);
    setExecutionComplete(false);
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg bg-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Play className="h-5 w-5" />
            Leap-Style AI Execution Demo
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            See exactly how Leap works step-by-step with visual progress tracking
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={demoMessage}
              onChange={(e) => setDemoMessage(e.target.value)}
              placeholder="What would you like me to build?"
              disabled={isExecuting}
            />
            <Button 
              onClick={startDemo} 
              disabled={isExecuting || !demoMessage.trim()}
            >
              {isExecuting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-pulse" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Demo
                </>
              )}
            </Button>
            {todos.length > 0 && (
              <Button variant="outline" onClick={resetDemo}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
          </div>

          {executionComplete && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Demo execution completed! This is exactly how Leap works.
              </span>
            </div>
          )}
        </div>
      </div>

      {todos.length > 0 && (
        <div className="border rounded-lg bg-card">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Live Execution Progress</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Watch the step-by-step execution just like when you interact with Leap
            </p>
          </div>
          <div className="p-6">
            <LeapStyleTodo
              todos={todos}
              onUpdateTodo={() => {}} // Read-only for demo
              onExecuteNext={() => {
                if (executor && !isExecuting) {
                  setIsExecuting(true);
                  executor.executeNextStep().then((hasMore) => {
                    if (!hasMore) {
                      setExecutionComplete(true);
                    }
                    setIsExecuting(false);
                  });
                }
              }}
              isExecuting={isExecuting}
            />
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-blue-50 border-blue-200">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">How This Makes Your App Work Like Leap</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Step-by-step execution:</strong> Each task is broken down and executed individually</li>
                <li>• <strong>Visual progress:</strong> You see exactly what's happening at each step</li>
                <li>• <strong>Real-time updates:</strong> Todo list updates live as work progresses</li>
                <li>• <strong>Methodical approach:</strong> Like Leap, it plans first, then executes systematically</li>
                <li>• <strong>Error handling:</strong> If one step fails, it continues with the next</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}