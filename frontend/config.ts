// The Clerk publishable key, to initialize Clerk.
// Note: Set CLERK_PUBLISHABLE_KEY environment variable in hosting dashboard
// For production, use pk_live_... keys to avoid rate limits
export const clerkPublishableKey = 
  process.env.CLERK_PUBLISHABLE_KEY || 
  "pk_test_bWVldC1saW9uZXNzLTEzLmNsZXJrLmFjY291bnRzLmRldiQ";

// API base URL for backend calls
export const apiBaseUrl = 
  process.env.API_BASE_URL || 
  "https://multi-agent-ai-development-platform-d3ac6ek82vji7q8c7gmg.lp.dev";

// Auto-automation settings (default enabled for competitive parity)
export const config = {
  defaultAutoApply: true, // Auto-apply file changes by default
  defaultAutoBuild: true, // Auto-build projects by default  
  defaultAutoPreview: true, // Auto-preview after builds by default
  offlineMode: false, // Set to true to disable network features (WebSocket, API calls)
  previewPort: 3635, // Default port for preview server
  enablePreviewProxy: true, // Enable preview proxy for development
};
