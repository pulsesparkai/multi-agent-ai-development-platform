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
      
      console.log(`Executing AI step ${stepIndex + 1}: ${stepDescription}`);
      
      // Call your enhanced chat API with step-specific instructions
      const response = await this.apiClient.ai.enhancedChat({
        projectId: this.projectId,
        message: stepPrompt,
        provider: this.provider,
        autoApply: stepIndex >= 5, // Only auto-apply in later steps
        autoBuild: stepIndex >= 6,  // Only build near the end
        autoPreview: stepIndex >= 7 // Only preview at the very end
      });

      return {
        stepIndex,
        stepDescription,
        aiResponse: response.message.content,
        filesChanged: response.filesChanged || [],
        buildStarted: response.buildStarted,
        previewUrl: response.previewUrl,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`AI step ${stepIndex + 1} failed:`, error);
      throw error;
    }
  }

  private createStepPrompt(stepDescription: string, stepIndex: number, totalSteps: number): string {
    const baseContext = `
Original user request: "${this.userMessage}"

This is step ${stepIndex + 1} of ${totalSteps} in a methodical implementation process.
Current step focus: ${stepDescription}

Please focus ONLY on this specific step. Do not implement the entire solution at once.
`;

    // Step-specific instructions
    const stepInstructions: Record<number, string> = {
      0: `${baseContext}
For this planning step:
- Analyze the user's request in detail
- Plan the overall structure and approach
- Identify what files and components will be needed
- Create a mental model of the solution
- DO NOT generate any code yet, just plan and explain your approach`,

      1: `${baseContext}
For this file generation step:
- Generate the core HTML structure
- Create basic CSS styling foundation
- Set up the main JavaScript/TypeScript files
- Focus on the essential file structure only
- Include proper package.json and config files`,

      2: `${baseContext}
For this component step:
- Create reusable components based on the plan
- Implement component logic and structure
- Focus on component architecture and modularity
- Build components that work together`,

      3: `${baseContext}
For this styling step:
- Implement comprehensive CSS/styling
- Add responsive design and layout
- Include visual polish and design elements
- Make the interface look professional`,

      4: `${baseContext}
For this functionality step:
- Add interactive features and behavior
- Implement business logic and state management
- Add event handlers and user interactions
- Make the application fully functional`,

      5: `${baseContext}
For this application step:
- Apply all generated files to the workspace
- Ensure file structure is correct
- Prepare for building phase`,

      6: `${baseContext}
For this build step:
- Build and compile the application
- Resolve any build errors or issues
- Ensure everything compiles correctly`,

      7: `${baseContext}
For this preview step:
- Start the preview server
- Test that everything works
- Provide final verification`
    };

    return stepInstructions[stepIndex] || `${baseContext}
Execute: ${stepDescription}
Focus only on this specific aspect of the implementation.`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}