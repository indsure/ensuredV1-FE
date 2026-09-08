import { useEffect, useState } from 'react'
import { Redirect } from 'wouter'
import { supabase } from '@/lib/supabase'
import AgentLayout from './AgentLayout'
import { preloadAgentRoutes } from '@/pages/agent/lazyRoutes'
import { AgentProvider } from '../../context/AgentContext'

export default function AgentProtectedRoute({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState<any>(null)
    // null = unknown/not checked yet, true/false = whether the signed-in user
    // is a registered advisor. Consumer accounts share the same auth pool, so a
    // session alone is not enough to enter the advisor workspace.
    const [isAgent, setIsAgent] = useState<boolean | null>(null)

    async function checkAgent(session: any) {
        if (!session?.user?.id) { setIsAgent(false); return }
        const { data } = await supabase
            .from('agents')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle()
        setIsAgent(!!data)
    }

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session)
            await checkAgent(session)
            setLoading(false)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            void checkAgent(session)
        })
        return () => subscription.unsubscribe()
    }, [])

    // The workspace is one SPA but twenty-odd route chunks, so without this the
    // first visit to each screen pays a network round trip and shows the page
    // skeleton. Pull the whole portal down as soon as there is a session, so by
    // the time they reach for the nav every screen is already in memory.
    //
    // Fires on the session alone rather than waiting for `isAgent`, which costs
    // a round trip to the agents table. A signed-in consumer who wanders onto an
    // /agent/* URL warms chunks they will not use before being redirected; that
    // is a rare path, and the wait it would otherwise add sits in front of every
    // real advisor. Usually a no-op anyway: the login screen started this.
    useEffect(() => {
        if (session) preloadAgentRoutes()
    }, [session])

    if (loading) return (
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
        </div>
    )

    if (session && isAgent === false) {
        return <Redirect to="/agent/login" />
    }

    return session ? (
        <AgentProvider>
            <AgentLayout>
                {children}
            </AgentLayout>
        </AgentProvider>
    ) : (
        <Redirect to="/agent/login" />
    )
}