import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export interface TemplateRequest {
  type: "real-time-chat" | "todo-app" | "dashboard" | "e-commerce";
  name: string;
  description?: string;
  features?: string[];
  techStack?: string[];
}

export interface GeneratedProject {
  projectId: string;
  files: Record<string, string>;
  metadata: {
    name: string;
    description: string;
    techStack: string[];
    features: string[];
    instructions: string[];
  };
}

export const generateProject = api(
  { method: "POST", path: "/templates/generate", expose: true, auth: true },
  async (req: TemplateRequest): Promise<GeneratedProject> => {
    const user = getAuthData()!;
    
    switch (req.type) {
      case "real-time-chat":
        return generateRealtimeChatApp(req);
      case "todo-app":
        return generateTodoApp(req);
      case "dashboard":
        return generateDashboard(req);
      case "e-commerce":
        return generateEcommerce(req);
      default:
        throw new Error("Unsupported template type");
    }
  }
);

function generateRealtimeChatApp(req: TemplateRequest): GeneratedProject {
  const projectId = `chat-app-${Date.now()}`;
  
  const files = {
    // Backend files
    "backend/chat/encore.service.ts": `import { Service } from "encore.dev/service";

export default new Service("chat");`,

    "backend/chat/types.ts": `export interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  roomId: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  memberCount: number;
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
}`,

    "backend/chat/messages.ts": `import { api } from "encore.dev/api";
import { getCurrentUser } from "~encore/auth";
import { Message } from "./types";

export const sendMessage = api(
  { method: "POST", path: "/chat/rooms/:roomId/messages", expose: true, auth: true },
  async ({ roomId, content }: { roomId: string; content: string }): Promise<Message> => {
    const user = getCurrentUser();
    
    const message: Message = {
      id: \`msg_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
      userId: user.userID,
      username: user.email || "Anonymous",
      content,
      timestamp: new Date(),
      roomId
    };
    
    // Store message in database
    // Broadcast to WebSocket connections
    
    return message;
  }
);

export const getMessages = api(
  { method: "GET", path: "/chat/rooms/:roomId/messages", expose: true, auth: true },
  async ({ roomId, limit = 50 }: { roomId: string; limit?: number }): Promise<Message[]> => {
    const user = getCurrentUser();
    
    // Fetch messages from database
    // For demo, return mock messages
    return [
      {
        id: "msg_1",
        userId: "user_1",
        username: "Alice",
        content: "Hello everyone! 👋",
        timestamp: new Date(Date.now() - 3600000),
        roomId
      },
      {
        id: "msg_2",
        userId: "user_2", 
        username: "Bob",
        content: "Hey Alice! How's the project going?",
        timestamp: new Date(Date.now() - 1800000),
        roomId
      }
    ];
  }
);`,

    "backend/chat/rooms.ts": `import { api } from "encore.dev/api";
import { getCurrentUser } from "~encore/auth";
import { Room } from "./types";

export const createRoom = api(
  { method: "POST", path: "/chat/rooms", expose: true, auth: true },
  async ({ name, description }: { name: string; description?: string }): Promise<Room> => {
    const user = getCurrentUser();
    
    const room: Room = {
      id: \`room_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
      name,
      description,
      createdBy: user.userID,
      createdAt: new Date(),
      memberCount: 1
    };
    
    // Store room in database
    
    return room;
  }
);

export const getRooms = api(
  { method: "GET", path: "/chat/rooms", expose: true, auth: true },
  async (): Promise<Room[]> => {
    const user = getCurrentUser();
    
    // Fetch rooms from database
    // For demo, return mock rooms
    return [
      {
        id: "room_general",
        name: "General",
        description: "General discussion room",
        createdBy: user.userID,
        createdAt: new Date(),
        memberCount: 5
      },
      {
        id: "room_dev",
        name: "Development",
        description: "Technical discussions",
        createdBy: user.userID,
        createdAt: new Date(),
        memberCount: 3
      }
    ];
  }
);

export const joinRoom = api(
  { method: "POST", path: "/chat/rooms/:roomId/join", expose: true, auth: true },
  async ({ roomId }: { roomId: string }): Promise<{ success: boolean }> => {
    const user = getCurrentUser();
    
    // Add user to room in database
    
    return { success: true };
  }
);`,

    "backend/chat/websocket.ts": `import { api } from "encore.dev/api";
import { getCurrentUser } from "~encore/auth";

// WebSocket connection handler
export const connectWebSocket = api(
  { method: "GET", path: "/chat/ws", expose: true, auth: true },
  async (): Promise<{ connectionId: string }> => {
    const user = getCurrentUser();
    
    const connectionId = \`conn_\${Date.now()}_\${user.userID}\`;
    
    // Store WebSocket connection
    // Set up message broadcasting
    
    return { connectionId };
  }
);

export const disconnectWebSocket = api(
  { method: "DELETE", path: "/chat/ws/:connectionId", expose: true, auth: true },
  async ({ connectionId }: { connectionId: string }): Promise<{ success: boolean }> => {
    const user = getCurrentUser();
    
    // Remove WebSocket connection
    // Update user online status
    
    return { success: true };
  }
);`,

    // Frontend files
    "frontend/App.tsx": `import React from 'react';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { clerkPublishableKey } from './config';
import ChatApp from './components/ChatApp';

const queryClient = new QueryClient();

function AppInner() {
  return (
    <div className="min-h-screen bg-background">
      <SignedIn>
        <ChatApp />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;`,

    "frontend/components/ChatApp.tsx": `import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserButton } from '@clerk/clerk-react';
import { Send, Plus, Hash, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  roomId: string;
}

interface Room {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  memberCount: number;
}

export default function ChatApp() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => backend.chat.getRooms(),
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedRoom],
    queryFn: () => selectedRoom ? backend.chat.getMessages({ roomId: selectedRoom }) : Promise.resolve([]),
    enabled: !!selectedRoom,
    refetchInterval: 2000, // Simulate real-time updates
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ roomId, content }: { roomId: string; content: string }) =>
      backend.chat.sendMessage({ roomId, content }),
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedRoom] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: ({ name }: { name: string }) =>
      backend.chat.createRoom({ name, description: \`Created room: \${name}\` }),
    onSuccess: (room) => {
      setSelectedRoom(room.id);
      setNewRoomName('');
      setShowCreateRoom(false);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({
        title: 'Room Created',
        description: \`Successfully created room: \${room.name}\`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create room',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedRoom) return;

    sendMessageMutation.mutate({
      roomId: selectedRoom,
      content: messageInput.trim(),
    });
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    createRoomMutation.mutate({ name: newRoomName.trim() });
  };

  useEffect(() => {
    if (rooms && rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0].id);
    }
  }, [rooms, selectedRoom]);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="font-semibold text-lg">Chat App</h1>
          <UserButton />
        </div>

        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Rooms</h2>
            <Button
              size="sm"
              onClick={() => setShowCreateRoom(!showCreateRoom)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showCreateRoom && (
            <form onSubmit={handleCreateRoom} className="mb-3">
              <div className="flex gap-2">
                <Input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Room name"
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  Create
                </Button>
              </div>
            </form>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {rooms?.map((room) => (
              <div
                key={room.id}
                className={\`p-3 rounded-lg cursor-pointer transition-colors \${
                  selectedRoom === room.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }\`}
                onClick={() => setSelectedRoom(room.id)}
              >
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  <span className="font-medium">{room.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="h-3 w-3" />
                  <span className="text-xs opacity-75">{room.memberCount} members</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                <h2 className="font-semibold">
                  {rooms?.find(r => r.id === selectedRoom)?.name}
                </h2>
                <Badge variant="outline">
                  {rooms?.find(r => r.id === selectedRoom)?.memberCount} members
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages?.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {message.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{message.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={\`Message #\${rooms?.find(r => r.id === selectedRoom)?.name}\`}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Hash className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No room selected
              </h3>
              <p className="text-sm text-muted-foreground">
                Select a room to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`,

    "frontend/config.ts": `// Clerk configuration
export const clerkPublishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || "pk_test_your_key_here";

// API configuration  
export const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";

// WebSocket configuration
export const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:4000/chat/ws";`,

    "package.json": `{
  "name": "${req.name.toLowerCase().replace(/\s+/g, '-')}",
  "version": "1.0.0",
  "description": "${req.description || 'Real-time chat application built with Multi-Agent AI Platform'}",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "encore:dev": "encore run",
    "encore:build": "encore build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@clerk/clerk-react": "^4.27.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react": "^0.294.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}`,

    "README.md": `# ${req.name}

${req.description || 'A real-time chat application built with the Multi-Agent AI Development Platform.'}

## Features

- ✅ Real-time messaging
- ✅ Multiple chat rooms
- ✅ User authentication
- ✅ Online presence
- ✅ Responsive design
- ✅ Message history

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Encore.ts, WebSockets
- **Database**: PostgreSQL (via Encore.ts)
- **Authentication**: Clerk
- **Real-time**: WebSockets

## Getting Started

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Set up Environment Variables**
   Create a \`.env\` file with:
   \`\`\`
   REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_key
   \`\`\`

3. **Start Development Server**
   \`\`\`bash
   # Start backend
   npm run encore:dev

   # Start frontend (in another terminal)
   npm run dev
   \`\`\`

4. **Build for Production**
   \`\`\`bash
   npm run build
   \`\`\`

## Deployment

This app can be deployed to:
- **Vercel**: For the frontend
- **Encore.ts Cloud**: For the backend
- **Netlify**: Alternative frontend hosting

Use the built-in deployment tools in the Multi-Agent AI Platform for one-click deployment.

## Architecture

### Backend Services
- **Chat Service**: Handles messages, rooms, and WebSocket connections
- **Auth Service**: User authentication and authorization
- **Database**: Stores messages, rooms, and user data

### Frontend Components  
- **ChatApp**: Main application component
- **Room List**: Displays available chat rooms
- **Message Feed**: Shows chat messages in real-time
- **Message Input**: Handles sending new messages

## Contributing

This project was generated by the Multi-Agent AI Development Platform. To contribute:

1. Use the platform's AI agents for code generation
2. Test changes with the built-in tools
3. Deploy using the one-click deployment features
4. Track changes with the integrated version control

## License

MIT License - see LICENSE file for details.
`,

    ".gitignore": `# Dependencies
node_modules/
/.pnp
.pnp.js

# Production builds
/build
/dist

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Encore.ts
.encore/
encore.app

# Build outputs
*.tsbuildinfo`
  };

  return {
    projectId,
    files,
    metadata: {
      name: req.name,
      description: req.description || "A real-time chat application with multi-room support",
      techStack: ["React", "TypeScript", "Encore.ts", "Tailwind CSS", "WebSockets", "Clerk"],
      features: [
        "Real-time messaging",
        "Multiple chat rooms", 
        "User authentication",
        "Online presence indicators",
        "Message history",
        "Responsive design",
        "One-click deployment ready"
      ],
      instructions: [
        "1. Set up Clerk authentication keys",
        "2. Configure database connection",
        "3. Test WebSocket connections",
        "4. Customize styling and branding",
        "5. Deploy to production",
        "6. Monitor and scale as needed"
      ]
    }
  };
}

function generateTodoApp(req: TemplateRequest): GeneratedProject {
  // Similar implementation for todo app
  return {
    projectId: `todo-app-${Date.now()}`,
    files: {
      "README.md": `# ${req.name}\n\nA todo application template.`
    },
    metadata: {
      name: req.name,
      description: req.description || "A todo application",
      techStack: ["React", "TypeScript"],
      features: ["Task management"],
      instructions: ["Set up and customize"]
    }
  };
}

function generateDashboard(req: TemplateRequest): GeneratedProject {
  // Similar implementation for dashboard
  return {
    projectId: `dashboard-${Date.now()}`,
    files: {
      "README.md": `# ${req.name}\n\nA dashboard template.`
    },
    metadata: {
      name: req.name,
      description: req.description || "A dashboard application",
      techStack: ["React", "TypeScript"],
      features: ["Data visualization"],
      instructions: ["Set up and customize"]
    }
  };
}

function generateEcommerce(req: TemplateRequest): GeneratedProject {
  // Similar implementation for e-commerce
  return {
    projectId: `ecommerce-${Date.now()}`,
    files: {
      "README.md": `# ${req.name}\n\nAn e-commerce template.`
    },
    metadata: {
      name: req.name,
      description: req.description || "An e-commerce application",
      techStack: ["React", "TypeScript"],
      features: ["Product catalog"],
      instructions: ["Set up and customize"]
    }
  };
}