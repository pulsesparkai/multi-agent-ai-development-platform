import React, { useState } from 'react';
import { ArrowRight, Bot, Code, Key, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import APIKeySettings from './APIKeySettings';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export default function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showAPIKeySetup, setShowAPIKeySetup] = useState(false);

  const steps = [
    {
      title: "Welcome to AI Dev Platform",
      description: "Your intelligent development companion",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <Bot className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome to AI Dev Platform</h2>
            <p className="text-muted-foreground mb-6">
              Build full-stack applications with the help of advanced AI assistants
            </p>
          </div>
          
          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Code className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">AI Code Generation</h3>
                <p className="text-sm text-blue-700">Generate complete applications from simple descriptions</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <Zap className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-900">Real-time Building</h3>
                <p className="text-sm text-green-700">Auto-apply, build, and preview your projects instantly</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <Bot className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-purple-900">Multi-Agent Teams</h3>
                <p className="text-sm text-purple-700">Collaborate with specialized AI agents for complex projects</p>
              </div>
            </div>
          </div>
          
          <Button onClick={() => setCurrentStep(1)} className="w-full">
            Get Started
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )
    },
    {
      title: "Set Up AI Providers",
      description: "Configure your AI API keys",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <Key className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Set Up AI Providers</h2>
            <p className="text-muted-foreground mb-6">
              To use the AI features, you'll need to configure at least one AI provider API key
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Recommended: Claude (Anthropic)</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Most reliable for code generation and follows instructions well
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.anthropic.com</a>
              </p>
              <p className="text-xs text-muted-foreground">
                • Create an account and add billing
                • Generate an API key in the console
                • Copy and paste it below
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowAPIKeySetup(true)}
                className="flex-1"
              >
                Configure API Keys
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "You're Ready!",
      description: "Start building amazing applications",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-6">
              Your AI development platform is ready to use
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-2">What you can do:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Create a new project or use the AI Website Builder</li>
                <li>• Chat with AI to generate code and components</li>
                <li>• Use auto-apply, auto-build, and auto-preview features</li>
                <li>• Deploy your applications with one click</li>
                <li>• Collaborate with multi-agent AI teams</li>
              </ul>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-1">💡 Pro Tip</h3>
              <p className="text-sm text-blue-700">
                Try saying "Create a React todo app with TypeScript" in the AI chat to see the magic happen!
              </p>
            </div>
          </div>
          
          <Button onClick={onComplete} className="w-full">
            Start Building
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )
    }
  ];

  if (showAPIKeySetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="border rounded-lg bg-card">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">API Key Setup</h2>
                  <p className="text-sm text-muted-foreground">Configure your AI provider keys</p>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowAPIKeySetup(false)}
                >
                  Back
                </Button>
              </div>
            </div>
            <div className="p-6">
              <APIKeySettings onClose={() => {
                setShowAPIKeySetup(false);
                setCurrentStep(2);
              }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="border rounded-lg bg-card">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index <= currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {currentStep + 1} of {steps.length}
              </span>
            </div>
            <h2 className="text-lg font-semibold">{currentStepData.title}</h2>
            <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
          </div>
          <div className="p-6">
            {currentStepData.content}
          </div>
        </div>
      </div>
    </div>
  );
}