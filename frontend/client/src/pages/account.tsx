import { Link, useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowLeft, Shield, LogOut, FileText, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { User, Lock, Bell, Trash2, Eye, EyeOff } from "lucide-react";

interface FormData {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  notifications: boolean;
  marketing: boolean;
}

// ARCHIVED: import { useAuth } from "@/hooks/use-auth";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export default function Account() {
  const { user, isLoading, logout } = {
    user: null as any,
    isLoading: false,
    logout: async () => {},
  }; // ARCHIVED: const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true });

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    setLocation("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-[var(--color-cream-main)] min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-muted)] font-sans">Loading…</div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const [formData, setFormData] = useState<FormData>({
    name: user?.name || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    notifications: false,
    marketing: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <div className="bg-[var(--color-navy-900)] text-white font-sans min-h-screen flex flex-col">
      <Header />

      <main
        id="main-content"
        className="flex-1 container mx-auto px-4 sm:px-6 pt-32 sm:pt-36 md:pt-40 pb-8 sm:pb-12 max-w-4xl"
        role="main">
        {/* Page Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Account Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account preferences and settings
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal details
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="your.email@example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Change your password</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currentPassword: e.target.value,
                      })
                    }
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm new password"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1A3A52] to-[#4A9B9E] flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Manage your notification preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label
                    htmlFor="notifications"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Notifications
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Receive updates about your policy analysis
                  </p>
                </div>
                <input
                  id="notifications"
                  type="checkbox"
                  checked={formData.notifications}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notifications: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-[#1A3A52] rounded"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <label
                    htmlFor="marketing"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Marketing Communications
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Receive tips and updates about insurance
                  </p>
                </div>
                <input
                  id="marketing"
                  type="checkbox"
                  checked={formData.marketing}
                  onChange={(e) =>
                    setFormData({ ...formData, marketing: e.target.checked })
                  }
                  className="w-4 h-4 text-[#1A3A52] rounded"
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-red-600 dark:text-red-400">
                    Danger Zone
                  </CardTitle>
                  <CardDescription>Irreversible actions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Delete Account
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button variant="destructive" type="button">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <Link href="/">
              <span className="inline-flex items-center gap-1 text-sm text-[var(--color-white-muted)] hover:text-white transition-colors cursor-pointer mb-6">
                <ArrowLeft className="w-4 h-4" /> Back
              </span>
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-5xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] mb-4 text-white">
              Your{" "}
              <span className="text-[var(--color-teal-400)]">profile.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-lg text-[var(--color-white-muted)]">
              Welcome back,{" "}
              <span className="font-medium text-white">{user?.username}</span>
            </motion.p>
          </div>
        </form>

        {/* Content — Cream */}
        <section
          ref={sectionRef}
          className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] py-16 border-t border-[var(--color-border-light)]">
          <div className="container-editorial px-6">
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Account Details Card */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                className="bg-white rounded-2xl border border-[var(--color-border-light)] p-8 shadow-2xl shadow-[rgba(0,0,0,0.05)] border-t-4 border-t-[var(--color-teal-600)]">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-[var(--color-navy-900)] rounded-md flex items-center justify-center text-[var(--color-teal-400)]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-[var(--color-navy-900)]">
                      Account Details
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Your profile information
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-[var(--color-cream-main)] border border-[var(--color-border-light)]">
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                      Username
                    </span>
                    <div className="text-lg font-bold text-[var(--color-navy-900)] mt-1">
                      {user?.username}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--color-cream-main)] border border-[var(--color-border-light)]">
                    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                      Role
                    </span>
                    <div className="text-lg font-bold text-[var(--color-navy-900)] mt-1 capitalize">
                      {user?.role}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[var(--color-cream-main)] border border-[var(--color-border-light)]">
                  <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                    Member Since
                  </span>
                  <div className="text-lg font-bold text-[var(--color-navy-900)] mt-1">
                    {memberSince}
                  </div>
                </div>
              </motion.div>

              {/* Analysis History Card */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-[var(--color-border-light)] p-8 shadow-lg shadow-[rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-[var(--color-cream-main)] border border-[var(--color-border-light)] rounded-md flex items-center justify-center text-[var(--color-teal-600)]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-[var(--color-navy-900)]">
                      Analysis History
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Your past policy analyses
                    </p>
                  </div>
                </div>

                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-[var(--color-cream-main)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--color-border-light)]">
                    <FileText className="w-7 h-7 text-[var(--color-text-muted)] opacity-50" />
                  </div>
                  <p className="font-serif font-bold text-lg text-[var(--color-navy-900)]">
                    Coming Soon
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-xs mx-auto">
                    Your analysis history will appear here once connected.
                  </p>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <Link href="/policychecker">
                  <button className="bg-[var(--color-teal-600)] text-white px-8 py-4 rounded-lg font-medium hover:bg-[var(--color-teal-400)] transition-colors flex items-center gap-2 shadow-lg shadow-teal-900/20">
                    Analyze a Policy <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-8 py-4 rounded-lg font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
