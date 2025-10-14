import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Shield, Zap, Users, Award, Globe } from "lucide-react"

export default function LearnMorePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold text-foreground">MIDAS</span>
            </Link>
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

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-6">The Future of Skin Cancer Detection</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            MIDAS combines cutting-edge artificial intelligence with clinical expertise to provide the most accurate and
            reliable skin cancer detection system available today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="bg-transparent">
                Schedule Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Lightning Fast Analysis</CardTitle>
              <CardDescription>
                Get comprehensive skin cancer analysis in under 3 seconds with our optimized AI pipeline
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Enterprise Security</CardTitle>
              <CardDescription>
                HIPAA compliant with end-to-end encryption, audit logging, and enterprise-grade security
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Clinically Validated</CardTitle>
              <CardDescription>
                Trained on 100,000+ dermatological images and validated by leading medical institutions
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Accuracy Stats */}
        <Card className="mb-16">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Proven Clinical Accuracy</CardTitle>
            <CardDescription>Our AI system has been rigorously tested across multiple cancer types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">99.2%</div>
                <p className="text-sm text-muted-foreground">Overall Accuracy</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">97.8%</div>
                <p className="text-sm text-muted-foreground">Melanoma Detection</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">98.5%</div>
                <p className="text-sm text-muted-foreground">Basal Cell Carcinoma</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">96.9%</div>
                <p className="text-sm text-muted-foreground">Squamous Cell Carcinoma</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supported Classifications */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Comprehensive Cancer Classification</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Melanoma", risk: "High Risk", color: "bg-destructive" },
              { name: "Basal Cell Carcinoma", risk: "Moderate Risk", color: "bg-orange-500" },
              { name: "Squamous Cell Carcinoma", risk: "High Risk", color: "bg-destructive" },
              { name: "Actinic Keratosis", risk: "Moderate Risk", color: "bg-orange-500" },
              { name: "Benign Keratosis", risk: "Low Risk", color: "bg-primary" },
              { name: "Dermatofibroma", risk: "Low Risk", color: "bg-primary" },
              { name: "Vascular Lesion", risk: "Low Risk", color: "bg-primary" },
              { name: "Benign Nevus", risk: "Low Risk", color: "bg-primary" },
            ].map((classification) => (
              <Card key={classification.name}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">{classification.name}</h3>
                    <Badge className={`${classification.color} text-white text-xs`}>{classification.risk}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">For Healthcare Providers</h2>
            <div className="space-y-4">
              {[
                "Reduce diagnostic time from hours to seconds",
                "Improve early detection rates by 23%",
                "Standardize diagnosis across your practice",
                "Generate comprehensive reports automatically",
                "Integrate seamlessly with existing workflows",
              ].map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">For Patients</h2>
            <div className="space-y-4">
              {[
                "Get instant peace of mind with accurate results",
                "Track your skin health over time",
                "Receive personalized risk assessments",
                "Share results securely with your doctor",
                "Access educational resources and guidance",
              ].map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <Card className="mb-16">
          <CardHeader className="text-center">
            <CardTitle>Trusted by Leading Healthcare Institutions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="flex items-center justify-center space-x-2">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">500+</div>
                  <p className="text-sm text-muted-foreground">Healthcare Providers</p>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Globe className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">25+</div>
                  <p className="text-sm text-muted-foreground">Countries</p>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Award className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">1M+</div>
                  <p className="text-sm text-muted-foreground">Analyses Completed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of healthcare providers using MIDAS for better patient outcomes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="bg-transparent">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
