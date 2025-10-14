"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { motion } from "motion/react";
import { useSignIn, useSignUp } from '@clerk/nextjs';
import { useState, useEffect } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { default as dynamic } from "next/dynamic";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatePresence } from "motion/react";
import useNavigationLoading from "@/hooks/use-navigation-loading";
import { useLoading } from "@/contexts/loading-context";

// Dynamic imports for background components with error handling
const Ripple = dynamic(
  () => import("@/components/ui/shadcn-io/ripple").then(mod => ({ default: mod.Ripple })),
  { ssr: false }
);

const RetroGrid = dynamic(
  () => import("@/components/ui/shadcn-io/retro-grid").then(mod => ({ default: mod.RetroGrid })),
  { ssr: false }
);

const Meteors = dynamic(
  () => import("@/components/meteors").then(mod => ({ default: mod.Meteors })),
  { ssr: false }
);

export default function LoginSignup() {
    const { navigateWithLoading } = useNavigationLoading()
    const { setLoadingState } = useLoading()
    const { signIn, setActive } = useSignIn()
    const { signUp } = useSignUp()
    
    const [isSignup, setIsSignup] = useState<boolean>(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDark, setIsDark] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [isFormReady, setIsFormReady] = useState<boolean>(false);

    // Initialize theme from localStorage with better error handling
    useEffect(() => {
        try {
            const savedTheme = localStorage.getItem('theme');
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemDark);
            
            setIsDark(shouldBeDark);
            
            // Apply theme to document
            if (shouldBeDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch (error) {
            console.warn('Failed to load theme from localStorage:', error);
            // Fallback to system preference
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDark(systemDark);
            if (systemDark) {
                document.documentElement.classList.add('dark');
            }
        } finally {
            setIsLoaded(true);
            setIsFormReady(true); // Form can render immediately
            // Add a small delay to ensure smooth background mounting
            setTimeout(() => setIsMounted(true), 100);
        }
    }, []);

    // Save theme to localStorage whenever it changes with error handling
    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                
                // Apply theme to document with smooth transition
                if (isDark) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } catch (error) {
                console.warn('Failed to save theme to localStorage:', error);
            }
        }
    }, [isDark, isLoaded]);


    // Listen for theme changes from ThemeToggle component
    useEffect(() => {
        const handleThemeChange = (event: CustomEvent) => {
            const newTheme = event.detail?.theme;
            if (newTheme === 'dark' || newTheme === 'light') {
                setIsDark(newTheme === 'dark');
            }
        };

        window.addEventListener('themeChange', handleThemeChange as EventListener);

        return () => {
            window.removeEventListener('themeChange', handleThemeChange as EventListener);
        };
    }, []);

    // Cleanup effect to prevent animation issues during navigation
    useEffect(() => {
        const handleBeforeUnload = () => {
            setIsMounted(false);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsMounted(false);
            } else {
                setTimeout(() => setIsMounted(true), 200);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleGoogleAuth = async () => {
        if (!signIn) return;
        
        setIsLoading(true);
        try {
            // Use LifeLine loader for Google OAuth authentication
            setLoadingState(true, 'Authenticating with Google...');
            
            await signIn.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/dashboard',
            });
        } catch (error: unknown) {
            console.error(`Google ${isSignup ? 'signup' : 'login'} error:`, error);
            setIsLoading(false);
            setLoadingState(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSignup && password !== confirmPassword) {
            console.error("Passwords do not match");
            return;
        }
        
        if (!signIn || !signUp) return;
        
        setIsLoading(true);
        try {
            if (isSignup) {
                // Use LifeLine loader for signup
                setLoadingState(true, 'Creating your account...');
                
                await signUp.create({
                    emailAddress: email,
                    password,
                    firstName: username.split(' ')[0] || username,
                    lastName: username.split(' ')[1] || '',
                });
                
                // Send email verification
                await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
                
                setLoadingState(false);
                // Show success message and switch to login mode
                alert('Account created! Please check your email to verify your account, then sign in.');
                setIsSignup(false);
                setPassword("");
                setConfirmPassword("");
                setUsername("");
            } else {
                // Use LifeLine loader for login
                setLoadingState(true, 'Signing you in...');
                
                const result = await signIn.create({
                    identifier: email,
                    password,
                });
                
                if (result.status === 'complete') {
                    await setActive({ session: result.createdSessionId });
                    
                    // Keep LifeLine loading for navigation to dashboard
                    setLoadingState(true, 'Accessing Dashboard...');
                    setIsLoading(false); // Stop form loading
                    
                    // Navigate without additional loading overlay
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 800);
                    return; // Prevent further execution
                } else {
                    // Handle additional verification steps if needed
                    console.log('Additional verification required:', result.status);
                    setLoadingState(false);
                }
            }
        } catch (error: unknown) {
            console.error(`Email ${isSignup ? 'signup' : 'login'} error:`, error);
            
            // Handle Clerk-specific errors
            let errorMessage = 'An error occurred. Please try again.';
            if (error && typeof error === 'object' && 'errors' in error) {
                const clerkError = error as { errors?: Array<{ message: string }> };
                if (clerkError.errors && clerkError.errors[0]) {
                    errorMessage = clerkError.errors[0].message;
                }
            }
            
            alert(errorMessage);
            setLoadingState(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (emailForReset?: string) => {
        if (!signIn) return;
        
        const emailToUse = emailForReset || email;
        if (!emailToUse) {
            alert('Please enter your email address first.');
            return;
        }
        
        try {
            setLoadingState(true, 'Sending magic link...');
            
            await signIn.create({
                identifier: emailToUse,
                strategy: 'reset_password_email_code',
            });
            
            alert(`Password reset link sent to ${emailToUse}. Check your email and click the link to reset your password.`);
            
        } catch (error: unknown) {
            console.error('Password reset error:', error);
            let errorMessage = 'Failed to send reset email. Please try again.';
            if (error && typeof error === 'object' && 'errors' in error) {
                const clerkError = error as { errors?: Array<{ message: string }> };
                if (clerkError.errors && clerkError.errors[0]) {
                    errorMessage = clerkError.errors[0].message;
                }
            }
            alert(errorMessage);
        } finally {
            setLoadingState(false);
        }
    };

    // Prevent flash of wrong theme during hydration
    if (!isLoaded || !isFormReady) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-pulse">
                    <div className="w-96 h-64 bg-gray-800 rounded-lg"></div>
                </div>
            </div>
        );
    }

    return (
        <main className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
            isDark ? 'bg-black' : 'bg-gray-900'
        }`}>
            {/* Background Effects Layer - Theme Adaptive with High Visibility */}
            <div className="absolute inset-0 w-full h-full">
                {/* Background Components with Smooth Transitions */}
                {isMounted && (
                    <>
                        {/* Retro Grid Background - Theme Adaptive */}
                        <div className={`transition-opacity duration-1000 ${
                            isMounted ? 'opacity-100' : 'opacity-0'
                        }`}>
                            <RetroGrid 
                                className={`transition-opacity duration-100 ${
                                    isDark 
                                        ? 'opacity-40' 
                                        : 'opacity-40'
                                }`}
                                angle={65}
                                cellSize={65}
                                lightLineColor={isDark ? "#60a5fa" : "#3b82f6"}
                                darkLineColor={isDark ? "#93c5fd" : "#60a5fa"}
                            />
                        </div>
                        
                        {/* Ripple Effect - Theme Adaptive */}
                        <div className={` ${
                            isMounted ? 'opacity-100' : 'opacity-0'
                        }`}>
                            <Ripple 
                                className={`transition-opacity duration-500 ${
                                    isDark 
                                        ? 'opacity-60' 
                                        : 'opacity-50'
                                }`}
                                mainCircleSize={400}
                                mainCircleOpacity={isDark ? 0.4 : 0.5}
                                numCircles={6}
                            />
                        </div>
                        
                        {/* Meteors - Enhanced Visibility */}
                        <div className={`transition-opacity duration-1000 delay-200 ${
                            isMounted ? 'opacity-100' : 'opacity-0'
                        }`}>
                            <Meteors 
                                number={25}
                                minDelay={0}
                                maxDelay={2}
                                minDuration={1.5}
                                maxDuration={3}
                                angle={220}
                            />
                        </div>
                    </>
                )}
                
                {/* Theme-adaptive gradient overlay for optimal readability */}
                <div className={`absolute inset-0 transition-colors duration-500 ${
                    isDark 
                        ? 'bg-gradient-to-br from-black/40 via-transparent to-black/40' 
                        : 'bg-gradient-to-br from-gray-900/40 via-transparent to-gray-900/40'
                }`} />
            </div>

            {/* Animated Theme Toggle */}
            <ThemeToggle />

            {/* Form Content - Always Renders When Theme is Loaded */}
            {isFormReady && (
                <div className="min-h-screen flex items-center justify-center p-8 relative z-10">
                    <div className="w-full max-w-md">
                        {/* Back to Home */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: isFormReady ? 1 : 0, x: 0 }}
                            transition={{ duration: 0.5 }}
                            className="mb-8"
                        >
                            <Button
                                variant="ghost"
                                className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
                                onClick={() => navigateWithLoading('/', 'Returning Home...')}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Home
                            </Button>
                        </motion.div>

                        {/* Auth Toggle */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: isFormReady ? 1 : 0, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="mb-6"
                        >
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                <Button
                                    type="button"
                                    variant={!isSignup ? "default" : "ghost"}
                                    className="flex-1 transition-all duration-300"
                                    onClick={() => setIsSignup(false)}
                                >
                                    Sign In
                                </Button>
                                <Button
                                    type="button"
                                    variant={isSignup ? "default" : "ghost"}
                                    className="flex-1 transition-all duration-300"
                                    onClick={() => setIsSignup(true)}
                                >
                                    Sign Up
                                </Button>
                            </div>
                        </motion.div>

                        {/* Auth Card with Flip Animation */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: isFormReady ? 1 : 0, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="perspective-1000"
                        >
                            <div className="relative w-full">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={isSignup ? 'signup' : 'login'}
                                        initial={{ 
                                            rotateY: 90, 
                                            opacity: 0,
                                            scale: 0.95
                                        }}
                                        animate={{ 
                                            rotateY: 0, 
                                            opacity: 1,
                                            scale: 1
                                        }}
                                        exit={{ 
                                            rotateY: -90, 
                                            opacity: 0,
                                            scale: 0.95
                                        }}
                                        transition={{ 
                                            duration: 0.4, 
                                            ease: "easeInOut",
                                            type: "tween"
                                        }}
                                        style={{ transformStyle: 'preserve-3d' }}
                                    >
                                        <Card className="shadow-md border transition-all duration-500 relative overflow-hidden">
                                    <CardHeader className="text-center relative z-10">
                                        <CardTitle className="text-3xl font-bold mb-2">
                                            {isSignup ? "Join MIDAS" : "Welcome Back"}
                                        </CardTitle>
                                        <p className="text-gray-500 dark:text-gray-400 text-lg">
                                            {isSignup 
                                                ? "Create your account to access the future of dermatology"
                                                : "Sign in to access your MIDAS dashboard"
                                            }
                                        </p>
                                    </CardHeader>

                                <CardContent className="space-y-6 relative z-10">
                                    {/* Google Auth */}
                                    <Button
                                        onClick={handleGoogleAuth}
                                        variant="outline"
                                        className="w-full h-12 text-lg border transition-all duration-300"
                                        disabled={isLoading}
                                    >
                                        <FcGoogle className="mr-3 h-6 w-6" />
                                        Continue with Google
                                    </Button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                            <span className={`px-3 transition-colors duration-500 ${
                                isDark 
                                    ? 'text-gray-400 bg-black' 
                                    : 'text-gray-600 bg-gray-900'
                            }`}>
                                {isSignup ? "Or create account with email" : "Or continue with email"}
                            </span>
                                        </div>
                                    </div>

                                    {/* Email Auth Form */}
                                    <form onSubmit={handleEmailAuth} className="space-y-4">
                                        {/* Username field - only for signup */}
                                        {isSignup && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="space-y-2"
                                            >
                                                <Label htmlFor="username">Username</Label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                                                    <Input
                                                        id="username"
                                                        type="text"
                                                        placeholder="your_username"
                                                        value={username}
                                                        onChange={(e) => setUsername(e.target.value)}
                                                        className="pl-10 h-12"
                                                        required={isSignup }
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="doctor@hospital.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="pl-10 h-12"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="password">Password</Label>
                                                {!isSignup && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleForgotPassword()}
                                                        className="text-sm text-blue-600 dark:text-blue-500 hover:underline transition-colors"
                                                        disabled={isLoading}
                                                    >
                                                        Forgot password?
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                                                <Input
                                                    id="password"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder={isSignup ? "Create a strong password" : "Enter your password"}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="pl-10 pr-10 h-12"
                                                    required
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-1 top-1 h-10 w-10"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Confirm Password field - only for signup */}
                                        {isSignup && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3, delay: 0.1 }}
                                                className="space-y-2"
                                            >
                                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                                                    <Input
                                                        id="confirmPassword"
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        placeholder="Confirm your password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="pl-10 pr-10 h-12"
                                                        required={isSignup}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute right-1 top-1 h-10 w-10"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    >
                                                        {showConfirmPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        )}

                                        <Button
                                            type="submit"
                                            className="w-full h-12 text-lg transition-all duration-300"
                                            disabled={isLoading}
                                        >
                                            {isLoading 
                                                ? (isSignup ? "Creating account..." : "Signing in...") 
                                                : (isSignup ? "Create Account" : "Sign In")
                                            }
                                        </Button>
                                    </form>

                                        </CardContent>
                                        </Card>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        {/* Footer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isFormReady ? 1 : 0 }}
                            transition={{ duration: 0.6, delay: 0.8 }}
                            className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 relative z-10"
                        >
                            By {isSignup ? 'creating an account' : 'signing in'}, you agree to our{" "}
                            <Link href="/terms" className="text-blue-600 dark:text-blue-500 hover:underline">
                                Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy" className="text-blue-600 dark:text-blue-500 hover:underline">
                                Privacy Policy
                            </Link>
                        </motion.div>
                    </div>
                </div>
            )}
        </main>
    );
}