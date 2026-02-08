import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { useComparison } from "@/hooks/use-comparison";
import { useTheme } from "@/hooks/use-theme";
import { Combobox } from "@/components/ui/combobox";
import { getAllStates, getCitiesForState } from "@/lib/indian-cities-data";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function ProfileStep() {
  const [, setLocation] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { profile, setProfile } = useComparison();
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [selectedState, setSelectedState] = useState<string>(profile.state || "");

  // Clear on unmount (when navigating away)
  useEffect(() => {
    return () => {
      const isStillInCompareFlow = window.location.pathname.startsWith("/compare");
      if (!isStillInCompareFlow) {
        sessionStorage.removeItem("ensured_comparison_policies");
        sessionStorage.removeItem("ensured_comparison_profile");
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F0FFFE] dark:bg-[#0F1419] relative flex flex-col">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-blue-400/30 dark:bg-blue-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 -right-40 w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-400/25 dark:bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>
      {/* Header */}
      <Header />
      <Breadcrumbs items={[{ label: "Compare" }]} />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1 bg-[#E5E7EB] dark:bg-[#374151] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#00B4D8] to-[#10B981] rounded-full transition-all duration-600 ease-out"
              style={{ width: '67%' }}
            />
          </div>
        </div>

        <Card className="shadow-lg border-gray-200 dark:border-gray-600 bg-white/90 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Your Profile
            </CardTitle>
            <CardDescription className="text-base mt-1 text-gray-700 dark:text-gray-300">
              Tell us about yourself to get personalized policy recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Age */}
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Age <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="age"
                  type="number"
                  min="1"
                  max="100"
                  value={profile.age || ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                    setProfile((prev) => ({ ...prev, age: value }));
                    if (profileErrors.age) {
                      setProfileErrors((prev) => ({ ...prev, age: undefined }));
                    }
                  }}
                  placeholder="Enter your age"
                  className="h-10 text-gray-900 dark:text-gray-100"
                />
                {profileErrors.age && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {profileErrors.age}
                  </p>
                )}
              </div>

              {/* Household Income */}
              <div className="space-y-2">
                <Label htmlFor="income" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Annual Household Income (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="income"
                  type="number"
                  min="0"
                  value={profile.householdIncome || ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                    setProfile((prev) => ({ ...prev, householdIncome: value }));
                    if (profileErrors.householdIncome) {
                      setProfileErrors((prev) => ({ ...prev, householdIncome: undefined }));
                    }
                  }}
                  placeholder="e.g., 1000000"
                  className="h-10 text-gray-900 dark:text-gray-100"
                />
                {profileErrors.householdIncome && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {profileErrors.householdIncome}
                  </p>
                )}
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label htmlFor="state" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  State <span className="text-red-500">*</span>
                </Label>
                <Combobox
                  options={getAllStates().map((state) => ({
                    value: state,
                    label: state,
                  }))}
                  value={selectedState}
                  onValueChange={(value) => {
                    setSelectedState(value);
                    setProfile((prev) => ({ ...prev, state: value, city: "" }));
                    if (profileErrors.state) {
                      setProfileErrors((prev) => ({ ...prev, state: undefined }));
                    }
                  }}
                  placeholder="Select your state"
                  searchPlaceholder="Search state..."
                  emptyMessage="No state found"
                  className={`h-10 ${profileErrors.state ? "border-red-500" : ""}`}
                />
                {profileErrors.state && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {profileErrors.state}
                  </p>
                )}
              </div>

              {/* City */}
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  City <span className="text-red-500">*</span>
                </Label>
                {selectedState ? (
                  <Combobox
                    options={getCitiesForState(selectedState).map((city) => ({
                      value: city,
                      label: city,
                    }))}
                    value={profile.city}
                    onValueChange={(value) => {
                      setProfile((prev) => ({ ...prev, city: value }));
                      if (profileErrors.city) {
                        setProfileErrors((prev) => ({ ...prev, city: undefined }));
                      }
                    }}
                    placeholder="Select your city"
                    searchPlaceholder="Search city..."
                    emptyMessage="No city found"
                    className={`h-10 ${profileErrors.city ? "border-red-500" : ""}`}
                  />
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
                    Please select a state first
                  </div>
                )}
                {profileErrors.city && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {profileErrors.city}
                  </p>
                )}
              </div>

              {/* Family Size */}
              <div className="space-y-2">
                <Label htmlFor="familySize" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Family Size <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="familySize"
                  type="number"
                  min="1"
                  max="20"
                  value={profile.familySize || ""}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : undefined;
                    setProfile((prev) => ({ ...prev, familySize: value }));
                    if (profileErrors.familySize) {
                      setProfileErrors((prev) => ({ ...prev, familySize: undefined }));
                    }
                  }}
                  placeholder="Number of family members"
                  className="h-10 text-gray-900 dark:text-gray-100"
                />
                {profileErrors.familySize && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {profileErrors.familySize}
                  </p>
                )}
              </div>

            </div>

            {/* Pre-existing Conditions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Pre-existing Conditions (Select all that apply)
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: "diabetes", label: "Diabetes" },
                  { id: "hypertension", label: "Hypertension" },
                  { id: "cardiac", label: "Cardiac History" },
                  { id: "cancer", label: "Cancer History" },
                  { id: "none", label: "None" },
                ].map((condition) => (
                  <div key={condition.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={condition.id}
                      checked={profile.preExistingConditions.includes(condition.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          if (condition.id === "none") {
                            setProfile((prev) => ({ ...prev, preExistingConditions: ["none"] }));
                          } else {
                            setProfile((prev) => ({
                              ...prev,
                              preExistingConditions: prev.preExistingConditions
                                .filter((c) => c !== "none")
                                .concat(condition.id),
                            }));
                          }
                        } else {
                          setProfile((prev) => ({
                            ...prev,
                            preExistingConditions: prev.preExistingConditions.filter((c) => c !== condition.id),
                          }));
                        }
                      }}
                    />
                    <Label
                      htmlFor={condition.id}
                      className="text-sm font-normal text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      {condition.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-4 pt-4">
              <Button variant="outline" onClick={() => setLocation("/compare")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => {
                  // Validate
                  const errors: Record<string, string> = {};
                  if (!profile.age || profile.age < 1 || profile.age > 100) {
                    errors.age = "Please enter a valid age (1-100)";
                  }
                  if (!profile.householdIncome || profile.householdIncome < 0) {
                    errors.householdIncome = "Please enter a valid annual income";
                  }
                  if (!profile.state) {
                    errors.state = "Please select your state";
                  }
                  if (!profile.city) {
                    errors.city = "Please select your city";
                  }
                  if (!profile.familySize || profile.familySize < 1) {
                    errors.familySize = "Please enter a valid family size";
                  }

                  if (Object.keys(errors).length > 0) {
                    setProfileErrors(errors);
                    return;
                  }

                  setProfileErrors({});
                  setLocation("/compare/results");
                }}
                className="bg-[#1A3A52] hover:bg-[#2d5a7b] dark:bg-[#4A9B9E] dark:hover:bg-[#5aabb0]"
              >
                Compare Policies
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

