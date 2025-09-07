import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TermsOfService() {
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
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: January 15, 2024 | Effective Date: January 15, 2024</p>
        </div>

        <div className="space-y-8">
          {/* Medical Disclaimer */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Important Medical Disclaimer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700">
                MIDAS is a diagnostic assistance tool and is not intended to replace professional medical advice,
                diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider
                with any questions you may have regarding a medical condition. Never disregard professional medical
                advice or delay in seeking it because of something you have read or seen in MIDAS.
              </p>
            </CardContent>
          </Card>

          {/* Acceptance of Terms */}
          <Card>
            <CardHeader>
              <CardTitle>1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                By accessing and using the MIDAS (Medical Imaging Diagnostic Assistant System) platform, you accept and
                agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the
                above, please do not use this service.
              </p>
            </CardContent>
          </Card>

          {/* Service Description */}
          <Card>
            <CardHeader>
              <CardTitle>2. Service Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                MIDAS provides AI-powered skin cancer detection and classification services to assist healthcare
                professionals in diagnostic processes. Our services include:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Automated analysis of skin lesion images</li>
                <li>Multi-class cancer classification with confidence scores</li>
                <li>Clinical decision support tools</li>
                <li>Report generation and data management</li>
                <li>Secure communication between patients and healthcare providers</li>
              </ul>
            </CardContent>
          </Card>

          {/* User Responsibilities */}
          <Card>
            <CardHeader>
              <CardTitle>3. User Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">For Healthcare Professionals</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Maintain valid medical licenses and certifications</li>
                  <li>Use clinical judgment in interpreting AI results</li>
                  <li>Comply with all applicable medical standards and regulations</li>
                  <li>Protect patient confidentiality and privacy</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">For Patients</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Provide accurate medical history and information</li>
                  <li>Follow up with healthcare providers as recommended</li>
                  <li>Do not rely solely on AI results for medical decisions</li>
                  <li>Seek immediate medical attention for urgent concerns</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Limitations and Accuracy */}
          <Card>
            <CardHeader>
              <CardTitle>4. AI System Limitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                While MIDAS employs advanced AI technology with high accuracy rates, users acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>AI predictions are probabilistic and may contain errors</li>
                <li>System accuracy may vary based on image quality and lesion characteristics</li>
                <li>False positives and false negatives are possible</li>
                <li>The system is not approved for use as a standalone diagnostic device</li>
                <li>Clinical correlation and professional judgment are always required</li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Security and Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>5. Data Security and Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We are committed to protecting your data and maintaining HIPAA compliance:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All data is encrypted in transit and at rest</li>
                <li>Access is restricted to authorized personnel only</li>
                <li>Comprehensive audit logging is maintained</li>
                <li>Regular security assessments and updates are performed</li>
                <li>Data breach notification procedures are in place</li>
              </ul>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>6. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The MIDAS platform, including its AI models, algorithms, software, and documentation, is protected by
                intellectual property laws. Users are granted a limited, non-exclusive license to use the service for
                its intended medical purposes. Reverse engineering, copying, or unauthorized distribution is prohibited.
              </p>
            </CardContent>
          </Card>

          {/* Liability and Indemnification */}
          <Card>
            <CardHeader>
              <CardTitle>7. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                MIDAS and its affiliates shall not be liable for any direct, indirect, incidental, special, or
                consequential damages resulting from the use or inability to use the service, including but not limited
                to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Medical misdiagnosis or delayed diagnosis</li>
                <li>Treatment decisions based on AI recommendations</li>
                <li>System downtime or technical failures</li>
                <li>Data loss or security breaches</li>
              </ul>
              <p className="text-muted-foreground">
                Users agree to indemnify and hold harmless MIDAS from any claims arising from their use of the service.
              </p>
            </CardContent>
          </Card>

          {/* Compliance and Regulations */}
          <Card>
            <CardHeader>
              <CardTitle>8. Regulatory Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                MIDAS operates in compliance with applicable healthcare regulations, including HIPAA, FDA guidelines,
                and state medical board requirements. Users are responsible for ensuring their use of the service
                complies with all applicable laws and regulations in their jurisdiction.
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card>
            <CardHeader>
              <CardTitle>9. Termination</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Either party may terminate this agreement at any time with written notice. Upon termination, user access
                will be revoked, and data will be handled according to our data retention policy and applicable legal
                requirements. Provisions regarding liability, indemnification, and intellectual property shall survive
                termination.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card>
            <CardHeader>
              <CardTitle>10. Modifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. Users will be notified of material changes via
                email and platform notifications. Continued use of the service after such modifications constitutes
                acceptance of the updated terms.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>11. Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                For questions about these Terms of Service, please contact:
                <br />
                <br />
                MIDAS Legal Department
                <br />
                Email: legal@midas-medical.com
                <br />
                Phone: 1-800-MIDAS-LEGAL
                <br />
                Address: 123 Medical Center Drive, Healthcare City, HC 12345
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/privacy">
            <Button variant="outline" className="bg-transparent">
              View Privacy Policy
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" className="bg-transparent">
              Contact Legal Team
            </Button>
          </Link>
          <Link href="/">
            <Button>Return to MIDAS</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
