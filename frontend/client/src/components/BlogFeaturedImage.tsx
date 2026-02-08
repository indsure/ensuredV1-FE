/**
 * Blog Featured Image Component
 * Generates styled preview cards matching the Analysis Report design aesthetic
 * for each blog article topic
 */

interface BlogFeaturedImageProps {
  articleId: number;
  category: string;
  title: string;
  className?: string;
}

const categoryConfig: Record<string, {
  icon: string;
  color: string;
  metrics: Array<{ label: string; value: string; bgColor: string }>;
  status: string;
  statusColor: string;
  recommendation: string;
}> = {
  "Health Insurance": {
    icon: "🏥",
    color: "bg-green-50 border-green-200",
    metrics: [
      { label: "COVERAGE", value: "₹5L", bgColor: "bg-green-100" },
      { label: "ROOM/DAY", value: "₹4k", bgColor: "bg-yellow-100" },
      { label: "CO-PAY", value: "20%", bgColor: "bg-blue-100" },
    ],
    status: "ADEQUATE",
    statusColor: "#10B981",
    recommendation: "Health insurance protects ₹5L+ annual costs",
  },
  "Life Insurance": {
    icon: "🛡️",
    color: "bg-blue-50 border-blue-200",
    metrics: [
      { label: "COVERAGE", value: "₹1Cr", bgColor: "bg-blue-100" },
      { label: "PREMIUM", value: "₹500/mo", bgColor: "bg-green-100" },
      { label: "TERM", value: "30 Yrs", bgColor: "bg-purple-100" },
    ],
    status: "ESSENTIAL",
    statusColor: "#3B82F6",
    recommendation: "Family protection with ₹1Cr coverage",
  },
  "Vehicle Insurance": {
    icon: "🚗",
    color: "bg-amber-50 border-amber-200",
    metrics: [
      { label: "COVERAGE", value: "₹10L", bgColor: "bg-amber-100" },
      { label: "NCB", value: "50%", bgColor: "bg-green-100" },
      { label: "DEDUCTIBLE", value: "₹1k", bgColor: "bg-blue-100" },
    ],
    status: "REQUIRED",
    statusColor: "#F59E0B",
    recommendation: "Comprehensive coverage protects your vehicle",
  },
  "Home Insurance": {
    icon: "🏠",
    color: "bg-rose-50 border-rose-200",
    metrics: [
      { label: "BUILDING", value: "₹50L", bgColor: "bg-rose-100" },
      { label: "CONTENTS", value: "₹15L", bgColor: "bg-purple-100" },
      { label: "PREMIUM", value: "₹30k/yr", bgColor: "bg-green-100" },
    ],
    status: "RECOMMENDED",
    statusColor: "#F43F5E",
    recommendation: "Protect your biggest asset from disasters",
  },
  "Travel Insurance": {
    icon: "✈️",
    color: "bg-cyan-50 border-cyan-200",
    metrics: [
      { label: "MEDICAL", value: "₹2L", bgColor: "bg-cyan-100" },
      { label: "TRIP COST", value: "₹50k", bgColor: "bg-green-100" },
      { label: "PREMIUM", value: "₹2k", bgColor: "bg-blue-100" },
    ],
    status: "WISE",
    statusColor: "#06B6D4",
    recommendation: "Peace of mind for ₹500-₹3k per trip",
  },
  "Business Insurance": {
    icon: "💼",
    color: "bg-purple-50 border-purple-200",
    metrics: [
      { label: "LIABILITY", value: "₹1Cr", bgColor: "bg-purple-100" },
      { label: "FIRE", value: "₹50L", bgColor: "bg-red-100" },
      { label: "CYBER", value: "₹5Cr", bgColor: "bg-blue-100" },
    ],
    status: "CRITICAL",
    statusColor: "#A855F7",
    recommendation: "Protect your business from ₹crores in risk",
  },
  "General": {
    icon: "📋",
    color: "bg-gray-50 border-gray-200",
    metrics: [
      { label: "TYPES", value: "7+", bgColor: "bg-gray-100" },
      { label: "COVERAGE", value: "All Risks", bgColor: "bg-green-100" },
      { label: "PREMIUM", value: "Varies", bgColor: "bg-blue-100" },
    ],
    status: "COMPREHENSIVE",
    statusColor: "#6B7280",
    recommendation: "Complete guide to all insurance types",
  },
};

export function BlogFeaturedImage({ articleId, category, title, className = "" }: BlogFeaturedImageProps) {
  const config = categoryConfig[category] || categoryConfig["General"];
  
  // Generate policy number based on article ID
  const policyNumber = `POLICY-${String(articleId).padStart(6, '0')}`;
  
  return (
    <div className={`relative w-full h-full ${className}`}>
      <svg
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Gradient */}
        <defs>
          <linearGradient id={`bgGradient-${articleId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FAFBFC" />
            <stop offset="50%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#F3F4F6" />
          </linearGradient>
          <linearGradient id={`cardGradient-${articleId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FAFBFC" />
          </linearGradient>
          <filter id={`shadow-${articleId}`}>
            <feDropShadow dx="0" dy="4" stdDeviation="12" floodOpacity="0.1" />
          </filter>
        </defs>
        
        {/* Background */}
        <rect width="1200" height="630" fill={`url(#bgGradient-${articleId})`} />
        
        {/* Main Card */}
        <rect
          x="100"
          y="80"
          width="1000"
          height="470"
          rx="16"
          fill={`url(#cardGradient-${articleId})`}
          stroke={config.color.includes('green') ? '#D1FAE5' : config.color.includes('blue') ? '#DBEAFE' : config.color.includes('amber') ? '#FEF3C7' : config.color.includes('rose') ? '#FCE7F3' : config.color.includes('cyan') ? '#CFFAFE' : config.color.includes('purple') ? '#F3E8FF' : '#F3F4F6'}
          strokeWidth="2"
          filter={`url(#shadow-${articleId})`}
        />
        
        {/* Header Section */}
        <g transform="translate(140, 120)">
          {/* Icon */}
          <rect x="0" y="0" width="48" height="48" rx="12" fill={config.statusColor} opacity="0.15" />
          <text x="24" y="36" fontSize="28" textAnchor="middle" fill={config.statusColor}>
            {config.icon}
          </text>
          
          {/* Title */}
          <text x="68" y="28" fontSize="28" fontWeight="700" fill="#0F1419" fontFamily="Inter, sans-serif">
            Analysis Report
          </text>
          <text x="68" y="52" fontSize="16" fill="#6B7280" fontFamily="Inter, sans-serif">
            {policyNumber}
          </text>
          
          {/* Status Badge */}
          <rect
            x="900"
            y="8"
            width="140"
            height="36"
            rx="18"
            fill={config.statusColor}
          />
          <text x="970" y="32" fontSize="13" fontWeight="600" textAnchor="middle" fill="#FFFFFF" fontFamily="Inter, sans-serif" letterSpacing="0.02em">
            {config.status}
          </text>
        </g>
        
        {/* Metrics Cards */}
        <g transform="translate(140, 200)">
          {config.metrics.map((metric, index) => (
            <g key={index} transform={`translate(${index * 280}, 0)`}>
              <rect
                width="240"
                height="100"
                rx="12"
                fill={metric.bgColor}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <text
                x="120"
                y="50"
                fontSize="36"
                fontWeight="700"
                textAnchor="middle"
                fill="#0F1419"
                fontFamily="Inter, sans-serif"
              >
                {metric.value}
              </text>
              <text
                x="120"
                y="80"
                fontSize="12"
                fontWeight="600"
                textAnchor="middle"
                fill="#6B7280"
                fontFamily="Inter, sans-serif"
                letterSpacing="0.05em"
              >
                {metric.label}
              </text>
            </g>
          ))}
        </g>
        
        {/* Recommendation Box */}
        <g transform="translate(140, 340)">
          <rect
            width="720"
            height="80"
            rx="12"
            fill={config.metrics[0].bgColor}
            opacity="0.5"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <circle cx="40" cy="40" r="16" fill={config.statusColor} />
          <text x="40" y="48" fontSize="18" textAnchor="middle" fill="#FFFFFF" fontFamily="Inter, sans-serif" fontWeight="700">✓</text>
          <text
            x="72"
            y="35"
            fontSize="18"
            fontWeight="600"
            fill="#0F1419"
            fontFamily="Inter, sans-serif"
          >
            {config.recommendation}
          </text>
          <text
            x="72"
            y="58"
            fontSize="14"
            fill="#6B7280"
            fontFamily="Inter, sans-serif"
          >
            {title}
          </text>
        </g>
        
        {/* Sufficiency Meter */}
        <g transform="translate(140, 460)">
          <text x="0" y="20" fontSize="14" fontWeight="600" fill="#4B5563" fontFamily="Inter, sans-serif">
            Coverage Sufficiency
          </text>
          <rect x="0" y="30" width="600" height="12" rx="6" fill="#E5E7EB" />
          <rect x="0" y="30" width="510" height="12" rx="6" fill={config.statusColor} opacity="0.9" />
          <text x="0" y="58" fontSize="12" fill="#6B7280" fontFamily="Inter, sans-serif">Low</text>
          <text x="580" y="58" fontSize="12" fill="#6B7280" fontFamily="Inter, sans-serif">High</text>
          <text x="620" y="42" fontSize="20" fontWeight="700" fill={config.statusColor} fontFamily="Inter, sans-serif">
            85%
          </text>
        </g>
      </svg>
    </div>
  );
}
