import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { getRecommendations } from "../services/recommendation.service.js"

const getRecommendedVideos = asyncHandler(async (req, res) => {
    const parsedPage = Number.parseInt(req.query.page, 10)
    const parsedLimit = Number.parseInt(req.query.limit, 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 30)
        : 12

    const recommendations = await getRecommendations({
        userId: req.user._id,
        page,
        limit
    })

    return res
        .status(200)
        .json(new ApiResponse(200, recommendations, "Recommendations fetched successfully"))
})

export { getRecommendedVideos }
