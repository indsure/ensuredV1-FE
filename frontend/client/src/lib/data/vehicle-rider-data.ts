
export interface VehicleRiderEntry {
    riderName: string;
    description: string;
    coverageScope: string;
    exclusions: string;
    typicalCost: string;
    idealFor: string;
}

export const VEHICLE_RIDERS_DATABASE: VehicleRiderEntry[] = [
    {
        riderName: "Zero Depreciation Cover",
        description: "Reimburses full replacement cost of damaged parts without deducting depreciation (bumper-to-bumper).",
        coverageScope: "Engine parts, body panels, bumpers, plastic/rubber parts, fiberglass, electricals.",
        exclusions: "Tyres/tubes (unless separate cover), paintwork, consumables, wear and tear.",
        typicalCost: "₹7,000-₹12,000/year (approx 5-15% extra premium)",
        idealFor: "New vehicles (<5 years), luxury cars, original owners."
    },
    {
        riderName: "Engine Protection Cover",
        description: "Covers repair/replacement of internal engine parts damaged by water ingression (hydrostatic lock) or oil leakage.",
        coverageScope: "Pistons, rods, gearbox, transmission, differential, lubricants.",
        exclusions: "Consequential damage from driving after waterlogging, wear and tear.",
        typicalCost: "₹1,000-₹4,000/year",
        idealFor: "Flood-prone areas, high-end cars with expensive engines."
    },
    {
        riderName: "No Claim Bonus (NCB) Protect",
        description: "Protects your earned No Claim Bonus percentage even if you make a claim during the policy year.",
        coverageScope: "Usually allows 1 claim per year without dropping NCB.",
        exclusions: "More than one claim (typically), total loss cases.",
        typicalCost: "5-7% additional premium",
        idealFor: "Cautious drivers, high NCB holders (45-50%)."
    },
    {
        riderName: "Roadside Assistance (RSA)",
        description: "24/7 emergency support for breakdown, flat tyre, dead battery, or minor repairs.",
        coverageScope: "Towing, jumpstart, tyre change, fuel delivery, key retrieval, minor on-spot repairs.",
        exclusions: "Cost of parts/fuel (often payable), major repairs.",
        typicalCost: "₹500-₹1,500/year",
        idealFor: "Frequent travelers, highway driving, older cars."
    },
    {
        riderName: "Return to Invoice (RTI)",
        description: "Pays the original invoice price (road tax + registration) in case of total loss or theft, not just the IDV.",
        coverageScope: "Theft, total loss (>75% damage).",
        exclusions: "Partial damage repairs.",
        typicalCost: "10-20% additional premium",
        idealFor: "New cars (1-3 years), theft-prone models."
    },
    {
        riderName: "Consumables Cover",
        description: "Covers cost of consumables (oil, bolts, grease, gas) replaced during accidental repairs.",
        coverageScope: "Engine oil, gearbox oil, brake oil, AC gas, nuts, bolts, washers.",
        exclusions: "Fuel, normal top-ups.",
        typicalCost: "₹500-₹1,500/year",
        idealFor: "All vehicles, specifically to avoid small out-of-pocket expenses."
    },
    {
        riderName: "Tyre Protect",
        description: "Covers accidental damage to tyres (bulges, cuts, bursts) which are usually excluded or heavily depreciated.",
        coverageScope: "Tyre replacement due to accidental damage.",
        exclusions: "Normal tread wear, manufacturing defects.",
        typicalCost: "₹1,000-₹3,000/year",
        idealFor: "SUVs, cars with low-profile/expensive tyres."
    }
];

export function findVehicleRiders(keyword: string): VehicleRiderEntry[] {
    return VEHICLE_RIDERS_DATABASE.filter(r =>
        r.riderName.toLowerCase().includes(keyword.toLowerCase()) ||
        r.description.toLowerCase().includes(keyword.toLowerCase())
    );
}
