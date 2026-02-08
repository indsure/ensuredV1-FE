import { useState } from "react";
import { Twitter, Linkedin, Facebook, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  compact?: boolean;
}

export function ShareButtons({ url, title, description, compact = false }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : url;
  const shareTitle = title;
  const shareDescription = description || "";

  const handleShare = (platform: "twitter" | "linkedin" | "facebook") => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);
    const encodedDescription = encodeURIComponent(shareDescription);

    let shareLink = "";

    switch (platform) {
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
        break;
      case "linkedin":
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "width=600,height=400");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleShare("twitter")}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on Twitter"
        >
          <Twitter className="w-5 h-5 text-[#1DA1F2]" />
        </button>
        <button
          onClick={() => handleShare("linkedin")}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="w-5 h-5 text-[#0077B5]" />
        </button>
        <button
          onClick={() => handleShare("facebook")}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Share on Facebook"
        >
          <Facebook className="w-5 h-5 text-[#1877F2]" />
        </button>
        <button
          onClick={handleCopy}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Copy link"
        >
          {copied ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Link2 className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-[#0F1419] dark:text-[#FAFBFC]">Share this article</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleShare("twitter")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-[#0F1419] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:scale-110"
          aria-label="Share on Twitter"
        >
          <Twitter className="w-5 h-5 text-[#1DA1F2]" />
        </button>
        <button
          onClick={() => handleShare("linkedin")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-[#0F1419] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:scale-110"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="w-5 h-5 text-[#0077B5]" />
        </button>
        <button
          onClick={() => handleShare("facebook")}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-[#0F1419] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:scale-110"
          aria-label="Share on Facebook"
        >
          <Facebook className="w-5 h-5 text-[#1877F2]" />
        </button>
        <button
          onClick={handleCopy}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-[#0F1419] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:scale-110"
          aria-label="Copy link"
        >
          {copied ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Link2 className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
          )}
        </button>
      </div>
    </div>
  );
}
