import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "dashboard/src/components/ui");
fs.mkdirSync(dir, { recursive: true });

function writeUI(name, content) {
    fs.writeFileSync(path.join(dir, name + ".tsx"), content);
}

writeUI("button", `
import * as React from "react"
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: string }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, ...props }, ref) => {
  return <button ref={ref} className={"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2 " + (className || "")} {...props} />
})
Button.displayName = "Button"
export { Button }
`);

writeUI("card", `
import * as React from "react"
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={"rounded-xl border bg-card text-card-foreground shadow " + (className || "")} {...props} />
))
Card.displayName = "Card"
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={"flex flex-col space-y-1.5 p-6 " + (className || "")} {...props} />
))
CardHeader.displayName = "CardHeader"
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={"font-semibold leading-none tracking-tight " + (className || "")} {...props} />
))
CardTitle.displayName = "CardTitle"
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={"p-6 pt-0 " + (className || "")} {...props} />
))
CardContent.displayName = "CardContent"
export { Card, CardHeader, CardTitle, CardContent }
`);

writeUI("badge", `
import * as React from "react"
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> { variant?: string }
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none " + (className || "")} {...props} />
}
export { Badge }
`);

writeUI("tabs", `
import * as React from "react"
const Tabs = ({ defaultValue, children }: any) => <div className="w-full">{children}</div>
const TabsList = ({ children }: any) => <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">{children}</div>
const TabsTrigger = ({ value, children }: any) => <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow">{children}</button>
const TabsContent = ({ value, children }: any) => <div className="mt-2 ring-offset-background focus-visible:outline-none">{children}</div>
export { Tabs, TabsList, TabsTrigger, TabsContent }
`);

console.log("Mock Shadcn UI primitives created successfully!");
