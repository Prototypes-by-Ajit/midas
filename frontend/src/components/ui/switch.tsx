"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps {
  id?: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, defaultChecked = false, checked, onCheckedChange, disabled = false, className, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(checked ?? defaultChecked)
    
    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked)
      }
    }, [checked])
    
    const handleClick = () => {
      if (disabled) return
      const newChecked = !isChecked
      setIsChecked(newChecked)
      onCheckedChange?.(newChecked)
    }
    
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isChecked 
            ? "bg-black dark:bg-white" 
            : "bg-gray-200 dark:bg-gray-800",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform",
            isChecked 
              ? "translate-x-5 bg-white dark:bg-black" 
              : "translate-x-0 bg-white dark:bg-gray-300"
          )}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
