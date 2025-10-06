const mongoose = require('mongoose');
const Catalog = require('../models/Catalog');
const Businessprofile = require('../models/BusinessProfile');
const Product = require('../models/Product');
const { statusCode, resMessage } = require("../config/constants");
const { createProduct, fetchFacebookProducts, deleteProduct, updateProduct } = require('../functions/functions');

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
    if (!catalogData) {
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

exports.listProductsName = async (req) => {
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

    const products = await Product.find(
      {
        catalogId,
        userId: req.user._id,
        tenantId: req.tenant._id
      },
      {
        retailer_id: 1,
        name: 1,
        price: 1,
        availability: 1,
        _id: 0 
      }
    )
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

exports.syncProduct = async (req) => {
  try {
    const { catalogId } = req.params;

    const catalogData = await Catalog.findOne({
      _id: catalogId,
      userId: req.user._id,
      tenantId: req.tenant._id
    });
    if (!catalogData) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Catalog_id_not_found
      };
    }

    const businessData = await Businessprofile.findOne({
      _id: catalogData.businessProfileId
    });
    if (!businessData) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Business_profile_id_not_linked
      };
    }

    const products = await fetchFacebookProducts(catalogData.catalogId, businessData.metaAccessToken);
    if (products?.error) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: products?.details?.error?.message
      };
    }

    let metaProducts = products?.data || [];

    if (!metaProducts.length) {
      await Product.deleteMany({
        catalogId,
        userId: req.user._id,
        tenantId: req.tenant._id
      });
      return {
        status: statusCode.SUCCESS,
        success: true,
        message: resMessage.All_products_deleted
      };
    }

    let productDocs = metaProducts.map(item => ({
      userId: req.user._id,
      tenantId: req.tenant._id,
      catalogId,
      meta_product_id: item.id,
      name: item.name,
      price: item.price
        ? Number(item.price.replace(/[^0-9.]/g, ""))
        : null,
      availability: item.availability,
      retailer_id: item.retailer_id,
      description: item.description,
      currency: item.currency,
      condition: item.condition,
      image_url: item.image_url
    }));

    const existingProducts = await Product.find({
      catalogId,
      userId: req.user._id,
      tenantId: req.tenant._id
    }).distinct("retailer_id");

    const metaRetailerIds = productDocs.map(p => p.retailer_id);

    const newProducts = productDocs.filter(
      p => !existingProducts.includes(p.retailer_id)
    );

    const productsToDelete = existingProducts.filter(
      rId => !metaRetailerIds.includes(rId)
    );

    if (newProducts.length > 0) {
      await Product.insertMany(newProducts);
    }

    if (productsToDelete.length > 0) {
      await Product.deleteMany({
        retailer_id: { $in: productsToDelete },
        catalogId,
        userId: req.user._id,
        tenantId: req.tenant._id
      });
    }

    return {
      status: statusCode.SUCCESS,
      success: true,
      message: resMessage.Product_synced,
      data: {
        newProductsAdded: newProducts.length,
        productsDeleted: productsToDelete.length
      }
    };

  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
};

exports.deleteProduct = async (req) => {
  try {
    const { productId } = req.params;
    const data = await Product.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(productId),
          userId: new mongoose.Types.ObjectId(req.user._id),
          tenantId: new mongoose.Types.ObjectId(req.tenant._id)
        }
      },
      {
        $lookup: {
          from: "catalogs",
          let: { catalogIdVar: "$catalogId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$catalogIdVar"]
                }
              }
            },
            {
              $lookup: {
                from: "businessprofiles",
                localField: "businessProfileId",
                foreignField: "_id",
                as: "businessProfileId"
              }
            },
            {
              $unwind: "$businessProfileId"
            }
          ],
          as: "catalogInfo"
        }
      },
      {
        $unwind: "$catalogInfo"
      },
      {
        $project: {
          metaAccessToken: "$catalogInfo.businessProfileId.metaAccessToken",
          meta_product_id: 1,
          userId: 1,
          tenantId: 1
        }
      }
    ])
    if (data.length === 0) {
      return {
        status: statusCode.NOT_FOUND,
        success: false,
        message: resMessage.Product_id_not_found
      }
    }

    const result = await deleteProduct(data[0].meta_product_id, data[0].metaAccessToken);
    if (result?.error) {
      return {
        status: statusCode.BAD_REQUEST,
        success: false,
        message: result?.details?.error?.message
      };
    }

    await Product.findByIdAndDelete(productId);

    return {
      status: statusCode.OK,
      success: true,
      message: resMessage.Product_deleted
    }
  } catch (error) {
    return {
      status: statusCode.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message
    };
  }
}

exports.editProduct = async (req) => {
    try {
        const { productId } = req.params;
        const productData = await Product.findOne({ _id: productId, userId: req.user._id, tenantId: req.tenant._id });
        if(!productData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Product_id_not_found
            }
        }
        const catalogData = await Catalog.findOne({
            _id: productData.catalogId,
            userId: req.user._id,
            tenantId: req.tenant._id
        });
        if (!catalogData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Catalog_id_not_found
            };
        }
        const businessData = await Businessprofile.findOne({
            _id: catalogData.businessProfileId
        });
        if (!businessData) {
            return {
                status: statusCode.NOT_FOUND,
                success: false,
                message: resMessage.Business_profile_id_not_linked
            };
        }
        const data = await updateProduct(productData.meta_product_id, businessData.metaAccessToken, req.body);
        if (data?.error) {
            return {
                status: statusCode.BAD_REQUEST,
                success: false,
                message: data?.details?.error?.message
            };
        }
        productData.name = req.body.name,
        productDatadescription = req.body.description,
        productData.price = Number(req.body.price);
        productData.currency = req.body.currency,
        productData.availability = req.body.availability,
        productData.condition = req.body.condition,
        productData.image_url = req.body.image_url
        await productData.save();
        return {
            status: statusCode.SUCCESS,
            success: true,
            message: resMessage.Product_updated
        }
    } catch (error) {
        return {
            status: statusCode.INTERNAL_SERVER_ERROR,
            success: false,
            message: error.message
        };
    }
}