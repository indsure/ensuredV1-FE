import type { Request, Response } from "express";
import { wrapSuccess, wrapError, generateRequestId } from "../middlewares/response.middleware";
import { getRAGService } from "../services/rag.service";

export async function handleHospitalFilter(req: Request, res: Response) {
  const requestId = generateRequestId();

  try {
    const { state, city, pincode, insurer, query } = req.query;

    // Try RAG-based hospital search first if DB is available
    if (process.env.DATABASE_URL) {
      try {
        const ragService = getRAGService();
        const result = await ragService.retrieveHospitalContext({
          insurer: insurer as string | undefined,
          city: city as string | undefined,
          state: state as string | undefined,
          pincode: pincode as string | undefined,
          queryText: query as string | undefined,
        });

        if (result) {
          return res.json(
            wrapSuccess(result, {
              requestId,
              dataSources: [
                {
                  source: "hospital_db",
                  confidence: result.score ?? 1.0,
                  record_count: result.hospitalCount,
                },
              ],
            })
          );
        }
      } catch (dbErr) {
        console.warn("[Hospital] DB search failed, falling back to file:", (dbErr as Error).message);
      }
    }

    // Fallback to file-based filter engine
    const filterEnginePath = "./src/data/insurance_networks/filter_engine";
    const { filterHospitalNetwork } = await import(filterEnginePath);

    const result = filterHospitalNetwork({
      state: state as string | undefined,
      city: city as string | undefined,
      pincode: pincode as string | undefined,
    });

    res.json(
      wrapSuccess(result, {
        requestId,
        dataSources: [{ source: "hospital_db", confidence: 0.8 }],
      })
    );
  } catch (error: any) {
    console.error("[Hospital Filter] Error:", error);
    res.status(500).json(
      wrapError("INTERNAL", "Failed to filter hospital network data", error.message, requestId)
    );
  }
}
