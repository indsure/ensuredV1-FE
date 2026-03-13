import { useState, useEffect } from 'react';
import {
  User,
  Building,
  MapPin,
  Phone,
  Shield,
  Save,
  LogOut,
  KeyRound,
  Mail,
  X,
  Plus,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';

const INSURERS = [
  'Star Health', 'Care Health', 'Niva Bupa', 'HDFC ERGO', 'ICICI Lombard',
  'Aditya Birla', 'Bajaj Allianz', 'ManipalCigna', 'SBI General', 'Tata AIG',
  'Digit', 'Acko', 'Navi', 'Reliance General', 'Royal Sundaram', 'Future Generali',
  'Universal Sompo', 'National Insurance', 'New India Assurance', 'Oriental Insurance', 'United India'
];

export default function AgentSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  
  // Profile Data
  const [profile, setProfile] = useState({
    full_name: '',
    phone_number: '',
    city: '',
    firm_name: '',
    upload_limit: 50
  });
  
  // Empanelments
  const [empanelments, setEmpanelments] = useState<string[]>([]);
  const [newInsurer, setNewInsurer] = useState('');
  const [showInsurerDropdown, setShowInsurerDropdown] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchProfile = async (uid: string) => {
    try {
      // 1. Fetch from custom /me endpoint since RLS blocks direct client query to `agents`
      const res = await fetch('/api/agent/me', { headers: { 'x-user-id': uid } });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          full_name: data.full_name || '',
          phone_number: data.phone_number || '',
          city: data.city || '',
          firm_name: data.firm_name || '',
          upload_limit: data.upload_limit || 50
        });
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setEmail(user.email || '');
      }

      // 2. Fetch Empanelments (public table)
      const { data: empData, error } = await supabase
        .from('empanelments')
        .select('insurer_name')
        .eq('agent_id', uid);

      if (!error && empData) {
        setEmpanelments(empData.map((e: any) => e.insurer_name));
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    }
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchProfile(user.id);
      }
    }
    init();
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/agent/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          city: profile.city,
          firm_name: profile.firm_name
        })
      });

      if (!res.ok) throw new Error('Failed to update profile');
      toast({ title: 'Profile Updated', description: 'Your information has been saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const addEmpanelment = async (insurer: string) => {
    if (!userId || empanelments.includes(insurer)) {
      setNewInsurer('');
      setShowInsurerDropdown(false);
      return;
    }

    try {
      const { error } = await supabase.from('empanelments').insert({
        agent_id: userId,
        insurer_name: insurer
      });
      if (error) throw error;
      
      setEmpanelments([...empanelments, insurer]);
      setNewInsurer('');
      setShowInsurerDropdown(false);
      toast({ title: 'Empanelment Added', description: `${insurer} added successfully.` });
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    }
  };

  const removeEmpanelment = async (insurer: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('empanelments')
        .delete()
        .match({ agent_id: userId, insurer_name: insurer });
        
      if (error) throw error;
      setEmpanelments(empanelments.filter(e => e !== insurer));
      toast({ title: 'Empanelment Removed', description: `${insurer} removed from your profile.` });
    } catch (err: any) {
      toast({ title: 'Failed to remove', description: err.message, variant: 'destructive' });
    }
  };

  const handleResetPassword = async () => {
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/agent/reset-password`
      });
      if (error) throw error;
      toast({ 
        title: 'Reset Password Email Sent', 
        description: `Check your inbox (${email}) for the reset link.` 
      });
    } catch (err: any) {
      toast({ title: 'Failed to send reset link', description: err.message, variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/agent/login';
  };

  const filteredInsurers = INSURERS.filter(i => 
    i.toLowerCase().includes(newInsurer.toLowerCase()) && !empanelments.includes(i)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A]">Settings</h2>
          <p className="text-[#64748B] text-sm mt-1">Manage your account, profile, and system preferences.</p>
        </div>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100">
        <h3 className="font-serif text-xl font-bold text-[#0F172A] mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
          <User className="text-[#0D9488]" size={20} /> Personal Profile
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User size={14} className="text-slate-400" /> Full Name
            </label>
            <input 
              name="full_name"
              value={profile.full_name}
              onChange={handleProfileChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] transition-all"
              placeholder="e.g. Rahul Sharma"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building size={14} className="text-slate-400" /> Firm / Agency Name
            </label>
            <input 
              name="firm_name"
              value={profile.firm_name}
              onChange={handleProfileChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] transition-all"
              placeholder="e.g. RS Associates Ltd"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Phone size={14} className="text-slate-400" /> Phone Number
            </label>
            <input 
              name="phone_number"
              value={profile.phone_number}
              onChange={handleProfileChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] transition-all"
              placeholder="e.g. +91 9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" /> City
            </label>
            <input 
              name="city"
              value={profile.city}
              onChange={handleProfileChange}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] transition-all"
              placeholder="e.g. Mumbai"
            />
          </div>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Batch Upload Limit</p>
            <p className="text-xs text-slate-500 mt-1">Your current allowance: <strong className="text-[#0D9488]">{profile.upload_limit} policies per batch</strong></p>
          </div>
          <a 
            href="mailto:support@indsure.ai?subject=Request%20Higher%20Agent%20Plan%20Limit"
            className="text-sm font-semibold text-[#0D9488] hover:underline"
          >
            Need a higher limit? Contact us
          </a>
        </div>

        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#0B1120] hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-md transition-all disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} 
            Save Profile Changes
          </button>
        </div>
      </div>

      {/* Empanelments Section */}
      <div className="bg-white rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100">
        <h3 className="font-serif text-xl font-bold text-[#0F172A] mb-2 flex items-center gap-2">
          <Shield className="text-[#0D9488]" size={20} /> Registered Empanelments
        </h3>
        <p className="text-sm text-slate-500 mb-6 pb-4 border-b border-slate-100">
          We use this to prioritize Switch recommendations towards your existing insurance partners.
        </p>

        <div className="mb-6">
          <div className="relative w-full max-w-sm">
            <input 
              type="text"
              placeholder="Type to search and add an insurer..."
              value={newInsurer}
              onChange={e => {
                setNewInsurer(e.target.value);
                setShowInsurerDropdown(true);
              }}
              onFocus={() => setShowInsurerDropdown(true)}
              className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] transition-all"
            />
            <Plus size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            
            {showInsurerDropdown && newInsurer && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredInsurers.length > 0 ? (
                  filteredInsurers.map(ins => (
                    <button
                      key={ins}
                      onClick={() => addEmpanelment(ins)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-medium transition-colors"
                    >
                      {ins}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-500 italic">No matching insurers found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {empanelments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No preferred insurers added yet.</p>
          ) : (
            empanelments.map(ins => (
              <span key={ins} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0D9488]/10 text-[#0D9488] rounded-full text-sm font-semibold border border-[#0D9488]/20 group">
                <Shield size={14} /> {ins}
                <button 
                  onClick={() => removeEmpanelment(ins)}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#0D9488] hover:text-white transition-colors ml-1"
                >
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-red-100">
        <h3 className="font-serif text-xl font-bold text-red-700 mb-6 pb-4 border-b border-red-50 flex items-center gap-2">
          Danger Zone
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={handleResetPassword}
            className="flex items-center justify-center gap-2 w-full p-4 border border-slate-200 rounded-xl hover:border-[#0D9488] hover:bg-slate-50 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-[#0D9488]/10 group-hover:text-[#0D9488] transition-colors">
              <KeyRound size={20} />
            </div>
            <div className="text-left flex-1 pl-2">
              <p className="text-sm font-bold text-[#0F172A]">Reset Password</p>
              <p className="text-xs text-slate-500">Send an email link</p>
            </div>
            <Mail size={16} className="text-slate-300 group-hover:text-[#0D9488]" />
          </button>

          <button 
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full p-4 border border-red-100 rounded-xl hover:bg-red-50 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center group-hover:bg-red-200 transition-colors">
              <LogOut size={20} />
            </div>
            <div className="text-left flex-1 pl-2">
              <p className="text-sm font-bold text-red-700">Sign Out</p>
              <p className="text-xs text-red-500">End current session</p>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
}
