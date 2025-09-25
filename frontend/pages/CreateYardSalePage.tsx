import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Calendar, MapPin, Clock, User, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { CreateYardSaleRequest } from '~backend/yardsale/types';

export default function CreateYardSalePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<CreateYardSaleRequest>({
    title: '',
    description: '',
    address: '',
    city: 'Pittsburgh',
    zipCode: '',
    saleDate: new Date(),
    startTime: '',
    endTime: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    itemsPreview: ''
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateYardSaleRequest) => backend.yardsale.create(data),
    onSuccess: (yardsale) => {
      toast({
        title: "Yard sale created!",
        description: "Your yard sale listing has been posted successfully.",
      });
      navigate(`/yardsales/${yardsale.id}`);
    },
    onError: (error) => {
      console.error('Error creating yard sale:', error);
      toast({
        title: "Error",
        description: "Failed to create yard sale. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.address || !formData.saleDate) {
      toast({
        title: "Missing required fields",
        description: "Please fill in title, address, and sale date.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const handleChange = (field: keyof CreateYardSaleRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button
        variant="outline"
        onClick={() => navigate('/')}
        className="mb-6 flex items-center space-x-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Browse</span>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Post a Yard Sale</CardTitle>
          <p className="text-gray-600">
            Create a listing to let people know about your upcoming yard sale
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Package className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </div>
              
              <div>
                <Label htmlFor="title">Sale Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Multi-Family Garage Sale"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Brief description of your sale"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="itemsPreview">Items Available</Label>
                <Textarea
                  id="itemsPreview"
                  value={formData.itemsPreview}
                  onChange={(e) => handleChange('itemsPreview', e.target.value)}
                  placeholder="List some of the items you'll be selling (e.g., furniture, clothes, electronics, books, toys)"
                  rows={3}
                />
              </div>
            </div>

            {/* Date and Time */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Date & Time</h3>
              </div>
              
              <div>
                <Label htmlFor="saleDate">Sale Date *</Label>
                <Input
                  id="saleDate"
                  type="date"
                  value={formatDateForInput(formData.saleDate)}
                  onChange={(e) => handleChange('saleDate', new Date(e.target.value))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleChange('startTime', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleChange('endTime', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Location</h3>
              </div>
              
              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="123 Main Street"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => handleChange('zipCode', e.target.value)}
                    placeholder="15213"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Contact Information</h3>
              </div>
              
              <div>
                <Label htmlFor="contactName">Your Name</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <Label htmlFor="contactPhone">Phone Number</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="(412) 555-0123"
                />
              </div>
              
              <div>
                <Label htmlFor="contactEmail">Email Address</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? 'Creating...' : 'Post Yard Sale'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
