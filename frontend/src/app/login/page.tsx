"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { motion } from "motion/react";
import { useSignIn, useSignUp, useUser, useClerk } from '@clerk/nextjs';
import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { default as dynamic } from "next/dynamic";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatePresence } from "motion/react";
import useNavigationLoading from "@/hooks/use-navigation-loading";
import { useLoading } from "@/contexts/loading-context";
import { useSearchParams } from 'next/navigation';

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

function LoginSignupContent() {
    const { navigateWithLoading } = useNavigationLoading()
    const { setLoadingState } = useLoading()
    const { signIn, setActive } = useSignIn()
    const { signUp } = useSignUp()
    const { isSignedIn, isLoaded: isUserLoaded } = useUser()
    const { signOut } = useClerk()
    const searchParams = useSearchParams()
    const redirectUrl = searchParams?.get('redirect_url') || '/dashboard'
    
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
    
    // Forgot password state
    const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Check if user is already signed in and redirect to dashboard
    useEffect(() => {
        // Don't auto-redirect if user just verified email (they need to log in first)
        const justVerified = searchParams?.get('verified') === 'true';

        if (isUserLoaded && isSignedIn && !justVerified) {
            console.log('User is already signed in, redirecting to dashboard...');
            setLoadingState(true, 'Redirecting to Dashboard...');
            window.location.href = redirectUrl;
        } else if (isUserLoaded && isSignedIn && justVerified) {
            // User just verified email but Clerk auto-signed them in
            // Sign them out so they can log in manually
            console.log('Email verified! Signing out to allow manual login...');
            signOut().then(() => {
                alert('Email verified successfully! Please sign in with your credentials to access your account.');
                // Clear the verified flag from URL
                window.history.replaceState({}, '', '/login');
            });
        }
    }, [isUserLoaded, isSignedIn, redirectUrl, setLoadingState, searchParams, signOut]);

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
                redirectUrlComplete: redirectUrl,
            });
        } catch (error: unknown) {
            console.error(`Google ${isSignup ? 'signup' : 'login'} error:`, error);
            setIsLoading(false);
            setLoadingState(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('🔐 handleEmailAuth called', { isSignup, email, username });
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            alert('Please enter a valid email address.');
            return;
        }
        
        // Validate password length
        if (!password || password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }
        
        // Validate username for signup
        if (isSignup && (!username || username.trim().length < 2)) {
            alert('Username must be at least 2 characters long.');
            return;
        }
        
        if (isSignup && password !== confirmPassword) {
            console.error("Passwords do not match");
            alert("Passwords do not match. Please try again.");
            return;
        }
        
        if (!signIn || !signUp) {
            console.error('Clerk not loaded', { signIn, signUp });
            alert('Authentication system is loading. Please wait a moment and try again.');
            return;
        }
        
        setIsLoading(true);
        console.log('✅ Starting authentication...');
        
        try {
            if (isSignup) {
                console.log('📝 Creating signup with:', { email, username });
                // Use LifeLine loader for signup
                setLoadingState(true, 'Creating your account...');
                
                // Create the account
                const result = await signUp.create({
                    emailAddress: email,
                    password,
                    firstName: username.split(' ')[0] || username,
                    lastName: username.split(' ')[1] || '',
                });

                console.log('✅ Signup result:', result);
                console.log('✅ Signup status:', result.status);
                console.log('✅ Verification status:', result.verifications);

                // Check if email verification is required
                if (result.status === 'missing_requirements') {
                    // Email verification required - prepare and send verification email
                    // This must be called immediately after signup.create() in the same session
                    try {
                        await result.prepareEmailAddressVerification({
                            strategy: 'email_link',
                            redirectUrl: `${window.location.origin}/login?verified=true`,
                        });
                        console.log('✅ Verification email sent');
                        setLoadingState(false);
                        alert('Account created! Please check your email and click the verification link. After verification, you can sign in with your credentials.');
                    } catch (verificationError) {
                        console.error('Verification email error:', verificationError);
                        setLoadingState(false);
                        alert('Account created, but there was an issue sending the verification email. Please try to sign in and request a new verification email.');
                    }
                } else if (result.status === 'complete') {
                    // Account created successfully without verification needed
                    setLoadingState(false);
                    alert('Account created successfully! Please sign in with your credentials.');
                } else {
                    setLoadingState(false);
                    alert('Account created! Please sign in to continue.');
                }

                // Clear form and switch to login
                setIsSignup(false);
                setPassword("");
                setConfirmPassword("");
                setUsername("");
            } else {
                // Use LifeLine loader for login
                console.log('🔑 Attempting login with:', { email: email.trim() });
                setLoadingState(true, 'Signing you in...');
                
                const result = await signIn.create({
                    identifier: email.trim(),
                    password,
                });
                
                console.log('📊 Login result:', result.status);
                console.log('📊 Full result:', JSON.stringify(result, null, 2));
                
                if (result.status === 'complete') {
                    await setActive({ session: result.createdSessionId });
                    
                    // Keep LifeLine loading for navigation to dashboard
                    setLoadingState(true, 'Accessing Dashboard...');
                    setIsLoading(false); // Stop form loading
                    
                    // Navigate without additional loading overlay
                    setTimeout(() => {
                        window.location.href = redirectUrl;
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
            console.error('Full error object:', JSON.stringify(error, null, 2));
            
            // Handle Clerk-specific errors
            let errorMessage = 'An error occurred. Please try again.';
            
            if (error && typeof error === 'object' && 'errors' in error) {
                const clerkError = error as { errors?: Array<{ message: string; longMessage?: string; code?: string }> };
                if (clerkError.errors && clerkError.errors[0]) {
                    const err = clerkError.errors[0];
                    console.log('Error code:', err.code);
                    console.log('Error message:', err.message);
                    console.log('Error long message:', err.longMessage);
                    
                    // Check for "already signed in" error
                    if (err.message && err.message.toLowerCase().includes("already signed in")) {
                        console.log('User is already signed in, redirecting...');
                        window.location.href = redirectUrl;
                        return;
                    }

                    if (isSignup) {
                        // Signup-specific error handling
                        if (err.message.toLowerCase().includes('invalid')) {
                            errorMessage = `Invalid signup data:\n${err.longMessage || err.message}\n\nPlease check:\n- Valid email format\n- Username (2+ characters)\n- Password (8+ characters)`;
                        } else if (err.message.toLowerCase().includes('already exists') || err.message.toLowerCase().includes('taken')) {
                            errorMessage = 'This email is already registered. Please sign in instead or use a different email.';
                        } else {
                            errorMessage = err.longMessage || err.message;
                        }
                    } else {
                        // Login-specific error handling - DO NOT check for "already exists" or "taken"
                        if (err.code === 'form_identifier_not_found' ||
                            err.message.toLowerCase().includes("couldn't find") ||
                            err.message.toLowerCase().includes('not found')) {
                            errorMessage = 'No account found with this email. Please sign up first.';
                        } else if (err.message.toLowerCase().includes('password') || err.message.toLowerCase().includes('incorrect')) {
                            errorMessage = 'Password or email address is incorrect. Please try again.';
                        } else if (err.message.toLowerCase().includes('not verified') || err.message.toLowerCase().includes('verification')) {
                            errorMessage = 'Please verify your email address before signing in. Check your inbox for the verification link.';
                        } else {
                            // For login, show the original error message without checking for "already exists" or "taken"
                            errorMessage = err.longMessage || err.message;
                        }
                    }
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
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailToUse)) {
            alert('Please enter a valid email address.');
            return;
        }
        
        try {
            setLoadingState(true, 'Sending 6-digit code...');

            await signIn.create({
                identifier: emailToUse,
                strategy: 'reset_password_email_code',
            });

            // Update email field to ensure it's set for reset attempt
            setEmail(emailToUse);

            setLoadingState(false);
            setIsForgotPassword(true);
            alert(`6-digit verification code sent to ${emailToUse}. Check your email.`);
            
        } catch (error: unknown) {
            console.error('Password reset error:', error);
            let errorMessage = 'Failed to send reset code. Please check your email and try again.';
            if (error && typeof error === 'object' && 'errors' in error) {
                const clerkError = error as { errors?: Array<{ message: string }> };
                if (clerkError.errors && clerkError.errors[0]) {
                    errorMessage = clerkError.errors[0].message;
                }
            }
            alert(errorMessage);
            setLoadingState(false);
        }
    };
    
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!signIn) return;

        if (resetCode.length !== 6) {
            alert('Please enter a valid 6-digit code.');
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }

        try {
            setLoadingState(true, 'Resetting password...');

            const result = await signIn.attemptFirstFactor({
                strategy: 'reset_password_email_code',
                code: resetCode,
                password: newPassword,
            });
            
            if (result.status === 'complete') {
                await setActive({ session: result.createdSessionId });
                setLoadingState(false);
                alert('Password reset successful! Redirecting to dashboard...');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                setLoadingState(false);
                alert('Password reset incomplete. Please try again.');
            }
        } catch (error: unknown) {
            console.error('Reset password error:', error);
            let errorMessage = 'Failed to reset password. Please check your code and try again.';
            if (error && typeof error === 'object' && 'errors' in error) {
                const clerkError = error as { errors?: Array<{ message: string }> };
                if (clerkError.errors && clerkError.errors[0]) {
                    errorMessage = clerkError.errors[0].message;
                }
            }
            alert(errorMessage);
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

                        {/* Auth Toggle - Hide when in forgot password mode */}
                        {!isForgotPassword && (
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
                        )}

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
                                        key={isForgotPassword ? 'forgot-password' : (isSignup ? 'signup' : 'login')}
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
                                            {isForgotPassword 
                                                ? "Reset Password" 
                                                : (isSignup ? "Join MIDAS" : "Welcome Back")
                                            }
                                        </CardTitle>
                                        <p className="text-gray-500 dark:text-gray-400 text-lg">
                                            {isForgotPassword
                                                ? "Enter the 6-digit code sent to your email"
                                                : (isSignup 
                                                    ? "Create your account to access the future of dermatology"
                                                    : "Sign in to access your MIDAS dashboard")
                                            }
                                        </p>
                                    </CardHeader>

                                <CardContent className="space-y-6 relative z-10">
                                    {isForgotPassword ? (
                                        /* Forgot Password Form */
                                        <form onSubmit={handleResetPassword} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="resetCode">Verification Code</Label>
                                                <Input
                                                    id="resetCode"
                                                    type="text"
                                                    placeholder="Enter 6-digit code"
                                                    value={resetCode}
                                                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    className="h-12 text-center text-2xl tracking-widest font-mono"
                                                    maxLength={6}
                                                    required
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="newPassword">New Password</Label>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                                                    <Input
                                                        id="newPassword"
                                                        type={showNewPassword ? "text" : "password"}
                                                        placeholder="Enter new password (8+ chars)"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className="pl-10 pr-10 h-12"
                                                        required
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute right-1 top-1 h-10 w-10"
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                    >
                                                        {showNewPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full h-12 text-lg transition-all duration-300"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? "Resetting..." : "Reset Password"}
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="w-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                                onClick={() => {
                                                    setIsForgotPassword(false);
                                                    setResetCode("");
                                                    setNewPassword("");
                                                }}
                                            >
                                                Back to Sign In
                                            </Button>
                                        </form>
                                    ) : (
                                    <>
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
                                    </>
                                    )}

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

export default function LoginSignup() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white dark:bg-black" />}>
            <LoginSignupContent />
        </Suspense>
    );
}
