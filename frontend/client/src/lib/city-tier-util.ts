// Utility to determine "Insurance City Tier"
// Used to calculate premiums and identify zone-based co-pays
import { getZoneForCity, ZoneType } from "./data/zones";

export type CityTier = 1 | 2 | 3;

export function getCityTier(city: string): CityTier {
    if (!city) return 3;

    const zone = getZoneForCity(city);

    if (!zone) return 3; // Default for unknown cities

    switch (zone) {
        case "A": return 1; // Metro / Highest
        case "B": return 2; // Tier 1 / Moderate
        case "C": return 3; // Tier 2/3 / Lower
        case "D": return 2; // NCR Extended (Technically high, but often priced as Tier 2 or between)
        default: return 3;
    }
}

export function getTierDescription(tier: CityTier): string {
    if (tier === 1) return "Metro (Zone A) - Highest Medical Costs";
    if (tier === 2) return "Tier 1 (Zone B / D) - Moderate Medical Costs";
    return "Tier 2/3 (Zone C) - Lowest Medical Costs";
}

export function getZoneDescription(city: string): string {
    const zone = getZoneForCity(city);
    if (!zone) return "Unknown Zone";

    const descriptions: Record<string, string> = {
        "A": "Zone A (Metro / Core)",
        "B": "Zone B (Major City / Metros)",
        "C": "Zone C (Rest of India)",
        "D": "Zone D (Extended NCR)"
    };
    return descriptions[zone] || "Unknown";
}
