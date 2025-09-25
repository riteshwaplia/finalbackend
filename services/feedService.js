const mongoose = require('mongoose');
const { createFeedOnMeta } = require("../functions/functions");
const { syncFeedOnMeta, updateFeedOnMeta, getFeedFromMeta } = require("../functions/functions");
const { listFeedsFromMeta } = require("../functions/functions");
const  Feed =require("../models/Feed")
const Catalog = require('../models/Catalog');
const { statusCode, resMessage } = require("../config/constants");
const Businessprofile = require('../models/BusinessProfile');


exports.createFeed = async (req) => {
  try {
    const { catalogId, name, schedule, businessProfileId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(businessProfileId)) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Invalid_business_ID,
      };
    }

    const isMetaId = await Businessprofile.findOne({
      _id: businessProfileId,
      userId: req.user._id,
      tenantId: req.tenant._id,
    });
    if (!isMetaId) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Business_profile_not_found,
      };
    }

    const catalogDetails = await Catalog.findOne({
      _id: catalogId,
      userId: req.user._id,
      tenantId: req.tenant._id,
    });
    if (!catalogDetails) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Catalog_id_not_found,
      };
    }

    // Call Meta API
    const metaResponse = await createFeedOnMeta(
      catalogDetails.catalogId, // ✅ use FB catalogId, not Mongo _id
      isMetaId.metaAccessToken,
      { name, schedule }
    );

    if (metaResponse?.error) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: metaResponse.error.message,
      };
    }

    // Save to DB
    const feed = await Feed.create({
      userId: req.user._id,
      tenantId: req.tenant._id,
      catalogId,
      name,
      schedule,
      meta_feed_id: metaResponse.id,
      businessProfileId,
    });

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Feed_created,
      data: feed,
    };
  } catch (error) {
    console.error("Error in createFeed:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || "Server error",
    };
  }
};






exports.syncFeed = async (req) => {
  try {
    const { catalogId } = req.params;

    const catalogDetails = await Catalog.findOne({
      _id: catalogId,
      tenantId: req.tenant._id,
      userId: req.user._id,
    }).populate("businessProfileId", "metaAccessToken metaId");

    if (!catalogDetails) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Catalog_id_not_found,
      };
    }

    // ✅ Fetch all feeds from Meta
    const result = await listFeedsFromMeta(
      catalogDetails.catalogId, // FB catalog ID
      catalogDetails.businessProfileId.metaAccessToken
    );

    if (result?.error) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: result.error.message,
      };
    }

    const metaFeeds = result.data || [];
    const metaFeedIds = metaFeeds.map((f) => f.id);

    // ✅ Sync each feed
    for (const feed of metaFeeds) {
      const existingFeed = await Feed.findOne({
        meta_feed_id: feed.id,
        tenantId: req.tenant._id,
        userId: req.user._id,
      });

      if (existingFeed) {
        // update
        await Feed.updateOne(
          { _id: existingFeed._id },
          {
            $set: {
              name: feed.name,
              schedule: feed.schedule || existingFeed.schedule,
              product_count: feed.product_count || 0,
              latest_upload: feed.latest_upload || null,
            },
          }
        );
      } else {
        // insert
        await Feed.create({
          userId: req.user._id,
          tenantId: req.tenant._id,
          catalogId,
          name: feed.name,
          schedule: feed.schedule || null,
          meta_feed_id: feed.id,
          product_count: feed.product_count || 0,
          latest_upload: feed.latest_upload || null,
          businessProfileId: catalogDetails.businessProfileId._id,
        });
      }
    }

    // ✅ Delete local feeds that are no longer on Meta
    await Feed.deleteMany({
      catalogId,
      tenantId: req.tenant._id,
      userId: req.user._id,
      meta_feed_id: { $nin: metaFeedIds },
    });

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Feed_sync_success,
      data: metaFeeds, // fresh list from Meta
      pagination: result.paging || null,
    };
  } catch (error) {
    console.error("Error syncing feeds:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
    };
  }
};


/**
 * Update feed settings
 */
exports.updateFeed = async (req) => {
  try {
    const { catalogId, feedId } = req.params;

    const catalogDetails = await Catalog.findOne({
      _id: catalogId,
      tenantId: req.tenant._id,
      userId: req.user._id,
    }).populate("businessProfileId", "metaAccessToken");

    if (!catalogDetails) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Catalog_id_not_found,
      };
    }

    const feedData = await Feed.findOne({
      _id: feedId,
      tenantId: req.tenant._id,
      userId: req.user._id,
    });

    if (!feedData) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Feed_not_found,
      };
    }

    // ✅ Call Meta API with stored schedule.url
    const result = await updateFeedOnMeta(
      feedData.meta_feed_id,
      catalogDetails.businessProfileId.metaAccessToken,
      feedData.schedule?.url // make sure url exists
    );

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Feed_updated,
      data: { meta: result, local: feedData }, // ✅ no circular JSON
    };
  } catch (error) {
    console.error("Update Feed error:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || "Failed to update feed",
    };
  }
};




/**
 * Get feed details
 */
exports.getFeed = async (req) => {
  try {
    const { feedId } = req.params;

    const feedData = await Feed.findOne({
      _id: feedId,
      tenantId: req.tenant._id,
      userId: req.user._id
    }).populate("businessProfileId", "metaAccessToken");

    if (!feedData) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Feed_not_found
      };
    }

    const result = await getFeedFromMeta(
      feedData.meta_feed_id,
      feedData.businessProfileId.metaAccessToken
    );

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Feed_fetched,
      data: result
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};

exports.listFeeds = async (req) => {
  try {
    const { catalogId } = req.params;

    // ✅ Check catalog exists
    const catalogData = await Catalog.findOne({
      _id: catalogId,
      tenantId: req.tenant._id,
      userId: req.user._id
    });

    if (!catalogData) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Catalog_id_not_found
      };
    }

    // ✅ Fetch feeds from local DB
    const feeds = await Feed.find({
      catalogId,
      tenantId: req.tenant._id,
      userId: req.user._id
    }).sort({ createdAt: -1 }); // latest first

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Feeds_fetched,
      data: feeds
    };
  } catch (error) {
    console.error("Error in listFeeds:", error);
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};
