import { useEffect, useState } from 'react'
import { Redirect } from 'wouter'
import { supabase } from '@/lib/supabase'
import AgentLayout from './AgentLayout'
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