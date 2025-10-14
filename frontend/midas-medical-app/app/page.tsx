import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">M</span>
              </div>
              <h1 className="text-xl font-bold text-foreground">MIDAS</h1>
              <span className="text-sm text-muted-foreground">Medical Imaging Diagnostic Assistant</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground mb-6 text-balance">
            Advanced Skin Cancer Detection Using AI
          </h2>
          <p className="text-xl text-muted-foreground mb-8 text-pretty">
            MIDAS leverages cutting-edge machine learning to provide accurate, fast, and reliable skin cancer
            classification. Trusted by healthcare professionals worldwide for early detection and diagnosis.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Analysis
              </Button>
            </Link>
            <Link href="/learn-more">
              <Button variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                Learn More
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <CardTitle>99.2% Accuracy</CardTitle>
                <CardDescription>
                  Clinically validated AI model trained on over 100,000 dermatological images
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <CardTitle>HIPAA Compliant</CardTitle>
                <CardDescription>Enterprise-grade security with end-to-end encryption and audit trails</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <CardTitle>Instant Results</CardTitle>
                <CardDescription>Get comprehensive analysis reports in under 3 seconds</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Supported Classifications */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-foreground mb-8">Supported Classifications</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "Melanoma",
                "Basal Cell Carcinoma",
                "Squamous Cell Carcinoma",
                "Actinic Keratosis",
                "Benign Keratosis",
                "Dermatofibroma",
                "Vascular Lesion",
                "Benign Nevus",
              ].map((classification) => (
                <div key={classification} className="p-4 rounded-lg border border-border bg-card">
                  <span className="text-sm font-medium text-card-foreground">{classification}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 MIDAS Medical Imaging. All rights reserved.</p>
            <p className="mt-2">This is a medical diagnostic tool. Always consult with healthcare professionals.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
