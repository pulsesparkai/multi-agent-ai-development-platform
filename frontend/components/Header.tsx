import { Link } from 'react-router-dom';
import { MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <MapPin className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Pittsburgh Yard Sales</span>
          </Link>
          
          <nav className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost">Browse Sales</Button>
            </Link>
            <Link to="/create">
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Post Sale</span>
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
