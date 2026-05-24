import { runMockReview } from "./mockReviewService.js";

export async function runReview({ config, workflow }) {
  if (config.reviewProvider === "mock") {
    return runMockReview({ workflow });
  }

  throw new Error(`Unsupported REVIEW_PROVIDER: ${config.reviewProvider}`);
}
