import { LeapStyleExecutor, TodoItem, ExecutionStep } from '../lib/LeapStyleExecutor';

export interface AIStepExecutor {
  projectId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  apiClient: any; // Your backend client
  onProgress?: (step: string, progress: number) => void;
}

export class RealAIExecutor extends LeapStyleExecutor {
  private projectId: string;
  private provider: string;
  private apiClient: any;
  private userMessage: string = '';

  constructor(config: AIStepExecutor, options?: any) {
    super(options);
    this.projectId = config.projectId;
    this.provider = config.provider;
    this.apiClient = config.apiClient;
  }

  // Override to use real AI with step-by-step prompts
  createRealExecutionPlan(userMessage: string): TodoItem[] {
    this.userMessage = userMessage;
    
    // Break down the user request into specific, actionable steps
    const steps = this.createDetailedSteps(userMessage);
    
    this.todos = steps.map(step => ({
      id: this.generateId(),
      content: step,
      status: 'pending' as const
    }));

    this.steps = this.createRealExecutionSteps(steps);
    this.currentStepIndex = 0;
    
    this.notifyTodoUpdate();
    return this.todos;
  }

  private createDetailedSteps(userMessage: string): string[] {
    const lowerMessage = userMessage.toLowerCase();
    
    // More specific step breakdown based on request type
    if (lowerMessage.includes('create') || lowerMessage.includes('build')) {
      return [
        'Planning project structure and requirements',
        'Generating main application files',
        'Creating component architecture',
        'Setting up styling and design',
        'Adding interactivity and functionality',
        'Applying files to project workspace',
        'Building and compiling application',
        'Starting preview server'
      ];
    }
    
    if (lowerMessage.includes('add') || lowerMessage.includes('feature')) {
      return [
        'Understanding feature requirements',
        'Designing feature integration',
        'Generating new code components',
        'Updating existing files',
        'Testing feature compatibility',
        'Applying changes to project'
      ];
    }

    // Default steps
    return [
      'Analyzing request and planning approach',
      'Generating necessary code and files',
      'Optimizing and refining implementation', 
      'Applying changes to project workspace',
      'Testing and validating implementation'
    ];
  }

  private createRealExecutionSteps(steps: string[]): ExecutionStep[] {
    return steps.map((stepDescription, index) => ({
      id: this.generateId(),
      name: `Step ${index + 1}`,
      description: stepDescription,
      action: () => this.executeAIStep(stepDescription, index, steps.length)
    }));
  }

  private async executeAIStep(stepDescription: string, stepIndex: number, totalSteps: number): Promise<any> {
    try {
      // Create specific AI prompt for this step
      const stepPrompt = this.createStepPrompt(stepDescription, stepIndex, totalSteps);
      
      console.log('Executing AI step:', {
        stepIndex: stepIndex + 1,
        stepDescription,
        projectId: this.projectId,
        provider: this.provider,
        promptLength: stepPrompt.length
      });
      
      // Call your enhanced chat API with step-specific instructions
      const response = await this.apiClient.ai.enhancedChat({
        projectId: this.projectId,
        message: stepPrompt,
        provider: this.provider,
        autoApply: stepIndex >= 5, // Only auto-apply in later steps
        autoBuild: stepIndex >= 6,  // Only build near the end
        autoPreview: stepIndex >= 7 // Only preview at the very end
      });

      console.log('AI step response received:', {
        stepIndex: stepIndex + 1,
        hasMessage: !!response.message,
        messageLength: response.message?.content?.length,
        filesChanged: response.filesChanged?.length || 0,
        buildStarted: response.buildStarted,
        hasPreviewUrl: !!response.previewUrl,
        errors: response.errors?.length || 0
      });

      // Handle the response properly
      if (response.filesChanged && response.filesChanged.length > 0) {
        return {
          stepIndex,
          stepDescription,
          aiResponse: response.message.content,
          filesChanged: response.filesChanged,
          buildStarted: response.buildStarted,
          previewUrl: response.previewUrl,
          timestamp: new Date()
        };
      }

      // If no files changed but response exists, parse for file operations
      const fileOps = this.parseFileOperations(response.message.content);
      console.log('Parsed file operations:', { count: fileOps.length, files: fileOps.map(f => f.path) });
      
      if (fileOps.length > 0) {
        console.log('Manually applying file operations...');
        // Apply files manually if auto-apply failed
        const result = await this.apiClient.workspace.executeAIAction({
          projectId: this.projectId,
          sessionId: response.sessionId,
          action: 'generate_files',
          payload: { files: fileOps },
          source: 'ai_chat'
        });
        
        console.log('Manual file application result:', {
          success: result.success,
          changesCount: result.changes?.length || 0,
          error: result.error
        });
        
        return {
          stepIndex,
          stepDescription,
          aiResponse: response.message.content,
          filesChanged: result.changes?.map((c: any) => c.filePath) || [],
          buildStarted: response.buildStarted,
          previewUrl: response.previewUrl,
          timestamp: new Date()
        };
      }

      return {
        stepIndex,
        stepDescription,
        aiResponse: response.message.content,
        filesChanged: [],
        buildStarted: response.buildStarted,
        previewUrl: response.previewUrl,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('AI step execution failed:', {
        stepIndex: stepIndex + 1,
        stepDescription,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      // Check specific error types and provide better messages
      if (error instanceof Error) {
        if (error.message?.includes('API key') || error.message?.includes('unauthenticated')) {
          throw new Error(`API key issue for ${this.provider}: ${error.message}`);
        }
        
        if (error.message?.includes('internal error')) {
          throw new Error(`Backend service error: ${error.message}`);
        }
        
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          throw new Error(`Network error connecting to backend: ${error.message}`);
        }
      }
      
      // Don't fall back to demo - throw the actual error so we can debug
      throw error;
    }
  }

  private parseFileOperations(content: string): { path: string; content: string }[] {
    const operations: { path: string; content: string }[] = [];
    
    // Look for JSON code blocks with file operations
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let match;
    
    while ((match = jsonBlockRegex.exec(content)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);
        
        if (jsonData.files && Array.isArray(jsonData.files)) {
          for (const file of jsonData.files) {
            if (file.path && typeof file.content === 'string') {
              operations.push({
                path: file.path,
                content: file.content
              });
            }
          }
        }
      } catch (parseError) {
        console.error('Failed to parse JSON file operations:', parseError);
      }
    }
    
    return operations;
  }

  private createStepPrompt(stepDescription: string, stepIndex: number, totalSteps: number): string {
    const baseContext = `
Original user request: "${this.userMessage}"

This is step ${stepIndex + 1} of ${totalSteps} in a methodical implementation process.
Current step focus: ${stepDescription}

CRITICAL: You MUST generate actual code files using this exact JSON format at the end of your response:

\`\`\`json
{
  "files": [
    {
      "operation": "create",
      "path": "src/App.tsx",
      "content": "import React from 'react';\\n\\nfunction App() {\\n  return <div>Hello World</div>;\\n}\\n\\nexport default App;"
    }
  ]
}
\`\`\`

Include ALL necessary files for a working project.
`;

    // Step-specific instructions
    const stepInstructions: Record<number, string> = {
      0: `${baseContext}
For this planning step:
- Analyze the user's request in detail
- Plan the overall structure and approach
- Explain your approach but DO NOT generate any code yet
- This is planning only - code generation comes in later steps`,

      1: `${baseContext}
For this file generation step:
- Generate the core project structure files
- Create package.json with all necessary dependencies
- Generate index.html entry point
- Create main.tsx entry file
- Include vite.config.ts and other config files
- Focus ONLY on the essential project setup files`,

      2: `${baseContext}
For this component step:
- Create the main App.tsx component
- Generate component files based on the plan
- Build reusable components with proper TypeScript interfaces
- Focus on component architecture and structure`,

      3: `${baseContext}
For this styling step:
- Create comprehensive CSS/styling files
- Add Tailwind configuration if needed
- Include responsive design and modern UI
- Generate style files that make the app look professional`,

      4: `${baseContext}
For this functionality step:
- Add interactive features and business logic
- Implement state management and event handlers
- Create utility functions and hooks
- Make the application fully functional`,

      5: `${baseContext}
For this application step:
- Review and ensure all files are properly generated
- Add any missing configuration or utility files
- Prepare for building phase`,

      6: `${baseContext}
For this build step:
- Verify all files are in place for building
- Add any missing build configuration
- Ensure the project can compile successfully`,

      7: `${baseContext}
For this preview step:
- Final verification that everything is ready
- Add any final touches or missing pieces
- Ensure the application is ready for preview`
    };

    return stepInstructions[stepIndex] || `${baseContext}
Execute: ${stepDescription}
Generate the necessary files for this specific step.`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}