import Link from "next/link";
import { Button } from "@/components/ui/button";




export default function Header() {
  return (
    <header className="fixed top-0 min-w-screen z-50 border-b-1 border-gray-500 backdrop-blur-xl bg-transparent">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">M</span>
            </div>

            <Link href="/" className="text-2xl font-bold text-foreground cursor-pointer">MIDAS</Link>
          </div>

          <div className="max-w-2xl w-full p-2">
            <ul className="flex flex-row justify-center gap-4">
              <li>
                <Link href="/aboutus" className="text-foreground font-bold text-lg">
                  About Us
                </Link>
              </li>
              
              {/* <li>
                <Link href="/help" className="text-foreground font-bold text-lg">
                  Help
                </Link>
              </li> */}
            </ul>
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
  )
}