import { api } from "encore.dev/api";

export interface HelpTopic {
  id: string;
  title: string;
  category: "getting-started" | "features" | "troubleshooting" | "api" | "examples";
  content: string;
  tags: string[];
  lastUpdated: Date;
}

export interface SearchResult {
  topic: HelpTopic;
  relevanceScore: number;
  matchedContent: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting Started with Multi-Agent AI Development",
    category: "getting-started",
    content: `
# Getting Started

Welcome to the Multi-Agent AI Development Platform! This guide will help you create your first project.

## Creating a New Project

1. Click the "New Project" button in the dashboard
2. Choose a project name and description
3. Select your preferred AI agents and models
4. Start coding with AI assistance

## Working with Agents

Our platform supports multiple AI agents that can work together:

- **Code Generator**: Creates complete applications and components
- **Code Reviewer**: Analyzes and improves existing code
- **Documentation Writer**: Generates comprehensive documentation
- **Debugger**: Identifies and fixes issues in your code

## Key Features

- **Real-time Collaboration**: Multiple agents can work on the same project
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **One-click Deployment**: Deploy to Vercel, Netlify, or GitHub Pages
- **Version Control**: Integrated Git support with GitHub
- **Offline Mode**: Work without an internet connection
    `,
    tags: ["introduction", "basics", "setup"],
    lastUpdated: new Date()
  },
  {
    id: "agents-setup",
    title: "Configuring AI Agents",
    category: "features",
    content: `
# Configuring AI Agents

Learn how to set up and customize AI agents for your development workflow.

## Supported Models

- **OpenAI GPT-4**: Best for complex reasoning and code generation
- **Claude**: Excellent for code review and documentation
- **Local Models**: Use Ollama for privacy-focused development

## Agent Roles

Each agent can be assigned specific roles:

- **Primary Developer**: Main coding and architecture decisions
- **Quality Assurance**: Code review and testing
- **Documentation**: Writing docs and comments
- **DevOps**: Deployment and infrastructure

## Configuration Tips

1. Start with 2-3 agents for simpler projects
2. Use different models for different strengths
3. Set clear role boundaries to avoid conflicts
4. Monitor token usage and costs
    `,
    tags: ["agents", "configuration", "models"],
    lastUpdated: new Date()
  },
  {
    id: "deployment-guide",
    title: "Deploying Your Project",
    category: "features",
    content: `
# Deployment Guide

Deploy your projects to popular hosting platforms with one click.

## Supported Platforms

### Vercel
1. Connect your Vercel account
2. Configure build settings
3. Click "Deploy to Vercel"

### Netlify
1. Provide Netlify access token
2. Set up build command and output directory
3. Deploy with automatic SSL

### GitHub Pages
1. Push to GitHub repository first
2. Enable GitHub Pages in repository settings
3. Deploy static sites automatically

## Environment Variables

Set up environment variables for production:
- API keys for external services
- Database connection strings
- Feature flags

## Best Practices

- Test locally before deploying
- Use environment-specific configurations
- Monitor deployment logs
- Set up automatic deployments with Git
    `,
    tags: ["deployment", "hosting", "production"],
    lastUpdated: new Date()
  },
  {
    id: "offline-mode",
    title: "Working Offline",
    category: "features",
    content: `
# Offline Mode

Continue developing even without an internet connection.

## Features Available Offline

- Code editing with Monaco Editor
- Local project storage in IndexedDB
- File management and navigation
- Basic syntax highlighting and validation

## Setting Up Offline Mode

1. Enable offline mode in project settings
2. Download project files locally
3. Configure local LLM (optional)

## Local LLM Setup

For AI assistance offline:

1. Install Ollama or similar local LLM
2. Configure endpoint in settings
3. Download models you want to use
4. Test connection and performance

## Syncing Changes

When back online:
1. Review local changes
2. Resolve any conflicts
3. Sync with server
4. Push to version control
    `,
    tags: ["offline", "local", "sync"],
    lastUpdated: new Date()
  },
  {
    id: "troubleshooting",
    title: "Common Issues and Solutions",
    category: "troubleshooting",
    content: `
# Troubleshooting

Solutions to common problems you might encounter.

## Build Errors

**Problem**: TypeScript compilation errors
**Solution**: Check type definitions and imports

**Problem**: Missing dependencies
**Solution**: Verify package.json and install missing packages

## Deployment Issues

**Problem**: Deployment fails with authentication error
**Solution**: Refresh your platform access tokens

**Problem**: Build succeeds locally but fails on platform
**Solution**: Check environment variables and build settings

## Agent Problems

**Problem**: Agents not responding
**Solution**: Check API keys and rate limits

**Problem**: Conflicting agent outputs
**Solution**: Review agent roles and reduce overlap

## Performance Issues

**Problem**: Slow editor performance
**Solution**: Enable offline mode or reduce file size

**Problem**: High token usage
**Solution**: Set budget limits and optimize prompts

## Getting Help

- Check the documentation thoroughly
- Search existing issues and solutions
- Contact support with detailed error messages
- Share project details for faster resolution
    `,
    tags: ["troubleshooting", "errors", "support"],
    lastUpdated: new Date()
  }
];

export interface SearchResponse {
  results: SearchResult[];
}

export const searchHelp = api(
  { method: "GET", path: "/help/search", expose: true },
  async ({ query, category }: { query?: string; category?: string }): Promise<SearchResponse> => {
    let topics = HELP_TOPICS;
    
    if (category) {
      topics = topics.filter(topic => topic.category === category);
    }
    
    if (!query) {
      return {
        results: topics.map(topic => ({
          topic,
          relevanceScore: 1.0,
          matchedContent: topic.content.substring(0, 200) + "..."
        }))
      };
    }
    
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    
    for (const topic of topics) {
      let score = 0;
      let matchedContent = "";
      
      // Check title match
      if (topic.title.toLowerCase().includes(queryLower)) {
        score += 3;
        matchedContent = topic.title;
      }
      
      // Check tags match
      for (const tag of topic.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 2;
          matchedContent = matchedContent || `Tags: ${topic.tags.join(", ")}`;
        }
      }
      
      // Check content match
      const contentLower = topic.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        score += 1;
        
        // Find the sentence containing the query
        const sentences = topic.content.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(queryLower)) {
            matchedContent = matchedContent || sentence.trim() + "...";
            break;
          }
        }
      }
      
      if (score > 0) {
        results.push({
          topic,
          relevanceScore: score,
          matchedContent: matchedContent || topic.content.substring(0, 200) + "..."
        });
      }
    }
    
    return {
      results: results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    };
  }
);

export interface TopicResponse {
  topic: HelpTopic | null;
}

export const getHelpTopic = api(
  { method: "GET", path: "/help/topics/:id", expose: true },
  async ({ id }: { id: string }): Promise<TopicResponse> => {
    return {
      topic: HELP_TOPICS.find(topic => topic.id === id) || null
    };
  }
);

export interface CategoriesResponse {
  categories: { category: string; count: number; topics: string[] }[];
}

export const listCategories = api(
  { method: "GET", path: "/help/categories", expose: true },
  async (): Promise<CategoriesResponse> => {
    const categories = new Map<string, HelpTopic[]>();
    
    for (const topic of HELP_TOPICS) {
      if (!categories.has(topic.category)) {
        categories.set(topic.category, []);
      }
      categories.get(topic.category)!.push(topic);
    }
    
    return {
      categories: Array.from(categories.entries()).map(([category, topics]) => ({
        category,
        count: topics.length,
        topics: topics.map(t => t.title)
      }))
    };
  }
);