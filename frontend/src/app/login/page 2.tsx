"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FcGoogle } from "react-icons/fc";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase"
import { useForm } from "react-hook-form";

export default function login() {

    const handleGooglelogin = async () => {
        await supabase.auth.signInWithOAuth({

            provider: "google",
            options: {
                redirectTo: `http://example.com/auth/callback`,
            },
        })
    };


    return (
        <>

            <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
                <div className="flex items-center justify-center py-12">
                    <div className="fixed top-0 left-0 flex flex-col items-start mt-2 p-3">
                        <Link href="/">
                            <Button size="xl" className=" rounded-full bg-transparent text-black hover:bg-gradient-to-t hover:from-gray-200 hover:to-gray-100 sm:w-auto">
                                Home
                            </Button>
                        </Link>
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mx-auto grid w-[350px] gap-6"
                    >
                        <div className="grid gap-2 text-center">
                            <h1 className="text-3xl font-bold">Login</h1>
                            <p className="text-balance text-muted-foreground">
                                Enter your email below to login to your account
                            </p>
                        </div>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        href="/forgot-password"
                                        className="ml-auto inline-block text-sm underline"
                                    >
                                        Forgot your password?
                                    </Link>
                                </div>
                                <Input id="password" type="password" required />
                            </div>
                            <Button type="submit" className="w-full">
                                Login
                            </Button>
                            <Button onClick={() => handleGooglelogin()} variant="outline" className="w-full">
                                <FcGoogle className="mr-2 h-4 w-4" />
                                Login with Google
                            </Button>
                        </div>
                        <div className="mt-4 text-center text-sm">
                            Don&apos;t have an account?{" "}
                            <Link href="/signup" className="underline">
                                Sign up
                            </Link>
                        </div>
                    </motion.div>
                </div>
                <div className="hidden min-h-screen bg-muted lg:block">
                    <motion.img
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        src="/ajit.png"
                        alt="Image"
                        width="1920"
                        height="720"
                        className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                    />
                </div>
            </div>
        </>
    )
}