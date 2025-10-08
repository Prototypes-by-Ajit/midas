
"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FiberWaves from "@/components/ui/shadcn-io/fiber-waves";
import { Mail, Phone, MapPin, Send, MessageSquare, Users, Calendar, ExternalLink } from "lucide-react";

export default function Contact() {
    const contactMethods = [
        {
            icon: <Mail className="h-6 w-6" />,
            title: "Email Us",
            description: "Drop us a message anytime",
            contact: "hello@midas.ai",
            action: "Send Email",
            color: "from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20"
        },
        {
            icon: <Phone className="h-6 w-6" />,
            title: "Schedule Call",
            description: "Book a consultation",
            contact: "30-min session",
            action: "Book Now",
            color: "from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20"
        },
        {
            icon: <MapPin className="h-6 w-6" />,
            title: "Visit Us",
            description: "Come see our research lab",
            contact: "University at Buffalo",
            action: "Get Directions",
            color: "from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20"
        }
    ];

    const reasons = [
        { icon: <MessageSquare className="h-5 w-5" />, text: "Research Partnerships" },
        { icon: <Users className="h-5 w-5" />, text: "Clinical Pilots" },
        { icon: <Calendar className="h-5 w-5" />, text: "Consultation" },
        { icon: <ExternalLink className="h-5 w-5" />, text: "Media Inquiries" }
    ];

    return (
        <main className="min-h-screen z-0">
            {/* Hero Section with Fiber Waves */}
            <section className="container mx-auto px-4 py-12 md:py-35 relative">
                <FiberWaves
                    className="absolute inset-0 w-full h-full z-0"
                />

                <div className="mx-auto max-w-4xl text-center space-y-6 relative z-10">
                    <motion.h1
                        className="text-3xl md:text-7xl font-extrabold tracking-tight"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        Let's Build the Future Together
                    </motion.h1>

                    <p className="text-muted-foreground text-lg md:text-xl">
                        Ready to revolutionize dermatology with AI? Whether you're a researcher, clinician, or industry partner—we want to collaborate with you.
                    </p>

                    <div className="flex items-center justify-center gap-2">
                        {reasons.map((reason) => (
                            <Badge key={reason.text} variant="secondary" className="flex items-center gap-2">
                                {reason.icon}
                                {reason.text}
                            </Badge>
                        ))}
                    </div>
                </div>
            </section>

            <Separator className="container mx-auto" />

            {/* Main Contact Section */}
            <section className="container mx-auto px-4 py-12 md:py-18">
                <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                    >
                        <Card className="shadow-xl bg-gradient-to-t from-gray-100 via-transparent to-white dark:from-gray-800 dark:via-transparent dark:to-gray-900">
                            <CardHeader>
                                <CardTitle className="text-3xl flex items-center gap-3">
                                    <Send className="h-8 w-8" />
                                    Get in Touch
                                </CardTitle>
                                <p className="text-muted-foreground text-lg">
                                    Tell us about your project and how we can help transform your approach to dermatology.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input id="firstName" placeholder="John" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input id="lastName" placeholder="Doe" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="john@hospital.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="organization">Organization</Label>
                                    <Input id="organization" placeholder="Your Hospital/University" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input id="subject" placeholder="Research Partnership Inquiry" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="message">Message</Label>
                                    <textarea
                                        id="message"
                                        className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        placeholder="Tell us about your vision for AI in dermatology..."
                                    />
                                </div>
                                <Button className="w-full" size="lg">
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Message
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Contact Methods */}
                    <motion.div
                        className="space-y-6"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                    >
                        <div className="space-y-4">
                            <h2 className="text-3xl font-bold">Connect With Us</h2>
                            <p className="text-muted-foreground text-lg">
                                Choose the best way to reach our team. We're here to help and typically respond within 24 hours.
                            </p>
                        </div>

                        {contactMethods.map((method, index) => (
                            <motion.div
                                key={method.title}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.7 + index * 0.1 }}
                                whileHover={{ scale: 1.02, y: -5 }}
                                className="group"
                            >
                                <Card className={`shadow-lg bg-gradient-to-br ${method.color} hover:shadow-xl transition-all duration-300 cursor-pointer`}>
                                    <CardContent className="p-6">
                                        <div className="flex items-start gap-4">
                                            <motion.div
                                                className="p-3 bg-foreground rounded-xl text-background group-hover:scale-110 transition-transform duration-300"
                                                whileHover={{ rotate: 5 }}
                                            >
                                                {method.icon}
                                            </motion.div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-xl mb-2">{method.title}</h3>
                                                <p className="text-muted-foreground mb-2">{method.description}</p>
                                                <p className="font-semibold text-foreground mb-4">{method.contact}</p>
                                                <Button variant="outline" size="sm" className="group-hover:bg-foreground group-hover:text-background transition-all duration-300">
                                                    {method.action}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}

                        {/* Quick Info Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 1 }}
                        >
                            <Card className="bg-gradient-to-br from-gray-100 via-transparent to-white dark:from-gray-800 dark:via-transparent dark:to-gray-900">
                                <CardContent className="p-6">
                                    <h3 className="font-bold text-lg mb-4">Quick Info</h3>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Response Time:</span>
                                            <span className="font-medium">Within 24 hours</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Office Hours:</span>
                                            <span className="font-medium">Mon-Fri, 9AM-6PM EST</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Time Zone:</span>
                                            <span className="font-medium">Eastern Time (US)</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="border-t bg-muted/40">
                <div className="container mx-auto px-4 py-12 md:py-16">
                    <motion.div
                        className="text-center max-w-4xl mx-auto"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.2 }}
                    >
                        <h3 className="text-4xl font-bold mb-6">Ready to Transform Healthcare?</h3>
                        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                            Join us in building the next generation of AI-powered dermatology tools. Whether you're interested in research partnerships, clinical pilots, or technical collaboration—we'd love to hear from you.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" className="text-lg px-8">
                                <Calendar className="h-5 w-5 mr-2" />
                                Schedule Demo
                            </Button>
                            <Button variant="outline" size="lg" className="text-lg px-8">
                                <ExternalLink className="h-5 w-5 mr-2" />
                                View Research
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}