import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Clock, MapPin, Phone, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import backend from '~backend/client';

export default function YardSaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: yardsale, isLoading, error } = useQuery({
    queryKey: ['yardsale', id],
    queryFn: () => backend.yardsale.get({ id: parseInt(id!) }),
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading yard sale details...</p>
        </div>
      </div>
    );
  }

  if (error || !yardsale) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8">
          <p className="text-red-600">Yard sale not found or error loading details.</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button
        variant="outline"
        onClick={() => navigate('/')}
        className="mb-6 flex items-center space-x-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Browse</span>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-2xl">{yardsale.title}</CardTitle>
                {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center text-gray-700">
                  <Calendar className="h-5 w-5 mr-3 text-blue-600" />
                  <div>
                    <p className="font-medium">Date</p>
                    <p className="text-sm">{formatDate(yardsale.saleDate)}</p>
                  </div>
                </div>
                
                {(yardsale.startTime || yardsale.endTime) && (
                  <div className="flex items-center text-gray-700">
                    <Clock className="h-5 w-5 mr-3 text-blue-600" />
                    <div>
                      <p className="font-medium">Time</p>
                      <p className="text-sm">
                        {yardsale.startTime && formatTime(yardsale.startTime)}
                        {yardsale.startTime && yardsale.endTime && ' - '}
                        {yardsale.endTime && formatTime(yardsale.endTime)}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start text-gray-700 md:col-span-2">
                  <MapPin className="h-5 w-5 mr-3 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Location</p>
                    <p className="text-sm">
                      {yardsale.address}<br />
                      {yardsale.city}{yardsale.zipCode && `, ${yardsale.zipCode}`}
                    </p>
                  </div>
                </div>
              </div>
              
              {yardsale.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{yardsale.description}</p>
                </div>
              )}
              
              {yardsale.itemsPreview && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Items Available</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{yardsale.itemsPreview}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {yardsale.contactName && (
                <div>
                  <p className="font-medium text-gray-900">{yardsale.contactName}</p>
                </div>
              )}
              
              {yardsale.contactPhone && (
                <div className="flex items-center text-gray-700">
                  <Phone className="h-4 w-4 mr-2" />
                  <a
                    href={`tel:${yardsale.contactPhone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {yardsale.contactPhone}
                  </a>
                </div>
              )}
              
              {yardsale.contactEmail && (
                <div className="flex items-center text-gray-700">
                  <Mail className="h-4 w-4 mr-2" />
                  <a
                    href={`mailto:${yardsale.contactEmail}`}
                    className="text-blue-600 hover:underline break-all"
                  >
                    {yardsale.contactEmail}
                  </a>
                </div>
              )}
              
              {!yardsale.contactPhone && !yardsale.contactEmail && (
                <p className="text-gray-500 text-sm">
                  No contact information provided
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
