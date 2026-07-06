
import * as React from "react"

interface TabsProps {
  defaultValue?: string
  children: React.ReactNode
  className?: string
}

interface TabsListProps {
  children: React.ReactNode
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

const Tabs = ({ children, className }: TabsProps) => <div className={`w-full ${className || ""}`}>{children}</div>
const TabsList = ({ children }: TabsListProps) => <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">{children}</div>
const TabsTrigger = ({ children }: TabsTriggerProps) => <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow">{children}</button>
const TabsContent = ({ children, className }: TabsContentProps) => <div className={`mt-2 ring-offset-background focus-visible:outline-none ${className || ""}`}>{children}</div>
export { Tabs, TabsList, TabsTrigger, TabsContent }
