import type { Request, Response } from "express";

export async function handleHospitalFilter(req: Request, res: Response) {
  try {
    const { state, city, pincode } = req.query;

    // Always use file-based filter engine (returns { cityLevel, pincodeLevel } shape expected by frontend)
    const filterEnginePath = "./src/data/insurance_networks/filter_engine";
    const { filterHospitalNetwork } = await import(filterEnginePath);

    const result = filterHospitalNetwork({
      state: state as string | undefined,
      city: city as string | undefined,
      pincode: pincode as string | undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Hospital Filter] Error:", error);
    res.status(500).json({
      error: "Failed to filter hospital network data",
      details: error.message,
    });
  }
}
