import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AgentLayout from './AgentLayout'

export default function AgentProtectedRoute() {
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
        <AgentLayout>
            <Outlet />
        </AgentLayout>
    ) : (
        <Navigate to="/agent/login" replace />
    )
}
