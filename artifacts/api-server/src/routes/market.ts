import { Router } from "express";
import axios from "axios";

const router = Router();

const AGMARKNET_URL =
  "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

const AGMARKNET_API_KEY =
  process.env.DATA_GOV_API_KEY ||
  process.env.EXPO_PUBLIC_DATA_GOV_API_KEY ||
  "579b464db66ec23bdd0000012e9054a4d444cdce6bf564cfca67cc1";

router.get("/market/agmarknet", async (req, res) => {
  const commodity = String(req.query.commodity || "").trim();
  const state = String(req.query.state || "").trim();
  const limit = Math.min(Number(req.query.limit || 30) || 30, 100);

  if (!commodity) {
    return res.status(400).json({ error: "commodity is required" });
  }

  try {
    const params: Record<string, string | number> = {
      "api-key": AGMARKNET_API_KEY,
      format: "json",
      limit,
      offset: 0,
      "filters[commodity]": commodity,
    };

    if (state) {
      params["filters[state]"] = state;
    }

    const response = await axios.get(AGMARKNET_URL, {
      params,
      timeout: 8000,
      headers: {
        Accept: "application/json",
      },
    });

    const payload = response.data ?? {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    if (
      !Array.isArray(payload.records) &&
      (payload.error || payload.message || payload.status === "error")
    ) {
      return res.status(502).json({
        error:
          payload.error ||
          payload.message ||
          "AGMARKNET returned an unexpected response",
      });
    }

    return res.json({
      records,
      total: payload.total ?? records.length,
      source: "AGMARKNET",
      message:
        records.length === 0
          ? `No current AGMARKNET records found for ${commodity}${state ? ` in ${state}` : ""}.`
          : undefined,
    });
  } catch (error: any) {
    const statusCode =
      error.code === "ECONNABORTED"
        ? 504
        : error.response?.status && error.response.status >= 400
          ? 502
          : 503;

    const remoteMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch AGMARKNET data";

    return res.status(statusCode).json({
      error: `AGMARKNET fetch failed: ${remoteMessage}`,
    });
  }
});

export default router;
