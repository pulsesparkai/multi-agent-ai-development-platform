export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  timestamp?: Date;
  result?: any;
  error?: string;
}

export interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  action: () => Promise<any>;
  dependencies?: string[];
}

export class LeapStyleExecutor {
  protected todos: TodoItem[] = [];
  protected steps: ExecutionStep[] = [];
  protected currentStepIndex = 0;
  private isExecuting = false;
  private onTodoUpdate?: (todos: TodoItem[]) => void;
  private onStepComplete?: (step: ExecutionStep, result: any) => void;
  private onStepError?: (step: ExecutionStep, error: string) => void;

  constructor(options?: {
    onTodoUpdate?: (todos: TodoItem[]) => void;
    onStepComplete?: (step: ExecutionStep, result: any) => void;
    onStepError?: (step: ExecutionStep, error: string) => void;
  }) {
    this.onTodoUpdate = options?.onTodoUpdate;
    this.onStepComplete = options?.onStepComplete;
    this.onStepError = options?.onStepError;
  }

  // Initialize execution plan - like how I create todo lists
  createExecutionPlan(userMessage: string): TodoItem[] {
    // Parse user intent and create step-by-step plan
    const plan = this.parseUserIntent(userMessage);
    
    this.todos = plan.map(step => ({
      id: Math.random().toString(36).substr(2, 9),
      content: step,
      status: 'pending' as const
    }));

    this.steps = this.createExecutionSteps(plan);
    this.currentStepIndex = 0;
    
    this.notifyTodoUpdate();
    return this.todos;
  }

  // Execute next step - like how I work one task at a time
  async executeNextStep(): Promise<boolean> {
    if (this.isExecuting || this.currentStepIndex >= this.steps.length) {
      return false;
    }

    this.isExecuting = true;
    const step = this.steps[this.currentStepIndex];
    const todoItem = this.todos[this.currentStepIndex];

    try {
      // Mark as in progress
      todoItem.status = 'in_progress';
      todoItem.timestamp = new Date();
      this.notifyTodoUpdate();

      // Execute the step
      console.log(`Executing step: ${step.name}`);
      const result = await step.action();

      // Mark as completed
      todoItem.status = 'completed';
      todoItem.result = result;
      todoItem.timestamp = new Date();
      
      this.currentStepIndex++;
      this.notifyTodoUpdate();
      
      if (this.onStepComplete) {
        this.onStepComplete(step, result);
      }

      return this.currentStepIndex < this.steps.length;
    } catch (error) {
      // Mark as failed but don't stop execution
      todoItem.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Step failed: ${step.name}`, error);
      
      if (this.onStepError) {
        this.onStepError(step, todoItem.error);
      }

      this.currentStepIndex++;
      return this.currentStepIndex < this.steps.length;
    } finally {
      this.isExecuting = false;
    }
  }

  // Execute all steps with delays - like how I work methodically
  async executeAll(delayBetweenSteps = 1000): Promise<void> {
    while (await this.executeNextStep()) {
      // Add delay between steps for visual effect
      await new Promise(resolve => setTimeout(resolve, delayBetweenSteps));
    }
  }

  private parseUserIntent(message: string): string[] {
    // Simple intent parsing - in real implementation, use AI to break down tasks
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('create') && lowerMessage.includes('app')) {
      return [
        'Analyze user requirements and plan application structure',
        'Generate main application files (HTML, CSS, JS)',
        'Create component files and modules',
        'Set up build configuration and dependencies',
        'Apply files to project workspace',
        'Build and compile the application',
        'Start preview server and test functionality'
      ];
    }
    
    if (lowerMessage.includes('fix') || lowerMessage.includes('debug')) {
      return [
        'Identify the issue in the codebase',
        'Analyze error logs and symptoms',
        'Generate fix for the identified problem',
        'Apply the fix to relevant files',
        'Test the fix by rebuilding',
        'Verify the issue is resolved'
      ];
    }

    if (lowerMessage.includes('add') && lowerMessage.includes('feature')) {
      return [
        'Understand the requested feature requirements',
        'Design the feature architecture',
        'Generate new code for the feature',
        'Integrate feature with existing codebase',
        'Update configuration and dependencies',
        'Test the new feature functionality'
      ];
    }

    // Default generic plan
    return [
      'Analyze user request and requirements',
      'Plan implementation approach',
      'Generate necessary code and files',
      'Apply changes to project',
      'Build and test the implementation',
      'Verify results and provide feedback'
    ];
  }

  private createExecutionSteps(plan: string[]): ExecutionStep[] {
    // Convert plan into executable steps with real AI actions
    return plan.map((planItem, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: `Step ${index + 1}`,
      description: planItem,
      action: async () => {
        // This is where we'll integrate with your backend AI
        return await this.executeRealStep(planItem, index);
      }
    }));
  }

  private async executeRealStep(stepDescription: string, stepIndex: number): Promise<any> {
    // Placeholder for real AI integration
    // This should call your backend AI API with specific instructions for this step
    
    const stepActions: Record<number, () => Promise<any>> = {
      0: () => this.analyzeRequirements(),
      1: () => this.generateFiles(),
      2: () => this.createComponents(),
      3: () => this.setupBuild(),
      4: () => this.applyFiles(),
      5: () => this.buildProject(),
      6: () => this.startPreview()
    };

    const action = stepActions[stepIndex] || (() => this.defaultAction(stepDescription));
    return await action();
  }

  private async analyzeRequirements(): Promise<any> {
    // Simulate analyzing user requirements
    await new Promise(resolve => setTimeout(resolve, 800));
    return { action: 'analyzed', result: 'Requirements understood' };
  }

  private async generateFiles(): Promise<any> {
    // Simulate file generation
    await new Promise(resolve => setTimeout(resolve, 1200));
    return { action: 'generated', files: ['index.html', 'style.css', 'script.js'] };
  }

  private async createComponents(): Promise<any> {
    // Simulate component creation
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { action: 'created', components: ['Header', 'MainContent', 'Footer'] };
  }

  private async setupBuild(): Promise<any> {
    // Simulate build setup
    await new Promise(resolve => setTimeout(resolve, 600));
    return { action: 'configured', buildTool: 'vite' };
  }

  private async applyFiles(): Promise<any> {
    // Simulate applying files to workspace
    await new Promise(resolve => setTimeout(resolve, 800));
    return { action: 'applied', filesApplied: 3 };
  }

  private async buildProject(): Promise<any> {
    // Simulate building
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { action: 'built', status: 'success' };
  }

  private async startPreview(): Promise<any> {
    // Simulate preview server
    await new Promise(resolve => setTimeout(resolve, 700));
    return { action: 'preview', url: 'http://localhost:3000' };
  }

  private async defaultAction(description: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    return { stepCompleted: description, timestamp: new Date() };
  }

  protected notifyTodoUpdate() {
    if (this.onTodoUpdate) {
      this.onTodoUpdate([...this.todos]);
    }
  }

  // Getters
  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  isCurrentlyExecuting(): boolean {
    return this.isExecuting;
  }

  hasMoreSteps(): boolean {
    return this.currentStepIndex < this.steps.length;
  }

  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.todos.filter(t => t.status === 'completed').length;
    const total = this.todos.length;
    return {
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0
    };
  }
}