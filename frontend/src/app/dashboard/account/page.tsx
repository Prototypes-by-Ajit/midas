"use client";

export const dynamic = "force-dynamic"
export const revalidate = 0


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  IconUser, 
  IconMail, 
  IconPhone, 
  IconMapPin, 
  IconShield, 
  IconEdit,
  IconCamera,
  IconLoader2,
  IconCheck
} from "@tabler/icons-react"
import { useUser } from "@clerk/nextjs"
import React, { useState, useCallback } from "react"
import { toast } from "sonner"

export default function AccountPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
    bio: ''
  });

  // Form validation (moved to top level)
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    
    if (!formData.firstName.trim()) {
      errors.push('First name is required');
    }
    if (!formData.lastName.trim()) {
      errors.push('Last name is required');
    }
    if (formData.phone && !/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/[\s()-]/g, ''))) {
      errors.push('Please enter a valid phone number');
    }
    
    return errors;
  }, [formData]);

  // Handle form submission (moved to top level)
  const handleSaveProfile = useCallback(async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(errors.join(', '));
      return;
    }

    setIsLoading(true);
    try {
      // Update user profile via Clerk
      await user?.update({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      // Note: Metadata updates require server-side API calls
      // For now, we'll just update the basic profile info
      console.log('Metadata would be updated:', { location: formData.location, bio: formData.bio });

      // Update phone number if provided
      if (user && formData.phone && formData.phone !== user.phoneNumbers?.[0]?.phoneNumber) {
        try {
          await user.createPhoneNumber({ phoneNumber: formData.phone });
        } catch (error) {
          console.warn('Phone number update failed:', error);
        }
      }

      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, user, validateForm]);

  // Handle form input changes (moved to top level)
  const handleInputChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Initialize form data when user data is loaded (moved to top level)
  React.useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phoneNumbers?.[0]?.phoneNumber || '',
        location: (user.publicMetadata?.location as string) || '',
        bio: (user.publicMetadata?.bio as string) || ''
      });
    }
  }, [user]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="flex items-center gap-2 text-black dark:text-white">
          <IconLoader2 className="h-6 w-6 animate-spin" />
          <span>Loading account information...</span>
        </div>
      </div>
    );
  }

  // Not signed in state
  if (!isSignedIn || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">Please sign in to view your account information.</p>
        </div>
      </div>
    );
  }

  // Extract user information
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || user.fullName || 'User';
  const email = user.primaryEmailAddress?.emailAddress || '';
  const profileImage = user.imageUrl || '';
  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  }) : 'Unknown';
  const lastSignIn = user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Unknown';

  // Generate initials for avatar fallback
  const initials = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);


  return (
    <div className="flex flex-col gap-6 p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">Account Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Overview */}
        <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-black dark:text-white flex items-center gap-2">
              <IconUser className="h-5 w-5" />
              Profile Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileImage} alt={fullName} />
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white text-2xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <IconCamera className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-black dark:text-white">{fullName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{email}</p>
                <Badge className="mt-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {(user.publicMetadata?.role as string) || 'Professional'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Member since</span>
                <span className="text-sm text-black dark:text-white">{createdAt}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Last login</span>
                <span className="text-sm text-black dark:text-white">{lastSignIn}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Account status</span>
                <div className="flex items-center gap-1">
                  <IconShield className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Account ID</span>
                <span className="text-sm text-black dark:text-white font-mono text-xs">{user.id.slice(0, 8)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white">Personal Information</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-black dark:text-white">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="border-gray-300 dark:border-gray-700"
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-black dark:text-white">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="border-gray-300 dark:border-gray-700"
                    disabled={!isEditing}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-black dark:text-white">Email Address</Label>
                <div className="relative">
                  <IconMail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    defaultValue={email}
                    className="pl-10 border-gray-300 dark:border-gray-700"
                    disabled
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-black dark:text-white">Phone Number</Label>
                <div className="relative">
                  <IconPhone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="pl-10 border-gray-300 dark:border-gray-700"
                    disabled={!isEditing}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location" className="text-black dark:text-white">Location</Label>
                <div className="relative">
                  <IconMapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="location"
                    placeholder="Enter location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="pl-10 border-gray-300 dark:border-gray-700"
                    disabled={!isEditing}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-black dark:text-white">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="border-gray-300 dark:border-gray-700 min-h-[80px]"
                  disabled={!isEditing}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                {!isEditing ? (
                  <Button 
                    onClick={() => setIsEditing(true)}
                    className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  >
                    <IconEdit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                      className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      {isLoading ? (
                        <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <IconCheck className="h-4 w-4 mr-2" />
                      )}
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsEditing(false);
                        // Reset form data to original values
                        if (user) {
                          setFormData({
                            firstName: user.firstName || '',
                            lastName: user.lastName || '',
                            phone: user.phoneNumbers?.[0]?.phoneNumber || '',
                            location: (user.publicMetadata?.location as string) || '',
                            bio: (user.publicMetadata?.bio as string) || ''
                          });
                        }
                      }}
                      variant="outline" 
                      className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconShield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Manage your password and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-black dark:text-white">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-black dark:text-white">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-black dark:text-white">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
              
              <Button className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                Update Password
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}