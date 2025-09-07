import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: January 15, 2024 | Effective Date: January 15, 2024</p>
        </div>

        <div className="space-y-8">
          {/* HIPAA Compliance Notice */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">HIPAA Compliance Notice</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">
                MIDAS is fully compliant with the Health Insurance Portability and Accountability Act (HIPAA) and
                follows all required safeguards for protecting your health information. This notice describes how
                medical information about you may be used and disclosed and how you can get access to this information.
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card>
            <CardHeader>
              <CardTitle>Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Protected Health Information (PHI)</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Medical images and diagnostic data</li>
                  <li>Analysis results and AI predictions</li>
                  <li>Clinical notes and doctor reviews</li>
                  <li>Medical history and risk factors</li>
                  <li>Treatment recommendations and follow-up plans</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Name, date of birth, and contact information</li>
                  <li>Account credentials and authentication data</li>
                  <li>Device information and IP addresses</li>
                  <li>Usage patterns and system interactions</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Information */}
          <Card>
            <CardHeader>
              <CardTitle>How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Treatment</h3>
                  <p className="text-muted-foreground">
                    We use your health information to provide AI-powered skin cancer analysis, generate diagnostic
                    reports, and facilitate communication between you and your healthcare providers.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Payment</h3>
                  <p className="text-muted-foreground">
                    We may use your information for billing purposes and to process payments for services rendered.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Healthcare Operations</h3>
                  <p className="text-muted-foreground">
                    We use aggregated, de-identified data to improve our AI models, conduct quality assurance, and
                    ensure system security and compliance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card>
            <CardHeader>
              <CardTitle>Data Security and Protection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Encryption</h3>
                <p className="text-muted-foreground">
                  All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Database
                  connections are secured and monitored continuously.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Access Controls</h3>
                <p className="text-muted-foreground">
                  We implement role-based access controls, multi-factor authentication, and regular access reviews to
                  ensure only authorized personnel can access your information.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Audit Logging</h3>
                <p className="text-muted-foreground">
                  All access to patient data is logged and monitored. Audit trails are maintained for compliance and
                  security purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card>
            <CardHeader>
              <CardTitle>Your Rights Under HIPAA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Right to Access</h3>
                  <p className="text-muted-foreground">
                    You have the right to inspect and obtain copies of your health information that we maintain.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Right to Amend</h3>
                  <p className="text-muted-foreground">
                    You may request amendments to your health information if you believe it is incorrect or incomplete.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Right to Restrict</h3>
                  <p className="text-muted-foreground">
                    You may request restrictions on how we use or disclose your health information.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Right to Accounting</h3>
                  <p className="text-muted-foreground">
                    You have the right to receive an accounting of disclosures of your health information.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card>
            <CardHeader>
              <CardTitle>Data Retention and Deletion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We retain your health information for as long as necessary to provide services and comply with legal
                requirements. Medical records are typically retained for 7 years after the last treatment date, or
                longer if required by law.
              </p>
              <p className="text-muted-foreground">
                You may request deletion of your account and associated data at any time, subject to legal retention
                requirements. Upon deletion, your data will be securely destroyed using industry-standard methods.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Privacy Officer</h3>
                <p className="text-muted-foreground">
                  Email: privacy@midas-medical.com
                  <br />
                  Phone: 1-800-MIDAS-HELP
                  <br />
                  Address: 123 Medical Center Drive, Healthcare City, HC 12345
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">File a Complaint</h3>
                <p className="text-muted-foreground">
                  If you believe your privacy rights have been violated, you may file a complaint with us or with the
                  U.S. Department of Health and Human Services Office for Civil Rights.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We reserve the right to change this privacy policy. We will notify you of any material changes by
                posting the updated policy on our website and sending notification to your registered email address.
                Your continued use of our services after such changes constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/terms">
            <Button variant="outline" className="bg-transparent">
              View Terms of Service
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" className="bg-transparent">
              Contact Privacy Officer
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
