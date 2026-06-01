import { runModelReview } from "./modelReviewService.js";
import { runMockReview } from "./mockReviewService.js";

export async function runReview({ config, workflow, fetchImpl }) {
  if (config.reviewProvider === "mock") {
    return runMockReview({ workflow });
  }

  if (config.reviewProvider === "model") {
    return runModelReview({ config, workflow, fetchImpl });
  }

  throw new Error(`Unsupported REVIEW_PROVIDER: ${config.reviewProvider}`);
}
