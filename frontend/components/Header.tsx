import { Code, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Code className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">AI Development Platform</span>
          </div>
          
          <nav className="flex items-center space-x-4">
            <Button variant="ghost" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Multi-Agent</span>
            </Button>
            <Button className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
