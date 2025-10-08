"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Sun, Moon } from "lucide-react";

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initialize theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDark(false);
            document.documentElement.classList.remove('dark');
        }
        setIsLoaded(true);
    }, []);

    // Save theme to localStorage whenever it changes
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [isDark, isLoaded]);

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            });
        } catch (error) {
            console.error("Google login error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            // Redirect to dashboard on successful login
            router.push('/dashboard');
        } catch (error) {
            console.error("Email login error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Prevent flash of wrong theme during hydration
    if (!isLoaded) {
        return null;
    }

    return (
        <main className="min-h-screen bg-background">
            {/* Theme Toggle */}
            <Button
                onClick={toggleTheme}
                variant="outline"
                size="icon"
                className={`fixed top-6 right-6 z-[9999] w-12 h-12 rounded-full shadow-lg transition-all duration-300 ${
                    isDark
                        ? 'bg-white/20 hover:bg-white/30 border-white/30 text-white'
                        : 'bg-black/20 hover:bg-black/30 border-black/30 text-black'
                }`}
            >
                {isDark ? (
                    <Sun className="h-5 w-5" />
                ) : (
                    <Moon className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle theme</span>
            </Button>

            <div className="min-h-screen flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                        {/* Back to Home */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                            className="mb-8"
                        >
                            <Link href="/">
                                <Button
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Home
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Login Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <Card className="shadow-2xl bg-gradient-to-t from-gray-100 via-transparent to-white dark:from-gray-800 dark:via-transparent dark:to-gray-900 border-2 border-border">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
                                    <p className="text-muted-foreground text-lg">
                                        Sign in to access your MIDAS dashboard
                                    </p>
                                </CardHeader>

                                <CardContent className="space-y-6">
                                    {/* Google Login */}
                                    <Button
                                        onClick={handleGoogleLogin}
                                        variant="outline"
                                        className="w-full h-12 text-lg border-2 hover:bg-muted transition-all duration-300"
                                        disabled={isLoading}
                                    >
                                        <FcGoogle className="mr-3 h-6 w-6" />
                                        Continue with Google
                                    </Button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-muted-foreground/20" />
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="bg-background px-3 text-muted-foreground">
                                                Or continue with email
                                            </span>
                                        </div>
                                    </div>

                                    {/* Email Login Form */}
                                    <form onSubmit={handleEmailLogin} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
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
                                                <Link
                                                    href="/forgot-password"
                                                    className="text-sm text-primary hover:underline"
                                                >
                                                    Forgot password?
                                                </Link>
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    id="password"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter your password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="pl-10 pr-10 h-12"
                                                    required
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-1 top-1 h-10 w-10 hover:bg-transparent"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full h-12 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? "Signing in..." : "Sign In"}
                                        </Button>
                                    </form>

                                    <div className="text-center text-sm text-muted-foreground">
                                        Don't have an account?{" "}
                                        <Link href="/signup" className="text-primary hover:underline font-semibold">
                                            Sign up
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Footer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.8 }}
                            className="mt-8 text-center text-sm text-muted-foreground"
                        >
                            By signing in, you agree to our{" "}
                            <Link href="/terms" className="text-primary hover:underline">
                                Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link href="/privacy" className="text-primary hover:underline">
                                Privacy Policy
                            </Link>
                        </motion.div>
                </div>
            </div>
        </main>
    );
}