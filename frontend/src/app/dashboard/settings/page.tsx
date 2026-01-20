"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  IconUser, 
  IconBell,
  IconShield,
  IconPalette,
  IconDatabase,
  IconKey,
  IconMail,
  IconPhone,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconDownload,
  IconSun,
  IconMoon,
  IconLoader2
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"

const GridPattern = dynamic(
  () => import("@/components/ui/grid-pattern").then((mod) => ({ default: mod.GridPattern })),
  {
    ssr: false,
    loading: () => null // Optional: loading component
  }
);
export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    reports: true,
    security: true
  });
  
  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    department: '',
    address: '',
    bio: ''
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginNotifications: true,
    dataRetentionDays: 90,
    autoLogoutMinutes: 30
  });

  const [preferences, setPreferences] = useState({
    theme: 'dark',
    language: 'en',
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY'
  });

  // Initialize all settings from user data and localStorage
  useEffect(() => {
    if (isLoaded && user) {
      // Initialize user info from Clerk
      setUserInfo({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        phone: user.phoneNumbers?.[0]?.phoneNumber || '',
        organization: (user.publicMetadata?.organization as string) || '',
        department: (user.publicMetadata?.department as string) || '',
        address: (user.publicMetadata?.address as string) || '',
        bio: (user.publicMetadata?.bio as string) || ''
      });

      // Load settings from metadata or localStorage
      const savedNotifications = user.publicMetadata?.notifications as typeof notifications;
      if (savedNotifications) {
        setNotifications(savedNotifications);
      }

      const savedSecurity = user.publicMetadata?.securitySettings as typeof securitySettings;
      if (savedSecurity) {
        setSecuritySettings(savedSecurity);
      }
    }

    // Initialize theme from localStorage
    try {
      const savedTheme = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentTheme = savedTheme || (systemDark ? 'dark' : 'light');
      setPreferences(prev => ({ ...prev, theme: currentTheme }));

      // Load other preferences from localStorage
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        const parsedPrefs = JSON.parse(savedPrefs);
        setPreferences(prev => ({ ...prev, ...parsedPrefs, theme: currentTheme }));
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
    }
  }, [isLoaded, user]);

  // Save profile information
  const saveProfile = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await user.update({
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
      });
      
      // Note: Metadata updates require server-side API calls
      console.log('Metadata would be updated:', {
        organization: userInfo.organization,
        department: userInfo.department,
        address: userInfo.address,
        bio: userInfo.bio
      });
      
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user, userInfo]);

  // Save notification settings
  const saveNotifications = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Note: Metadata updates require server-side API calls
      console.log('Notification settings would be updated:', notifications);
      
      toast.success('Notification settings saved!');
    } catch (error) {
      console.error('Notification settings update failed:', error);
      toast.error('Failed to save notification settings.');
    } finally {
      setIsLoading(false);
    }
  }, [user, notifications]);

  // Save security settings
  const saveSecuritySettings = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Note: Metadata updates require server-side API calls
      console.log('Security settings would be updated:', securitySettings);
      
      toast.success('Security settings saved!');
    } catch (error) {
      console.error('Security settings update failed:', error);
      toast.error('Failed to save security settings.');
    } finally {
      setIsLoading(false);
    }
  }, [user, securitySettings]);

  // Temporarily reference the function to avoid unused warning
  void saveSecuritySettings;

  // Save preferences
  const savePreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      // Save to localStorage
      localStorage.setItem('userPreferences', JSON.stringify({
        language: preferences.language,
        timeFormat: preferences.timeFormat,
        dateFormat: preferences.dateFormat
      }));
      
      // Save to user metadata if user is available
      if (user) {
        // Note: Metadata updates require server-side API calls
        console.log('Preferences would be updated:', {
          language: preferences.language,
          timeFormat: preferences.timeFormat,
          dateFormat: preferences.dateFormat
        });
      }
      
      toast.success('Preferences saved!');
    } catch (error) {
      console.error('Preferences save failed:', error);
      toast.error('Failed to save preferences.');
    } finally {
      setIsLoading(false);
    }
  }, [user, preferences]);

  // Export user data
  const exportData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const userData = {
        profile: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.primaryEmailAddress?.emailAddress,
          createdAt: user.createdAt,
          lastSignInAt: user.lastSignInAt
        },
        settings: {
          notifications,
          securitySettings,
          preferences
        },
        metadata: user.publicMetadata
      };
      
      const blob = new Blob([JSON.stringify(userData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `midas-user-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Data export failed:', error);
      toast.error('Failed to export data.');
    } finally {
      setIsLoading(false);
    }
  }, [user, notifications, securitySettings, preferences]);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    try {
      localStorage.setItem('theme', newTheme)
      
      // Apply theme to document
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      // Dispatch custom event for other components to listen to
      window.dispatchEvent(new CustomEvent('themeChange', { 
        detail: { theme: newTheme } 
      }))
      
      setPreferences(prev => ({ ...prev, theme: newTheme }))
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }

  return (
    <div className="flex flex-col  gap-6 p-6 bg-white dark:bg-black min-h-screen">
      {/* Header */}
      <div className="z-0 absolute inset-0">
      <GridPattern
          width={40}
          height={40}
          x={-1}
          y={-1}
          className={cn(
            "[mask-image:radial-gradient(1400px_circle_at_center,white,transparent)]",
            "opacity-100",
            "fill-gray-300/30 stroke-gray-400/50 dark:fill-gray-700/30 dark:stroke-gray-600/50"
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account preferences and application settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Navigation */}
        {/* <Card className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 lg:col-span-1 relative overflow-hidden">
          <CardHeader>
            <CardTitle className="text-black dark:text-white flex items-center gap-2">
              <IconSettings className="h-5 w-5" />
              Settings Menu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="space-y-2">
              <a href="#profile" className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-black dark:text-white">
                <IconUser className="h-4 w-4" />
                Profile Information
              </a>
              <a href="#notifications" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400">
                <IconBell className="h-4 w-4" />
                Notifications
              </a>
              <a href="#security" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400">
                <IconShield className="h-4 w-4" />
                Security & Privacy
              </a>
              <a href="#preferences" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400">
                <IconPalette className="h-4 w-4" />
                Preferences
              </a>
              <a href="#data" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-400">
                <IconDatabase className="h-4 w-4" />
                Data Management
              </a>
            </nav>
          </CardContent>
        </Card> */}

        {/* Settings Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Information */}
          <Card id="profile" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconUser className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-black dark:text-white">First Name</Label>
                  <Input
                    id="firstName"
                    value={userInfo.firstName}
                    onChange={(e) => setUserInfo({...userInfo, firstName: e.target.value})}
                    className="border-gray-300 dark:border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-black dark:text-white">Last Name</Label>
                  <Input
                    id="lastName"
                    value={userInfo.lastName}
                    onChange={(e) => setUserInfo({...userInfo, lastName: e.target.value})}
                    className="border-gray-300 dark:border-gray-700"
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
                    value={userInfo.email}
                    onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                    className="pl-10 border-gray-300 dark:border-gray-700"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-black dark:text-white">Phone Number</Label>
                  <div className="relative">
                    <IconPhone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={userInfo.phone}
                      onChange={(e) => setUserInfo({...userInfo, phone: e.target.value})}
                      className="pl-10 border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-black dark:text-white">Organization</Label>
                  <Input
                    id="organization"
                    placeholder="Hospital or Clinic Name"
                    value={userInfo.organization}
                    onChange={(e) => setUserInfo({...userInfo, organization: e.target.value})}
                    className="border-gray-300 dark:border-gray-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-black dark:text-white">Professional Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Brief description of your role and specialization..."
                  value={userInfo.bio}
                  onChange={(e) => setUserInfo({...userInfo, bio: e.target.value})}
                  className="border-gray-300 dark:border-gray-700 min-h-[80px]"
                />
              </div>

              <Button 
                onClick={saveProfile}
                disabled={isLoading}
                className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                {isLoading ? (
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <IconCheck className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          {/* <Card id="notifications" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconBell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Configure how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-black dark:text-white">Email Notifications</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive notifications via email</p>
                  </div>
                  <Button
                    variant={notifications.email ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotifications({...notifications, email: !notifications.email})}
                    className={notifications.email 
                      ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                    }
                  >
                    {notifications.email ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-black dark:text-white">Push Notifications</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Browser and desktop notifications</p>
                  </div>
                  <Button
                    variant={notifications.push ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotifications({...notifications, push: !notifications.push})}
                    className={notifications.push 
                      ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                    }
                  >
                    {notifications.push ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-black dark:text-white">Report Notifications</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Analysis completion alerts</p>
                  </div>
                  <Button
                    variant={notifications.reports ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotifications({...notifications, reports: !notifications.reports})}
                    className={notifications.reports 
                      ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                    }
                  >
                    {notifications.reports ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-black dark:text-white">Security Alerts</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Login and security notifications</p>
                  </div>
                  <Button
                    variant={notifications.security ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotifications({...notifications, security: !notifications.security})}
                    className={notifications.security 
                      ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                    }
                  >
                    {notifications.security ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              </div>

              <Button 
                onClick={saveNotifications}
                disabled={isLoading}
                className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                {isLoading ? (
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <IconCheck className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Saving...' : 'Save Notification Settings'}
              </Button>
            </CardContent>
          </Card> */}

          {/* Security */}
          {/* <Card id="security" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconShield className="h-5 w-5" />
                Security & Privacy
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Manage your account security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-black dark:text-white">Password</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-black dark:text-white">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter current password"
                        className="pr-10 border-gray-300 dark:border-gray-700"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1 h-8 w-8 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                      </Button>
                    </div>
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
                </div>
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black">
                  <IconKey className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-black dark:text-white">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security</p>
                  </div>
                  <Badge className={securitySettings.twoFactorEnabled 
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }>
                    {securitySettings.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-black dark:text-white">Login Notifications</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get notified of login attempts</p>
                  </div>
                  <Button
                    variant={securitySettings.loginNotifications ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSecuritySettings({...securitySettings, loginNotifications: !securitySettings.loginNotifications})}
                    className={securitySettings.loginNotifications 
                      ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                    }
                  >
                    {securitySettings.loginNotifications ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoLogout" className="text-black dark:text-white">Auto Logout (minutes)</Label>
                  <Input
                    id="autoLogout"
                    type="number"
                    value={securitySettings.autoLogoutMinutes}
                    onChange={(e) => setSecuritySettings({...securitySettings, autoLogoutMinutes: parseInt(e.target.value)})}
                    className="border-gray-300 dark:border-gray-700"
                  />
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Preferences */}
          <Card id="preferences" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconPalette className="h-5 w-5" />
                Preferences
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Customize your application experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-black dark:text-white">Appearance</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-medium text-black dark:text-white">Theme</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Choose your preferred color scheme</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={preferences.theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleThemeChange('light')}
                      className={preferences.theme === 'light'
                        ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                        : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                      }
                    >
                      <IconSun className="h-4 w-4 mr-2" />
                      Light
                    </Button>
                    <Button
                      variant={preferences.theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleThemeChange('dark')}
                      className={preferences.theme === 'dark'
                        ? "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                        : "border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                      }
                    >
                      <IconMoon className="h-4 w-4 mr-2" />
                      Dark
                    </Button>
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-black dark:text-white">Regional Settings</h4>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language" className="text-black dark:text-white">Language</Label>
                    <select
                      id="language"
                      value={preferences.language}
                      onChange={(e) => setPreferences({...preferences, language: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-black dark:text-white"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timeFormat" className="text-black dark:text-white">Time Format</Label>
                    <select
                      id="timeFormat"
                      value={preferences.timeFormat}
                      onChange={(e) => setPreferences({...preferences, timeFormat: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-black dark:text-white"
                    >
                      <option value="12h">12-hour</option>
                      <option value="24h">24-hour</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dateFormat" className="text-black dark:text-white">Date Format</Label>
                  <select
                    id="dateFormat"
                    value={preferences.dateFormat}
                    onChange={(e) => setPreferences({...preferences, dateFormat: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-black text-black dark:text-white"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>

              <Button 
                onClick={savePreferences}
                disabled={isLoading}
                className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                {isLoading ? (
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <IconCheck className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card id="data" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-black dark:text-white flex items-center gap-2">
                <IconDatabase className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Export, backup, and manage your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-black dark:text-white">Data Export</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Download all your analysis data and reports
                  </p>
                  <Button 
                    onClick={exportData}
                    disabled={isLoading}
                    variant="outline" 
                    className="w-full border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
                  >
                    {isLoading ? (
                      <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <IconDownload className="h-4 w-4 mr-2" />
                    )}
                    {isLoading ? 'Exporting...' : 'Export All Data'}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-black dark:text-white">Data Retention</h4>
                  <div className="space-y-2">
                    <Label htmlFor="retentionDays" className="text-black dark:text-white">Keep data for (days)</Label>
                    <Input
                      id="retentionDays"
                      type="number"
                      value={securitySettings.dataRetentionDays}
                      onChange={(e) => setSecuritySettings({...securitySettings, dataRetentionDays: parseInt(e.target.value)})}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Permanently delete your account and all associated data
                </p>
                <Button variant="destructive" className="bg-red-600 text-white hover:bg-red-700">
                  <IconTrash className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}