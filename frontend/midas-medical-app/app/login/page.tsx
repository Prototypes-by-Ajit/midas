"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Shield, Stethoscope, Users, Activity } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement authentication logic
    console.log("Login attempt:", { email, password, rememberMe })
  }

  const handleDemoLogin = (role: "patient" | "doctor" | "admin") => {
    const demoUsers = {
      patient: {
        id: "demo-patient-1",
        name: "Sarah Johnson",
        email: "sarah.johnson@demo.com",
        role: "patient",
        avatar: "/placeholder-patient.jpg",
      },
      doctor: {
        id: "demo-doctor-1",
        name: "Dr. Michael Chen",
        email: "dr.chen@demo.com",
        role: "doctor",
        specialization: "Dermatology",
        avatar: "/placeholder-doctor.jpg",
      },
      admin: {
        id: "demo-admin-1",
        name: "Jennifer Martinez",
        email: "admin@demo.com",
        role: "admin",
        department: "Hospital Administration",
        avatar: "/placeholder-admin.jpg",
      },
    }

    localStorage.setItem("demo-user", JSON.stringify(demoUsers[role]))
    localStorage.setItem("demo-mode", "true")

    // Redirect based on role
    const redirectPaths = {
      patient: "/dashboard",
      doctor: "/doctor/dashboard",
      admin: "/admin/dashboard",
    }

    router.push(redirectPaths[role])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 mb-6 group">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <span className="text-2xl font-bold text-foreground block">MIDAS</span>
              <span className="text-sm text-muted-foreground">Medical Intelligence & Diagnostic Analysis System</span>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Access your secure medical dashboard</p>
        </div>

        <Card className="shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Sign In to Your Account</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground">
                    Remember me
                  </Label>
                </div>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                Sign In Securely
              </Button>
            </form>

            <div className="space-y-4">
              <Separator className="my-6" />

              <div className="text-center space-y-2">
                <div className="inline-flex items-center space-x-2 px-4 py-2 bg-accent/10 rounded-full">
                  <Shield className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-semibold text-foreground">Try Demo Mode</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Explore MIDAS with realistic sample data - no registration required
                </p>
              </div>

              <div className="grid gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-auto px-4 py-3 border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 bg-transparent group transition-all duration-200 hover:shadow-md"
                  onClick={() => handleDemoLogin("patient")}
                >
                  <div className="flex items-center space-x-3 w-full min-w-0">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-semibold text-blue-700 truncate">
                        Patient Portal Demo
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                        Upload skin images • View AI analysis • Track health history
                      </div>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-auto px-4 py-3 border-2 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 bg-transparent group transition-all duration-200 hover:shadow-md"
                  onClick={() => handleDemoLogin("doctor")}
                >
                  <div className="flex items-center space-x-3 w-full min-w-0">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                      <Stethoscope className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-semibold text-emerald-700 truncate">
                        Doctor Portal Demo
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                        Review AI diagnoses • Add clinical notes • Manage patients
                      </div>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-auto px-4 py-3 border-2 border-accent/30 hover:border-accent/50 hover:bg-accent/5 bg-transparent group transition-all duration-200 hover:shadow-md"
                  onClick={() => handleDemoLogin("admin")}
                >
                  <div className="flex items-center space-x-3 w-full min-w-0">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-accent flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                      <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-semibold text-purple-700 truncate">
                        Admin Portal Demo
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                        System analytics • User management • Compliance reports
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Create Account
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Enterprise-grade security • HIPAA compliant • End-to-end encryption</span>
          </div>
        </div>
      </div>
    </div>
  )
}
