import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Calendar, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import YardSaleCard from '../components/YardSaleCard';
import backend from '~backend/client';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    zipCode: '',
    upcoming: true
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['yardsales', filters],
    queryFn: () => backend.yardsale.list({
      search: filters.search || undefined,
      zipCode: filters.zipCode || undefined,
      upcoming: filters.upcoming || undefined,
      limit: 50
    })
  });

  const handleSearch = () => {
    setFilters({
      search,
      zipCode,
      upcoming: upcomingOnly
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Find Yard Sales in Pittsburgh
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Discover amazing deals at local yard sales, garage sales, and estate sales
        </p>
        
        {/* Search Section */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2">
              <Search className="h-5 w-5" />
              <span>Search Yard Sales</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Search by items, keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Input
                placeholder="ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-32"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="upcoming"
                  checked={upcomingOnly}
                  onCheckedChange={(checked) => setUpcomingOnly(checked as boolean)}
                />
                <label htmlFor="upcoming" className="text-sm text-gray-600">
                  Show only upcoming sales
                </label>
              </div>
              
              <Button onClick={handleSearch} className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      <div>
        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading yard sales...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-600">Error loading yard sales. Please try again.</p>
          </div>
        )}

        {data && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {data.total} Yard Sale{data.total !== 1 ? 's' : ''} Found
              </h2>
            </div>

            {data.yardsales.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No yard sales found</p>
                  <p className="text-sm text-gray-500">
                    Try adjusting your search criteria or check back later for new listings
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.yardsales.map((yardsale) => (
                  <YardSaleCard key={yardsale.id} yardsale={yardsale} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
