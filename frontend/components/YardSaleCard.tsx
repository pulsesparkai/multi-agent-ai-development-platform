import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { YardSale } from '~backend/yardsale/types';

interface YardSaleCardProps {
  yardsale: YardSale;
}

export default function YardSaleCard({ yardsale }: YardSaleCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string | undefined) => {
    if (!time) return null;
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isUpcoming = new Date(yardsale.saleDate) >= new Date();

  return (
    <Link to={`/yardsales/${yardsale.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg line-clamp-2">{yardsale.title}</CardTitle>
            {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{formatDate(yardsale.saleDate)}</span>
          </div>
          
          {(yardsale.startTime || yardsale.endTime) && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>
                {yardsale.startTime && formatTime(yardsale.startTime)}
                {yardsale.startTime && yardsale.endTime && ' - '}
                {yardsale.endTime && formatTime(yardsale.endTime)}
              </span>
            </div>
          )}
          
          <div className="flex items-start text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {yardsale.address}, {yardsale.city}
              {yardsale.zipCode && ` ${yardsale.zipCode}`}
            </span>
          </div>
          
          {yardsale.itemsPreview && (
            <div className="text-sm text-gray-700">
              <p className="line-clamp-3">{yardsale.itemsPreview}</p>
            </div>
          )}
          
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {yardsale.contactPhone && (
              <div className="flex items-center">
                <Phone className="h-3 w-3 mr-1" />
                <span>Phone</span>
              </div>
            )}
            {yardsale.contactEmail && (
              <div className="flex items-center">
                <Mail className="h-3 w-3 mr-1" />
                <span>Email</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
