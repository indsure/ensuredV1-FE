import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

interface PDFPasswordModalProps {
  open: boolean;
  fileName: string;
  onPasswordSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string | null;
}

export function PDFPasswordModal({
  open,
  fileName,
  onPasswordSubmit,
  onCancel,
  error,
}: PDFPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password);
      setPassword(""); // Clear password after submit
    }
  };

  const handleCancel = () => {
    setPassword("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Lock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="text-xl">PDF Password Required</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            This PDF is password-protected. Please enter the password to continue analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Name */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">File:</p>
            <p className="text-sm font-medium text-[#0F1419] dark:text-[#FAFBFC] truncate">
              {fileName}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Password Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pdf-password" className="text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC] mb-2 block">
                PDF Password
              </Label>
              <div className="relative">
                <Input
                  id="pdf-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter PDF password"
                  className="pr-10 h-11"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0F1419] dark:hover:text-[#FAFBFC] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1.5">
                Your password is not stored. It's only used to unlock the PDF for analysis.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!password.trim()}
                className="flex-1 bg-[#00B4D8] hover:bg-[#0099B4] text-white"
              >
                Unlock & Analyze
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
