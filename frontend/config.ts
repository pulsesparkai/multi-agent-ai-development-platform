// The Clerk publishable key, to initialize Clerk.
// Note: Set CLERK_PUBLISHABLE_KEY environment variable in hosting dashboard
// For production, use pk_live_... keys to avoid rate limits
export const clerkPublishableKey = 
  process.env.CLERK_PUBLISHABLE_KEY || 
  "pk_live_clerkPublishableKey"; // Replace with actual production key

// API base URL for backend calls
export const apiBaseUrl = 
  process.env.API_BASE_URL || 
  "https://multi-agent-ai-development-platform-d3ac6ek82vji7q8c7gmg.lp.dev";
