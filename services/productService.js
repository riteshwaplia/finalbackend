const Catalog = require('../models/Catalog');
const Businessprofile = require('../models/BusinessProfile');
const Product = require('../models/Product');
const { statusCode, resMessage } = require("../config/constants");
const { createProduct } = require('../functions/functions');

exports.createProduct = async (req) => {
    try {
        let { catalogId } = req.params;
        const formatedPrice = req.body.price * 100;
        const productData = {
            retailer_id: req.body.retailer_id,
            name: req.body.name,
            description: req.body.description,
            price: formatedPrice,
            currency: req.body.currency,
            availability: req.body.availability,
            condition: req.body.condition,
            image_url: req.body.image_url,
        };
        const catalogData = await Catalog.findOne({ _id: catalogId, userId: req.user._id, tenantId: req.tenant._id });
        if(!catalogData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Catalog_id_not_found
            }
        }
        const businessData = await Businessprofile.findOne({ _id: catalogData.businessProfileId });
        if (!businessData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Business_profile_id_not_linked
            };
        }
        const result = await createProduct(productData, catalogData.catalogId, businessData.metaAccessToken);
        if (result?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: result?.details?.error?.message
            };
        }
        const dbData = {
            retailer_id: req.body.retailer_id,
            name: req.body.name,
            description: req.body.description,
            price: req.body.price,
            currency: req.body.currency,
            availability: req.body.availability,
            condition: req.body.condition,
            image_url: req.body.image_url,
            userId: req.user._id,
            tenantId: req.tenant._id,
            catalogId: catalogData._id,
            meta_product_id: result.id
        };
        await Product.create(dbData);
        return {
            status: statusCode.CREATED,
            success: true,
            message: resMessage.Product_created
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}

exports.listProducts = async (req) => {
  try {
    const { catalogId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!catalogId) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: resMessage.Catalog_id_not_found
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find({
      catalogId,
      userId: req.user._id,
      tenantId: req.tenant._id
    })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalRecords = await Product.countDocuments({
      catalogId,
      userId: req.user._id,
      tenantId: req.tenant._id
    });

    if (!products || products.length === 0) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.No_data_found
      };
    }

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Data_fetch_successfully,
      data: products,
      pagination: {
        totalRecords,
        currentPage: Number(page),
        totalPages: Math.ceil(totalRecords / Number(limit)),
        pageSize: Number(limit)
      }
    };
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message || resMessage.Server_error
    };
  }
};