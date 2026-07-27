import { useEffect, useState } from 'react'
import { Redirect } from 'wouter'
import { supabase } from '@/lib/supabase'
import AgentLayout from './AgentLayout'
import { AgentProvider } from '../../context/AgentContext'

export default function AgentProtectedRoute({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState<any>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setLoading(false)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })
        return () => subscription.unsubscribe()
    }, [])

    if (loading) return (
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
        </div>
    )

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