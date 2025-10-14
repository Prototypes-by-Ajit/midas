"use client";

import { LoadingProvider } from "@/contexts/loading-context";

export interface Layout { 
    children: React.ReactNode;
}

export default function LoginLayout({ children }: Layout) { 
    return (
        <LoadingProvider>
            <div className="min-h-screen">
                {children}
            </div>
        </LoadingProvider>
    );
}
