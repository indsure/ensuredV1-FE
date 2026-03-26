
import * as React from "react"
const Tabs = ({ defaultValue, children }: any) => <div className="w-full">{children}</div>
const TabsList = ({ children }: any) => <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">{children}</div>
const TabsTrigger = ({ value, children }: any) => <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow">{children}</button>
const TabsContent = ({ value, children }: any) => <div className="mt-2 ring-offset-background focus-visible:outline-none">{children}</div>
export { Tabs, TabsList, TabsTrigger, TabsContent }
