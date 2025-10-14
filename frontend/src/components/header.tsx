"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import useNavigationLoading from "@/hooks/use-navigation-loading";




export default function Header() {
  const { navigateWithLoading } = useNavigationLoading()

  const handleSignInClick = () => {
    navigateWithLoading('/login', 'Redirecting to Sign In...', 600)
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 w-full z-[100] border-b border-white/10 backdrop-blur-xl bg-black/30 dark:bg-black/30 supports-[backdrop-filter]:bg-white/10 supports-[backdrop-filter]:dark:bg-black/10">
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
            <Button onClick={handleSignInClick}>Sign In</Button>
          </div>
        </div>
      </div>
    </header>
    </>
  )
}
