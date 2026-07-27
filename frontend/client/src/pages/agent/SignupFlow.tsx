import { Route, Switch } from "wouter"

import AgentSignupStep1 from "@/pages/agent/SignupStep1"
import AgentSignupStep2 from "@/pages/agent/SignupStep2"

export default function SignupFlow() {
  return (
    <Switch>
      <Route path="/agent/signup" component={AgentSignupStep1} />
      <Route path="/agent/signup/empanelment" component={AgentSignupStep2} />
      <Route component={AgentSignupStep1} />
    </Switch>
  )
}

